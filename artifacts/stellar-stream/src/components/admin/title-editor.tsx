"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminCatalogQueryKey,
  getGetCatalogQueryKey,
  useCreateMovie,
  useCreateSeries,
  useUpdateTitle,
  type CatalogTitle,
  type Genre,
} from "@workspace/api-client-react";
import { Check, LoaderCircle, X } from "lucide-react";
import { ArtworkUploader, VideoUploader } from "./media-uploader";
import SeriesManager from "./series-manager";

type TitleKind = "movie" | "series";
type EditorDraft = {
  title: string;
  slug: string;
  description: string;
  releaseDate: string;
  rating: string;
  durationSeconds: string;
  status: "draft" | "published" | "unpublished";
};

const blankDraft: EditorDraft = {
  title: "",
  slug: "",
  description: "",
  releaseDate: "",
  rating: "",
  durationSeconds: "",
  status: "draft",
};

export default function TitleEditor({
  title,
  newKind,
  genres,
  onClose,
  onSaved,
}: {
  title: CatalogTitle | null;
  newKind: TitleKind | null;
  genres: Genre[];
  onClose: () => void;
  onSaved: (titleId: string) => void;
}) {
  const queryClient = useQueryClient();
  const createMovie = useCreateMovie();
  const createSeries = useCreateSeries();
  const updateTitle = useUpdateTitle();
  const [draft, setDraft] = useState<EditorDraft>(blankDraft);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const kind = title?.kind ?? newKind ?? "movie";
  const isEditing = Boolean(title);
  const busy = createMovie.isPending || createSeries.isPending || updateTitle.isPending;

  useEffect(() => {
    if (!title) {
      setDraft(blankDraft);
      setSelectedGenres([]);
      return;
    }
    setDraft({
      title: title.title,
      slug: title.slug,
      description: title.description,
      releaseDate: title.releaseDate ?? "",
      rating: title.rating?.toString() ?? "",
      durationSeconds: title.durationSeconds?.toString() ?? "",
      status: title.status,
    });
    setSelectedGenres(
      genres
        .filter((genre) => title.genres.includes(genre.name))
        .map((genre) => genre.id),
    );
  }, [genres, title]);

  function invalidateCatalog() {
    void queryClient.invalidateQueries({ queryKey: getGetAdminCatalogQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
  }

  function handleError(error: unknown) {
    setIsError(true);
    setMessage(error instanceof Error ? error.message : "The title could not be saved.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    const titleData = {
      title: draft.title.trim(),
      ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
      description: draft.description.trim(),
      releaseDate: draft.releaseDate || null,
      rating: draft.rating === "" ? null : Number(draft.rating),
      genreIds: selectedGenres,
      status: draft.status,
    };

    if (title) {
      updateTitle.mutate(
        {
          titleId: title.id,
          data: {
            ...titleData,
            ...(kind === "movie"
              ? { durationSeconds: Number(draft.durationSeconds || 0) }
              : {}),
          },
        },
        {
          onSuccess: (updated) => {
            invalidateCatalog();
            setMessage("Title saved.");
            onSaved(updated.id);
          },
          onError: handleError,
        },
      );
      return;
    }

    if (kind === "movie") {
      createMovie.mutate(
        {
          data: {
            ...titleData,
            durationSeconds: Number(draft.durationSeconds || 0),
          },
        },
        {
          onSuccess: (created) => {
            invalidateCatalog();
            setMessage("Movie created.");
            onSaved(created.id);
          },
          onError: handleError,
        },
      );
    } else {
      createSeries.mutate(
        { data: titleData },
        {
          onSuccess: (created) => {
            invalidateCatalog();
            setMessage("Series created.");
            onSaved(created.id);
          },
          onError: handleError,
        },
      );
    }
  }

  function toggleGenre(genreId: string) {
    setSelectedGenres((previous) =>
      previous.includes(genreId)
        ? previous.filter((item) => item !== genreId)
        : [...previous, genreId],
    );
  }

  return (
    <section className="admin-editor" aria-label={isEditing ? "Edit title" : `Create ${kind}`}>
      <div className="admin-editor-heading">
        <div>
          <p className="admin-kicker">{isEditing ? "CATALOG ENTRY" : "NEW CATALOG ENTRY"}</p>
          <h2>{isEditing ? title?.title : `Add ${kind === "movie" ? "a movie" : "a series"}`}</h2>
        </div>
        <button className="admin-icon-button" aria-label="Close title editor" onClick={onClose} data-testid="button-close-title-editor"><X size={16} /></button>
      </div>

      <form className="admin-title-form" onSubmit={submit}>
        <div className="admin-form-grid">
          <label className="admin-span-two">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required maxLength={200} data-testid="input-title-name" /></label>
          <label>Slug<input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} maxLength={220} placeholder="Generated from title if blank" data-testid="input-title-slug" /></label>
          <label>Release date<input type="date" value={draft.releaseDate} onChange={(event) => setDraft({ ...draft, releaseDate: event.target.value })} data-testid="input-title-release-date" /></label>
          <label>Rating (0–10)<input type="number" min={0} max={10} step="0.1" value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} data-testid="input-title-rating" /></label>
          {kind === "movie" && <label>Duration (seconds)<input type="number" min={0} value={draft.durationSeconds} onChange={(event) => setDraft({ ...draft, durationSeconds: event.target.value })} data-testid="input-title-duration" /></label>}
          <label>Publication status
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EditorDraft["status"] })} data-testid="select-title-status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </label>
          <label className="admin-span-two">Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={4} maxLength={10000} data-testid="input-title-description" /></label>
        </div>

        <fieldset className="admin-genre-picker">
          <legend>Genres</legend>
          {genres.length === 0 ? (
            <p>No genres yet. Add genres in the Genres tab.</p>
          ) : (
            <div className="admin-genre-options">
              {genres.map((genre) => (
                <label key={genre.id} className={selectedGenres.includes(genre.id) ? "selected" : ""}>
                  <input
                    type="checkbox"
                    checked={selectedGenres.includes(genre.id)}
                    onChange={() => toggleGenre(genre.id)}
                    data-testid={`checkbox-title-genre-${genre.id}`}
                  />
                  {genre.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {message && (
          <p className={isError ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid="status-title-save">
            {isError ? <X size={13} /> : <Check size={13} />} {message}
          </p>
        )}
        <div className="admin-row-actions">
          <button className="admin-primary-button" type="submit" disabled={busy || !draft.title.trim()} data-testid="button-save-title">
            {busy && <LoaderCircle size={14} className="animate-spin" />}
            {busy ? "Saving…" : isEditing ? "Save title" : `Create ${kind}`}
          </button>
          <button className="admin-quiet-button" type="button" onClick={onClose} data-testid="button-cancel-title">Cancel</button>
        </div>
      </form>

      {title && (
        <div className="admin-assets">
          <ArtworkUploader titleId={title.id} onSaved={invalidateCatalog} />
          {kind === "movie" && (
            <VideoUploader
              titleId={title.id}
              status={title.videoStatus}
              playbackUrl={title.playbackUrl}
            />
          )}
        </div>
      )}

      {title?.kind === "series" && <SeriesManager seriesId={title.id} />}
    </section>
  );
}
