import { Router, type IRouter } from "express";
import { Readable } from "node:stream";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  mediaAssetsTable,
  titlesTable,
  episodesTable,
  type MediaAsset,
} from "@workspace/db";
import {
  AttachArtworkBody,
  AttachArtworkParams,
  AttachArtworkResponse,
  CreateArtworkUploadBody,
  CreateArtworkUploadResponse,
  CreateVideoUploadBody,
  CreateVideoUploadResponse,
  GetVideoAssetParams,
  GetVideoAssetResponse,
  RefreshVideoAssetParams,
  RefreshVideoAssetResponse,
} from "@workspace/api-zod";
import { toCatalogTitle } from "../lib/catalog";
import {
  createStreamDirectUpload,
  getStreamVideo,
  mapStreamStatus,
  StreamApiError,
  StreamConfigurationError,
} from "../lib/cloudflareStream";
import { removeMediaAssets } from "../lib/mediaCleanup";
import { ObjectPermission } from "../lib/objectAcl";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const objectStorage = new ObjectStorageService();

function streamError(
  req: Parameters<typeof requireAdmin>[0],
  res: Parameters<typeof requireAdmin>[1],
  error: unknown,
): void {
  if (error instanceof StreamConfigurationError) {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof StreamApiError) {
    req.log.warn(
      { providerStatus: error.statusCode, message: error.message },
      "Cloudflare Stream request failed",
    );
    res.status(502).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "Cloudflare Stream request failed");
  res.status(502).json({ error: "Cloudflare Stream request failed." });
}

function serializeMediaAsset(asset: MediaAsset) {
  return {
    id: asset.id,
    titleId: asset.titleId,
    episodeId: asset.episodeId,
    provider: asset.provider,
    kind: asset.kind,
    status: asset.status,
    providerUid: asset.providerUid,
    objectPath: asset.objectPath,
    playbackUrl: asset.playbackUrl,
    durationSeconds: asset.durationSeconds,
    createdAt: asset.createdAt,
  };
}

router.post(
  "/admin/artwork/upload-url",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateArtworkUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const uploadUrl = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);
      res.json(
        CreateArtworkUploadResponse.parse({ uploadUrl, objectPath }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Could not create artwork upload URL");
      res.status(503).json({ error: "Artwork storage is unavailable." });
    }
  },
);

router.put(
  "/admin/titles/:titleId/artwork",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AttachArtworkParams.safeParse(req.params);
    const parsed = AttachArtworkBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!/^\/objects\/uploads\/[0-9a-f-]{36}$/i.test(parsed.data.objectPath)) {
      res.status(400).json({ error: "Invalid uploaded artwork path." });
      return;
    }

    const [title] = await db
      .select()
      .from(titlesTable)
      .where(eq(titlesTable.id, params.data.titleId))
      .limit(1);
    if (!title) {
      res.status(404).json({ error: "Title not found." });
      return;
    }

    try {
      await objectStorage.trySetObjectEntityAclPolicy(parsed.data.objectPath, {
        owner: req.appUser!.id,
        visibility: "public",
      });
    } catch (error) {
      req.log.error({ err: error }, "Could not publish uploaded artwork");
      res.status(400).json({ error: "Uploaded artwork could not be found." });
      return;
    }

    const [updated] = await db
      .update(titlesTable)
      .set(
        parsed.data.kind === "poster"
          ? { posterPath: parsed.data.objectPath, updatedAt: new Date() }
          : { backdropPath: parsed.data.objectPath, updatedAt: new Date() },
      )
      .where(eq(titlesTable.id, title.id))
      .returning();

    const [existingAsset] = await db
      .select()
      .from(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.titleId, title.id),
          isNull(mediaAssetsTable.episodeId),
          eq(mediaAssetsTable.kind, parsed.data.kind),
          eq(mediaAssetsTable.objectPath, parsed.data.objectPath),
        ),
      )
      .limit(1);
    if (!existingAsset) {
      await db.insert(mediaAssetsTable).values({
        titleId: title.id,
        uploadedBy: req.appUser!.id,
        provider: "replit_object_storage",
        kind: parsed.data.kind,
        status: "ready",
        objectPath: parsed.data.objectPath,
        playbackUrl: `/api/storage${parsed.data.objectPath}`,
      });
    }
    res.json(AttachArtworkResponse.parse(await toCatalogTitle(updated)));
  },
);

router.get(/^\/storage\/objects\/(.+)$/, async (req, res): Promise<void> => {
  const tail = req.params[0];
  if (typeof tail !== "string") {
    res.status(404).json({ error: "Object not found." });
    return;
  }

  try {
    const objectFile = await objectStorage.getObjectEntityFile(`/objects/${tail}`);
    const allowed = await objectStorage.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!allowed) {
      res.status(403).json({ error: "Object is not publicly available." });
      return;
    }
    const response = await objectStorage.downloadObject(objectFile, 86400);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.status(response.status);
    if (response.body) {
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.warn({ err: error }, "Could not serve artwork object");
    res.status(404).json({ error: "Object not found." });
  }
});

router.post(
  "/admin/videos/direct-upload-url",
  requireAdmin,
  async (req, res): Promise<void> => {
  const parsed = CreateVideoUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [title] = await db
    .select({ id: titlesTable.id, kind: titlesTable.kind })
    .from(titlesTable)
    .where(eq(titlesTable.id, parsed.data.titleId))
    .limit(1);
  if (!title) {
    res.status(404).json({ error: "Title not found." });
    return;
  }

  if (parsed.data.episodeId) {
    const [episode] = await db
      .select({ id: episodesTable.id })
      .from(episodesTable)
      .where(
        and(
          eq(episodesTable.id, parsed.data.episodeId),
          eq(episodesTable.seriesId, title.id),
        ),
      )
      .limit(1);
    if (!episode || title.kind !== "series") {
      res.status(400).json({ error: "Episode does not belong to this series." });
      return;
    }
  }

  try {
    const upload = await createStreamDirectUpload({
      maxDurationSeconds: parsed.data.maxDurationSeconds,
      creator: req.appUser!.id,
      titleId: title.id,
      episodeId: parsed.data.episodeId,
    });
    const [asset] = await db
      .insert(mediaAssetsTable)
      .values({
        titleId: title.id,
        episodeId: parsed.data.episodeId,
        uploadedBy: req.appUser!.id,
        provider: "cloudflare_stream",
        kind: "video",
        status: "pending",
        providerUid: upload.uid,
      })
      .returning();

    res.status(201).json(
      CreateVideoUploadResponse.parse({
        assetId: asset.id,
        providerUid: upload.uid,
        uploadUrl: upload.uploadURL,
      }),
    );
  } catch (error) {
    streamError(req, res, error);
  }
  },
);

router.get(
  "/admin/videos/:assetId",
  requireAdmin,
  async (req, res): Promise<void> => {
  const params = GetVideoAssetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [asset] = await db
    .select()
    .from(mediaAssetsTable)
    .where(eq(mediaAssetsTable.id, params.data.assetId))
    .limit(1);
  if (!asset) {
    res.status(404).json({ error: "Video asset not found." });
    return;
  }
  res.json(GetVideoAssetResponse.parse(serializeMediaAsset(asset)));
  },
);

router.post(
  "/admin/videos/:assetId/refresh",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = RefreshVideoAssetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [asset] = await db
      .select()
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, params.data.assetId))
      .limit(1);
    if (!asset || !asset.providerUid) {
      res.status(404).json({ error: "Video asset not found." });
      return;
    }
    try {
      const remote = await getStreamVideo(asset.providerUid);
      const [updated] = await db
        .update(mediaAssetsTable)
        .set({
          status: mapStreamStatus(remote),
          playbackUrl:
            mapStreamStatus(remote) === "ready"
              ? remote.playback?.hls ?? null
              : null,
          durationSeconds:
            typeof remote.duration === "number" && remote.duration > 0
              ? Math.round(remote.duration)
              : null,
          updatedAt: new Date(),
        })
        .where(eq(mediaAssetsTable.id, asset.id))
        .returning();
      res.json(
        RefreshVideoAssetResponse.parse(serializeMediaAsset(updated)),
      );
    } catch (error) {
      streamError(req, res, error);
    }
  },
);

export default router;
