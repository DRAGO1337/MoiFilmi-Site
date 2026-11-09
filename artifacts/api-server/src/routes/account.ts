import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  episodesTable,
  titlesTable,
  usersTable,
  watchProgressTable,
  watchlistsTable,
} from "@workspace/db";
import {
  AddWatchlistEntryBody,
  AddWatchlistEntryResponse,
  DeleteWatchlistEntryParams,
  GetAccountResponse,
  GetWatchProgressResponse,
  GetWatchlistQueryParams,
  GetWatchlistResponse,
  SaveWatchProgressBody,
  SaveWatchProgressResponse,
  UpdateAccountBody,
  UpdateAccountResponse,
} from "@workspace/api-zod";
import { toCatalogTitle, toEpisode } from "../lib/catalog";
import { requireViewer } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireViewer);

router.get("/account", async (req, res): Promise<void> => {
  res.json(GetAccountResponse.parse(req.appUser));
});

router.patch("/account", async (req, res): Promise<void> => {
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ displayName: parsed.data.displayName.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, req.appUser!.id))
    .returning();

  res.json(UpdateAccountResponse.parse(user));
});

router.get("/account/watchlist", async (req, res): Promise<void> => {
  const query = GetWatchlistQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select({
      id: watchlistsTable.id,
      titleId: watchlistsTable.titleId,
      entryKind: watchlistsTable.entryKind,
      createdAt: watchlistsTable.createdAt,
      title: titlesTable,
    })
    .from(watchlistsTable)
    .innerJoin(titlesTable, eq(watchlistsTable.titleId, titlesTable.id))
    .where(
      and(
        eq(watchlistsTable.userId, req.appUser!.id),
        eq(watchlistsTable.entryKind, query.data.entryKind),
        eq(titlesTable.status, "published"),
      ),
    )
    .orderBy(desc(watchlistsTable.createdAt))
    .limit(200);

  const entries = await Promise.all(
    rows.map(async (entry) => ({
      id: entry.id,
      titleId: entry.titleId,
      entryKind: entry.entryKind,
      createdAt: entry.createdAt,
      title: await toCatalogTitle(entry.title),
    })),
  );
  res.json(GetWatchlistResponse.parse(entries));
});

router.post("/account/watchlist", async (req, res): Promise<void> => {
  const parsed = AddWatchlistEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [title] = await db
    .select({ id: titlesTable.id })
    .from(titlesTable)
    .where(
      and(
        eq(titlesTable.id, parsed.data.titleId),
        eq(titlesTable.status, "published"),
      ),
    )
    .limit(1);
  if (!title) {
    res.status(404).json({ error: "Published title not found." });
    return;
  }

  const inserted = await db
    .insert(watchlistsTable)
    .values({
      userId: req.appUser!.id,
      titleId: parsed.data.titleId,
      entryKind: parsed.data.entryKind,
    })
    .onConflictDoNothing()
    .returning();
  const [entry] =
    inserted.length > 0
      ? inserted
      : await db
          .select()
          .from(watchlistsTable)
          .where(
            and(
              eq(watchlistsTable.userId, req.appUser!.id),
              eq(watchlistsTable.titleId, parsed.data.titleId),
              eq(watchlistsTable.entryKind, parsed.data.entryKind),
            ),
          )
          .limit(1);

  res.status(201).json(AddWatchlistEntryResponse.parse(entry));
});

router.delete(
  "/account/watchlist/:titleId/:entryKind",
  async (req, res): Promise<void> => {
    const params = DeleteWatchlistEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await db
      .delete(watchlistsTable)
      .where(
        and(
          eq(watchlistsTable.userId, req.appUser!.id),
          eq(watchlistsTable.titleId, params.data.titleId),
          eq(watchlistsTable.entryKind, params.data.entryKind),
        ),
      );
    res.sendStatus(204);
  },
);

router.get("/account/progress", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: watchProgressTable.id,
      titleId: watchProgressTable.titleId,
      episodeId: watchProgressTable.episodeId,
      currentTimeSeconds: watchProgressTable.currentTimeSeconds,
      durationSeconds: watchProgressTable.durationSeconds,
      completed: watchProgressTable.completed,
      updatedAt: watchProgressTable.updatedAt,
      title: titlesTable,
    })
    .from(watchProgressTable)
    .innerJoin(titlesTable, eq(watchProgressTable.titleId, titlesTable.id))
    .where(
      and(
        eq(watchProgressTable.userId, req.appUser!.id),
        eq(watchProgressTable.completed, false),
        eq(titlesTable.status, "published"),
      ),
    )
    .orderBy(desc(watchProgressTable.updatedAt))
    .limit(100);

  const progress = await Promise.all(
    rows.map(async (item) => {
      const [episode] = item.episodeId
        ? await db
            .select()
            .from(episodesTable)
            .where(eq(episodesTable.id, item.episodeId))
            .limit(1)
        : [];
      return {
        id: item.id,
        title: await toCatalogTitle(item.title),
        episode: episode ? await toEpisode(episode) : null,
        currentTimeSeconds: item.currentTimeSeconds,
        durationSeconds: item.durationSeconds,
        completed: item.completed,
        updatedAt: item.updatedAt,
      };
    }),
  );

  res.json(GetWatchProgressResponse.parse(progress));
});

router.put("/account/progress", async (req, res): Promise<void> => {
  const parsed = SaveWatchProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [title] = await db
    .select()
    .from(titlesTable)
    .where(
      and(
        eq(titlesTable.id, parsed.data.titleId),
        eq(titlesTable.status, "published"),
      ),
    )
    .limit(1);
  if (!title) {
    res.status(404).json({ error: "Published title not found." });
    return;
  }

  if (parsed.data.episodeId) {
    const [episode] = await db
      .select({ id: episodesTable.id })
      .from(episodesTable)
      .where(
        and(
          eq(episodesTable.id, parsed.data.episodeId),
          eq(episodesTable.seriesId, parsed.data.titleId),
        ),
      )
      .limit(1);
    if (!episode) {
      res.status(400).json({ error: "Episode does not belong to this series." });
      return;
    }
  }

  const durationSeconds = Math.max(0, parsed.data.durationSeconds);
  const currentTimeSeconds =
    durationSeconds > 0
      ? Math.min(parsed.data.currentTimeSeconds, durationSeconds)
      : parsed.data.currentTimeSeconds;
  const progressKey = parsed.data.episodeId ?? "title";
  const completed =
    durationSeconds > 0 && currentTimeSeconds >= Math.max(0, durationSeconds - 30);

  const [saved] = await db
    .insert(watchProgressTable)
    .values({
      userId: req.appUser!.id,
      titleId: parsed.data.titleId,
      episodeId: parsed.data.episodeId,
      progressKey,
      currentTimeSeconds,
      durationSeconds,
      completed,
    })
    .onConflictDoUpdate({
      target: [
        watchProgressTable.userId,
        watchProgressTable.titleId,
        watchProgressTable.progressKey,
      ],
      set: {
        episodeId: parsed.data.episodeId,
        currentTimeSeconds,
        durationSeconds,
        completed,
        updatedAt: new Date(),
      },
    })
    .returning();

  const [episode] = saved.episodeId
    ? await db
        .select()
        .from(episodesTable)
        .where(eq(episodesTable.id, saved.episodeId))
        .limit(1)
    : [];

  const response = {
    id: saved.id,
    title: await toCatalogTitle(title),
    episode: episode ? await toEpisode(episode) : null,
    currentTimeSeconds: saved.currentTimeSeconds,
    durationSeconds: saved.durationSeconds,
    completed: saved.completed,
    updatedAt: saved.updatedAt,
  };
  res.json(SaveWatchProgressResponse.parse(response));
});

export default router;
