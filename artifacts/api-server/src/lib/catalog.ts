import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  episodesTable,
  genresTable,
  mediaAssetsTable,
  moviesTable,
  seasonsTable,
  titleGenresTable,
  titlesTable,
} from "@workspace/db";

export function assetUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/objects/")) return `/api/storage${path}`;
  return path;
}

export async function toCatalogTitle(title: typeof titlesTable.$inferSelect) {
  const [genreRows, movieRows, videoRows] = await Promise.all([
    db
      .select({ name: genresTable.name })
      .from(titleGenresTable)
      .innerJoin(genresTable, eq(titleGenresTable.genreId, genresTable.id))
      .where(eq(titleGenresTable.titleId, title.id))
      .orderBy(genresTable.name),
    db
      .select({ durationSeconds: moviesTable.durationSeconds })
      .from(moviesTable)
      .where(eq(moviesTable.id, title.id))
      .limit(1),
    db
      .select({
        status: mediaAssetsTable.status,
        playbackUrl: mediaAssetsTable.playbackUrl,
      })
      .from(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.titleId, title.id),
          isNull(mediaAssetsTable.episodeId),
          eq(mediaAssetsTable.kind, "video"),
        ),
      )
      .orderBy(desc(mediaAssetsTable.createdAt))
      .limit(1),
  ]);

  const video = videoRows[0];
  return {
    id: title.id,
    kind: title.kind,
    title: title.title,
    slug: title.slug,
    description: title.description,
    releaseDate: title.releaseDate,
    rating: title.rating,
    posterUrl: assetUrl(title.posterPath),
    backdropUrl: assetUrl(title.backdropPath),
    status: title.status,
    genres: genreRows.map((genre) => genre.name),
    durationSeconds: movieRows[0]?.durationSeconds ?? null,
    videoStatus: video?.status ?? null,
    playbackUrl: video?.status === "ready" ? video.playbackUrl : null,
  };
}

export async function toEpisode(episode: typeof episodesTable.$inferSelect) {
  const [videoRows] = await Promise.all([
    db
      .select({
        status: mediaAssetsTable.status,
        playbackUrl: mediaAssetsTable.playbackUrl,
      })
      .from(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.episodeId, episode.id),
          eq(mediaAssetsTable.kind, "video"),
        ),
      )
      .orderBy(desc(mediaAssetsTable.createdAt))
      .limit(1),
  ]);
  const video = videoRows[0];

  return {
    id: episode.id,
    seriesId: episode.seriesId,
    seasonId: episode.seasonId,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    description: episode.description,
    releaseDate: episode.releaseDate,
    durationSeconds: episode.durationSeconds,
    videoStatus: video?.status ?? null,
    playbackUrl: video?.status === "ready" ? video.playbackUrl : null,
  };
}

export async function getLatestTitleVideoAsset(titleId: string) {
  const [asset] = await db
    .select()
    .from(mediaAssetsTable)
    .where(
      and(
        eq(mediaAssetsTable.titleId, titleId),
        isNull(mediaAssetsTable.episodeId),
        eq(mediaAssetsTable.kind, "video"),
      ),
    )
    .orderBy(desc(mediaAssetsTable.createdAt))
    .limit(1);
  return asset ?? null;
}

export async function getLatestEpisodeVideoAsset(episodeId: string) {
  const [asset] = await db
    .select()
    .from(mediaAssetsTable)
    .where(
      and(
        eq(mediaAssetsTable.episodeId, episodeId),
        eq(mediaAssetsTable.kind, "video"),
      ),
    )
    .orderBy(desc(mediaAssetsTable.createdAt))
    .limit(1);
  return asset ?? null;
}

export async function getSeriesSeasons(seriesId: string) {
  const seasons = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.seriesId, seriesId))
    .orderBy(seasonsTable.seasonNumber);

  return Promise.all(
    seasons.map(async (season) => {
      const episodeRows = await db
        .select()
        .from(episodesTable)
        .where(eq(episodesTable.seasonId, season.id))
        .orderBy(episodesTable.episodeNumber);

      return {
        id: season.id,
        seasonNumber: season.seasonNumber,
        title: season.title,
        episodes: await Promise.all(episodeRows.map(toEpisode)),
      };
    }),
  );
}
