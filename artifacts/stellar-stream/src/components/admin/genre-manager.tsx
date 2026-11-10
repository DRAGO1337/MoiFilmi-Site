"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminGenresQueryKey,
  getGetGenresQueryKey,
  useCreateGenre,
  useDeleteGenre,
  type Genre,
} from "@workspace/api-client-react";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";

export default function GenreManager({
  genres,
  isLoading,
  isError,
}: {
  genres: Genre[];
  isLoading: boolean;
  isError: boolean;
}) {
  const queryClient = useQueryClient();
  const createGenre = useCreateGenre();
  const deleteGenre = useDeleteGenre();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isErrorMessage, setIsErrorMessage] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: getGetAdminGenresQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetGenresQueryKey() });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    createGenre.mutate(
      { data: { name: name.trim() } },
      {
        onSuccess: () => {
          refresh();
          setName("");
          setMessage("Genre added.");
          setIsErrorMessage(false);
        },
        onError: (error) => {
          setMessage(error instanceof Error ? error.message : "Genre could not be added.");
          setIsErrorMessage(true);
        },
      },
    );
  }

  function remove(genre: Genre) {
    if (!window.confirm(`Delete the “${genre.name}” genre? Titles using it will be uncategorized.`)) return;
    deleteGenre.mutate(
      { genreId: genre.id },
      {
        onSuccess: () => {
          refresh();
          setMessage("Genre deleted.");
          setIsErrorMessage(false);
        },
        onError: (error) => {
          setMessage(error instanceof Error ? error.message : "Genre could not be deleted.");
          setIsErrorMessage(true);
        },
      },
    );
  }

  return (
    <section className="admin-genre-manager">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">CATALOG ORGANIZATION</p>
          <h2>Genres</h2>
          <p>Genres are shared across movies and series.</p>
        </div>
        <span>{genres.length} genres</span>
      </div>

      <form className="admin-genre-create" onSubmit={submit}>
        <label htmlFor="new-genre-name">Add a genre</label>
        <div>
          <input
            id="new-genre-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            placeholder="e.g. Documentary"
            data-testid="input-new-genre"
          />
          <button className="admin-primary-button" disabled={createGenre.isPending} data-testid="button-create-genre">
            {createGenre.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
            Add genre
          </button>
        </div>
      </form>

      {message && (
        <p className={isErrorMessage ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid="status-genre-change">
          {isErrorMessage ? "!" : <Check size={13} />} {message}
        </p>
      )}
      {isError ? (
        <div className="admin-error" role="alert">Genres could not be loaded.</div>
      ) : isLoading ? (
        <div className="admin-loading"><LoaderCircle size={16} className="animate-spin" /> Loading genres…</div>
      ) : genres.length === 0 ? (
        <div className="admin-empty-compact">No genres yet. Add one above.</div>
      ) : (
        <div className="admin-genre-list">
          {genres.map((genre) => (
            <article className="admin-genre-row" key={genre.id} data-testid={`row-genre-${genre.id}`}>
              <div><strong>{genre.name}</strong><small>{genre.slug}</small></div>
              <button className="admin-icon-button danger" aria-label={`Delete ${genre.name}`} onClick={() => remove(genre)} disabled={deleteGenre.isPending} data-testid={`button-delete-genre-${genre.id}`}>
                <Trash2 size={14} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
