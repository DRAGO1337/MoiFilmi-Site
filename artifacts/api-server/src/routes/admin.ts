import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  episodesTable,
  genresTable,
  mediaAssetsTable,
  moviesTable,
  seasonsTable,
  seriesTable,
  titleGenresTable,
  titlesTable,
  watchProgressTable,
  watchlistsTable,
} from "@workspace/db";
import {
  CreateEpisodeBody,
  CreateEpisodeParams,
  CreateEpisodeResponse,
  CreateGenreBody,
  CreateGenreResponse,
  CreateSeasonBody,
  CreateSeasonParams,
  CreateSeasonResponse,
  CreateSeriesBody,
  CreateSeriesResponse,
  DeleteEpisodeParams,
  DeleteGenreParams,
  DeleteSeasonParams,
  DeleteTitleParams,
  GetAdminCatalogResponse,
  GetAdminGenresResponse,
  GetAdminSeriesDetailParams,
  GetAdminSeriesDetailResponse,
  UpdateEpisodeBody,
  UpdateEpisodeParams,
  UpdateEpisodeResponse,
  UpdateSeasonBody,
  UpdateSeasonParams,
  UpdateSeasonResponse,
  UpdateTitleBody,
  UpdateTitleParams,
  UpdateTitleResponse,
  CreateMovieBody,
  CreateMovieResponse,
} from "@workspace/api-zod";
import { getSeriesSeasons, toCatalogTitle, toEpisode } from "../lib/catalog";
import { removeMediaAssets } from "../lib/mediaCleanup";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAdmin);

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  return typeof value === "string"
    ? value
    : value.toISOString().slice(0, 10);
}

async function titleSlugExists(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: titlesTable.id })
    .from(titlesTable)
    .where(eq(titlesTable.slug, slug))
    .limit(1);
  return Boolean(row && row.id !== exceptId);
}

async function updateSeasonCount(seriesId: string): Promise<void> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(seasonsTable)
    .where(eq(seasonsTable.seriesId, seriesId));
  await db
    .update(seriesTable)
    .set({ seasonCount: Number(row?.count ?? 0) })
    .where(eq(seriesTable.id, seriesId));
}

async function createTitle(
  kind: "movie" | "series",
  input: {
    title: string;
    slug?: string;
    description: string;
    releaseDate: Date | string | null;
    rating: number | null;
    genreIds: string[];
    status: "draft" | "published" | "unpublished";
    durationSeconds?: number;
  },
  createdBy: string,
) {
  const id = randomUUID();
  const baseSlug = slugify(input.slug?.trim() || input.title) || kind;
  const slug = input.slug?.trim() || `${baseSlug}-${id.slice(0, 8)}`;
  if (await titleSlugExists(slug)) return null;

  const [title] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(titlesTable)
      .values({
        id,
        kind,
        title: input.title.trim(),
        slug,
        description: input.description,
        releaseDate: dateOnly(input.releaseDate),
        rating: input.rating,
        status: input.status,
        createdBy,
      })
      .returning();

    if (kind === "movie") {
      await tx.insert(moviesTable).values({
        id,
        durationSeconds: input.durationSeconds ?? 0,
      });
    } else {
      await tx.insert(seriesTable).values({ id, seasonCount: 0 });
    }

    const uniqueGenres = [...new Set(input.genreIds)];
    if (uniqueGenres.length > 0) {
      const found = await tx
        .select({ id: genresTable.id })
        .from(genresTable)
        .where(inArray(genresTable.id, uniqueGenres));
      if (found.length !== uniqueGenres.length) {
        throw new Error("One or more selected genres do not exist.");
      }
      await tx
        .insert(titleGenresTable)
        .values(uniqueGenres.map((genreId) => ({ titleId: id, genreId })));
    }

    return [created];
  });
  return title;
}

router.get("/admin/catalog", async (_req, res): Promise<void> => {
  const titles = await db
    .select()
    .from(titlesTable)
    .orderBy(desc(titlesTable.updatedAt))
    .limit(500);
  res.json(
    GetAdminCatalogResponse.parse(
      await Promise.all(titles.map(toCatalogTitle)),
    ),
  );
});

router.get("/admin/series/:seriesId", async (req, res): Promise<void> => {
  const params = GetAdminSeriesDetailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [title] = await db
    .select()
    .from(titlesTable)
    .where(
      and(
        eq(titlesTable.id, params.data.seriesId),
        eq(titlesTable.kind, "series"),
      ),
    )
    .limit(1);
  if (!title) {
    res.status(404).json({ error: "Series not found." });
    return;
  }

  res.json(
    GetAdminSeriesDetailResponse.parse({
      ...(await toCatalogTitle(title)),
      seasons: await getSeriesSeasons(title.id),
    }),
  );
});

router.post("/admin/movies", async (req, res): Promise<void> => {
  const parsed = CreateMovieBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const genreIds = [...new Set(parsed.data.genreIds)];
  const genres = genreIds.length
    ? await db
        .select({ id: genresTable.id })
        .from(genresTable)
        .where(inArray(genresTable.id, genreIds))
    : [];
  if (genres.length !== genreIds.length) {
    res.status(400).json({ error: "One or more selected genres do not exist." });
    return;
  }
  const title = await createTitle(
    "movie",
    parsed.data,
    req.appUser!.id,
  );
  if (!title) {
    res.status(409).json({ error: "A title with that slug already exists." });
    return;
  }
  res.status(201).json(CreateMovieResponse.parse(await toCatalogTitle(title)));
});

router.post("/admin/series", async (req, res): Promise<void> => {
  const parsed = CreateSeriesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const genreIds = [...new Set(parsed.data.genreIds)];
  const genres = genreIds.length
    ? await db
        .select({ id: genresTable.id })
        .from(genresTable)
        .where(inArray(genresTable.id, genreIds))
    : [];
  if (genres.length !== genreIds.length) {
    res.status(400).json({ error: "One or more selected genres do not exist." });
    return;
  }
  const title = await createTitle(
    "series",
    parsed.data,
    req.appUser!.id,
  );
  if (!title) {
    res.status(409).json({ error: "A title with that slug already exists." });
    return;
  }
  res.status(201).json(CreateSeriesResponse.parse(await toCatalogTitle(title)));
});

router.patch("/admin/titles/:titleId", async (req, res): Promise<void> => {
  const params = UpdateTitleParams.safeParse(req.params);
  const parsed = UpdateTitleBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(titlesTable)
    .where(eq(titlesTable.id, params.data.titleId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Title not found." });
    return;
  }

  if (parsed.data.slug && (await titleSlugExists(parsed.data.slug, existing.id))) {
    res.status(409).json({ error: "A title with that slug already exists." });
    return;
  }

  const { genreIds, durationSeconds, ...fields } = parsed.data;
  if (genreIds !== undefined) {
    const uniqueIds = [...new Set(genreIds)];
    const found = uniqueIds.length
      ? await db
          .select({ id: genresTable.id })
          .from(genresTable)
          .where(inArray(genresTable.id, uniqueIds))
      : [];
    if (found.length !== uniqueIds.length) {
      res.status(400).json({ error: "One or more selected genres do not exist." });
      return;
    }
  }
  const updates: Partial<typeof titlesTable.$inferInsert> = {};
  if (fields.title !== undefined) updates.title = fields.title.trim();
  if (fields.slug !== undefined) updates.slug = fields.slug;
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.releaseDate !== undefined) {
    updates.releaseDate = dateOnly(fields.releaseDate);
  }
  if (fields.rating !== undefined) updates.rating = fields.rating;
  if (fields.status !== undefined) updates.status = fields.status;

  const updated = await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx
        .update(titlesTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(titlesTable.id, existing.id));
    }
    if (durationSeconds !== undefined && existing.kind === "movie") {
      await tx
        .update(moviesTable)
        .set({ durationSeconds })
        .where(eq(moviesTable.id, existing.id));
    }
    if (genreIds !== undefined) {
      const uniqueIds = [...new Set(genreIds)];
      await tx
        .delete(titleGenresTable)
        .where(eq(titleGenresTable.titleId, existing.id));
      if (uniqueIds.length > 0) {
        await tx
          .insert(titleGenresTable)
          .values(uniqueIds.map((genreId) => ({ titleId: existing.id, genreId })));
      }
    }
    const [row] = await tx
      .select()
      .from(titlesTable)
      .where(eq(titlesTable.id, existing.id))
      .limit(1);
    return row;
  });

  res.json(UpdateTitleResponse.parse(await toCatalogTitle(updated)));
});

router.delete("/admin/titles/:titleId", async (req, res): Promise<void> => {
  const params = DeleteTitleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  const assets = await db
    .select()
    .from(mediaAssetsTable)
    .where(eq(mediaAssetsTable.titleId, title.id));
  await removeMediaAssets(assets);

  await db.transaction(async (tx) => {
    await tx
      .delete(watchProgressTable)
      .where(eq(watchProgressTable.titleId, title.id));
    await tx.delete(watchlistsTable).where(eq(watchlistsTable.titleId, title.id));
    await tx.delete(titlesTable).where(eq(titlesTable.id, title.id));
  });
  res.sendStatus(204);
});

router.post("/admin/series/:seriesId/seasons", async (req, res): Promise<void> => {
  const params = CreateSeasonParams.safeParse(req.params);
  const parsed = CreateSeasonBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [series] = await db
    .select({ id: seriesTable.id })
    .from(seriesTable)
    .where(eq(seriesTable.id, params.data.seriesId))
    .limit(1);
  if (!series) {
    res.status(404).json({ error: "Series not found." });
    return;
  }
  const [season] = await db
    .insert(seasonsTable)
    .values({ ...parsed.data, seriesId: series.id })
    .returning();
  await updateSeasonCount(series.id);
  res.status(201).json(CreateSeasonResponse.parse(season));
});

router.patch("/admin/seasons/:seasonId", async (req, res): Promise<void> => {
  const params = UpdateSeasonParams.safeParse(req.params);
  const parsed = UpdateSeasonBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [season] = await db
    .update(seasonsTable)
    .set(parsed.data)
    .where(eq(seasonsTable.id, params.data.seasonId))
    .returning();
  if (!season) {
    res.status(404).json({ error: "Season not found." });
    return;
  }
  res.json(UpdateSeasonResponse.parse(season));
});

router.delete("/admin/seasons/:seasonId", async (req, res): Promise<void> => {
  const params = DeleteSeasonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [season] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.id, params.data.seasonId))
    .limit(1);
  if (!season) {
    res.status(404).json({ error: "Season not found." });
    return;
  }

  const episodes = await db
    .select({ id: episodesTable.id })
    .from(episodesTable)
    .where(eq(episodesTable.seasonId, season.id));
  if (episodes.length > 0) {
    const assets = await db
      .select()
      .from(mediaAssetsTable)
      .where(inArray(mediaAssetsTable.episodeId, episodes.map((item) => item.id)));
    await removeMediaAssets(assets);
  }
  await db.delete(seasonsTable).where(eq(seasonsTable.id, season.id));

  await updateSeasonCount(season.seriesId);
  res.sendStatus(204);
});

router.post(
  "/admin/seasons/:seasonId/episodes",
  async (req, res): Promise<void> => {
    const params = CreateEpisodeParams.safeParse(req.params);
    const parsed = CreateEpisodeBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [season] = await db
      .select()
      .from(seasonsTable)
      .where(eq(seasonsTable.id, params.data.seasonId))
      .limit(1);
    if (!season) {
      res.status(404).json({ error: "Season not found." });
      return;
    }
    const [episode] = await db
      .insert(episodesTable)
      .values({
        ...parsed.data,
        releaseDate: dateOnly(parsed.data.releaseDate),
        seriesId: season.seriesId,
        seasonId: season.id,
      })
      .returning();
    res
      .status(201)
      .json(CreateEpisodeResponse.parse(await toEpisode(episode)));
  },
);

router.patch("/admin/episodes/:episodeId", async (req, res): Promise<void> => {
  const params = UpdateEpisodeParams.safeParse(req.params);
  const parsed = UpdateEpisodeBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { releaseDate, ...episodeFields } = parsed.data;
  const update = {
    ...episodeFields,
    ...(releaseDate !== undefined ? { releaseDate: dateOnly(releaseDate) } : {}),
  };
  const [episode] = await db
    .update(episodesTable)
    .set(update)
    .where(eq(episodesTable.id, params.data.episodeId))
    .returning();
  if (!episode) {
    res.status(404).json({ error: "Episode not found." });
    return;
  }
  res.json(UpdateEpisodeResponse.parse(await toEpisode(episode)));
});

router.delete("/admin/episodes/:episodeId", async (req, res): Promise<void> => {
  const params = DeleteEpisodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const assets = await db
    .select()
    .from(mediaAssetsTable)
    .where(eq(mediaAssetsTable.episodeId, params.data.episodeId));
  await removeMediaAssets(assets);
  const deleted = await db
    .delete(episodesTable)
    .where(eq(episodesTable.id, params.data.episodeId))
    .returning({ id: episodesTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Episode not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/genres", async (_req, res): Promise<void> => {
  const genres = await db
    .select({
      id: genresTable.id,
      name: genresTable.name,
      slug: genresTable.slug,
    })
    .from(genresTable)
    .orderBy(genresTable.name);
  res.json(GetAdminGenresResponse.parse(genres));
});

router.post("/admin/genres", async (req, res): Promise<void> => {
  const parsed = CreateGenreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  const slug = slugify(name);
  const [existing] = await db
    .select({ id: genresTable.id })
    .from(genresTable)
    .where(eq(genresTable.slug, slug))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That genre already exists." });
    return;
  }
  const [genre] = await db
    .insert(genresTable)
    .values({ name, slug })
    .returning();
  res.status(201).json(CreateGenreResponse.parse(genre));
});

router.delete("/admin/genres/:genreId", async (req, res): Promise<void> => {
  const params = DeleteGenreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(genresTable)
    .where(eq(genresTable.id, params.data.genreId));
  res.sendStatus(204);
});

export default router;
