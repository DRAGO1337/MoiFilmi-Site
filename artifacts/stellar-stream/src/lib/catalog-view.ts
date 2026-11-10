import type { CatalogTitle } from "@workspace/api-client-react";

export function titleYear(title: CatalogTitle): string {
  return title.releaseDate
    ? new Date(`${title.releaseDate}T00:00:00`).getFullYear().toString()
    : "Coming soon";
}

export function titleDuration(title: CatalogTitle): string {
  if (!title.durationSeconds) return "Duration unavailable";
  const minutes = Math.max(1, Math.round(title.durationSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
}

export function isAnime(title: CatalogTitle): boolean {
  return (
    title.kind === "series" &&
    title.genres.some((genre) => genre.toLowerCase() === "anime")
  );
}

export function titleArtwork(title: CatalogTitle): string | null {
  return title.backdropUrl || title.posterUrl;
}
