"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminCatalogQueryKey,
  getGetAdminSeriesDetailQueryKey,
  useCreateEpisode,
  useCreateSeason,
  useDeleteEpisode,
  useDeleteSeason,
  useGetAdminSeriesDetail,
  useUpdateEpisode,
  useUpdateSeason,
  type Episode,
  type SeasonDetail,
} from "@workspace/api-client-react";
import { Check, ChevronDown, ChevronUp, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { VideoUploader } from "./media-uploader";

type SeasonDraft = { seasonNumber: number; title: string; description: string };
type EpisodeDraft = {
  episodeNumber: number;
  title: string;
  description: string;
  releaseDate: string | null;
  durationSeconds: number;
};

const emptySeason: SeasonDraft = { seasonNumber: 1, title: "", description: "" };
const emptyEpisode: EpisodeDraft = {
  episodeNumber: 1,
  title: "",
  description: "",
  releaseDate: null,
  durationSeconds: 0,
};

export default function SeriesManager({ seriesId }: { seriesId: string }) {
  const queryClient = useQueryClient();
  const seriesQuery = useGetAdminSeriesDetail(seriesId, {
    query: {
      enabled: Boolean(seriesId),
      queryKey: getGetAdminSeriesDetailQueryKey(seriesId),
    },
  });
  const createSeason = useCreateSeason();
  const updateSeason = useUpdateSeason();
  const deleteSeason = useDeleteSeason();
  const createEpisode = useCreateEpisode();
  const updateEpisode = useUpdateEpisode();
  const deleteEpisode = useDeleteEpisode();
  const [seasonDraft, setSeasonDraft] = useState<SeasonDraft>(emptySeason);
  const [editingSeason, setEditingSeason] = useState<string | null>(null);
  const [editingSeasonDraft, setEditingSeasonDraft] = useState<SeasonDraft>(emptySeason);
  const [addingEpisodeTo, setAddingEpisodeTo] = useState<string | null>(null);
  const [episodeDraft, setEpisodeDraft] = useState<EpisodeDraft>(emptyEpisode);
  const [editingEpisode, setEditingEpisode] = useState<string | null>(null);
  const [editingEpisodeDraft, setEditingEpisodeDraft] = useState<EpisodeDraft>(emptyEpisode);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: getGetAdminSeriesDetailQueryKey(seriesId),
    });
    void queryClient.invalidateQueries({ queryKey: getGetAdminCatalogQueryKey() });
  }

  function fail(error: unknown) {
    setIsError(true);
    setMessage(error instanceof Error ? error.message : "The change could not be saved.");
  }

  function created() {
    setIsError(false);
    setMessage("Saved.");
    refresh();
  }

  function submitSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    createSeason.mutate(
      { seriesId, data: seasonDraft },
      {
        onSuccess: () => {
          created();
          setSeasonDraft({ seasonNumber: (seriesQuery.data?.seasons.length ?? 0) + 2, title: "", description: "" });
        },
        onError: fail,
      },
    );
  }

  function submitEpisode(event: FormEvent<HTMLFormElement>, seasonId: string) {
    event.preventDefault();
    setMessage("");
    createEpisode.mutate(
      { seasonId, data: episodeDraft },
      {
        onSuccess: () => {
          created();
          setEpisodeDraft(emptyEpisode);
          setAddingEpisodeTo(null);
        },
        onError: fail,
      },
    );
  }

  function saveSeason(event: FormEvent<HTMLFormElement>, seasonId: string) {
    event.preventDefault();
    updateSeason.mutate(
      { seasonId, data: editingSeasonDraft },
      {
        onSuccess: () => {
          created();
          setEditingSeason(null);
        },
        onError: fail,
      },
    );
  }

  function saveEpisode(event: FormEvent<HTMLFormElement>, episodeId: string) {
    event.preventDefault();
    updateEpisode.mutate(
      { episodeId, data: editingEpisodeDraft },
      {
        onSuccess: () => {
          created();
          setEditingEpisode(null);
        },
        onError: fail,
      },
    );
  }

  function beginEditSeason(season: SeasonDetail) {
    setEditingSeason(season.id);
    setEditingSeasonDraft({
      seasonNumber: season.seasonNumber,
      title: season.title,
      description: season.description,
    });
  }

  function beginEditEpisode(episode: Episode) {
    setEditingEpisode(episode.id);
    setEditingEpisodeDraft({
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      description: episode.description,
      releaseDate: episode.releaseDate,
      durationSeconds: episode.durationSeconds,
    });
  }

  function removeSeason(season: SeasonDetail) {
    if (!window.confirm(`Delete ${season.title || `Season ${season.seasonNumber}`} and all its episodes?`)) return;
    deleteSeason.mutate(
      { seasonId: season.id },
      { onSuccess: created, onError: fail },
    );
  }

  function removeEpisode(episode: Episode) {
    if (!window.confirm(`Delete “${episode.title}”?`)) return;
    deleteEpisode.mutate(
      { episodeId: episode.id },
      { onSuccess: created, onError: fail },
    );
  }

  if (seriesQuery.isLoading) {
    return <div className="admin-loading"><LoaderCircle size={16} className="animate-spin" /> Loading seasons and episodes…</div>;
  }
  if (seriesQuery.isError || !seriesQuery.data) {
    return <div className="admin-error" role="alert">Could not load series contents. Refresh the page and try again.</div>;
  }

  const seasons = seriesQuery.data.seasons;

  return (
    <section className="series-manager" aria-label="Series seasons and episodes">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">SERIES CONTENT</p>
          <h3>Seasons & episodes</h3>
        </div>
        <span>{seasons.length} seasons</span>
      </div>

      <form className="admin-inline-form admin-season-create" onSubmit={submitSeason}>
        <div className="admin-form-title"><Plus size={14} /> Add a season</div>
        <div className="admin-form-grid admin-form-grid-three">
          <label>Season number<input type="number" min={1} value={seasonDraft.seasonNumber} onChange={(event) => setSeasonDraft({ ...seasonDraft, seasonNumber: Number(event.target.value) })} required data-testid="input-season-number" /></label>
          <label>Season title<input value={seasonDraft.title} onChange={(event) => setSeasonDraft({ ...seasonDraft, title: event.target.value })} placeholder="Season 1" maxLength={200} data-testid="input-season-title" /></label>
          <label>Description<input value={seasonDraft.description} onChange={(event) => setSeasonDraft({ ...seasonDraft, description: event.target.value })} maxLength={10000} data-testid="input-season-description" /></label>
        </div>
        <button className="admin-primary-button" type="submit" disabled={createSeason.isPending} data-testid="button-create-season">
          {createSeason.isPending ? "Saving…" : "Add season"}
        </button>
      </form>

      {seasons.length === 0 ? (
        <div className="admin-empty-compact">No seasons yet. Add a season to start organizing episodes.</div>
      ) : (
        <div className="admin-season-list">
          {seasons.map((season) => (
            <details className="admin-season" key={season.id} open>
              <summary>
                <span><ChevronDown className="season-chevron-open" size={15} /><ChevronUp className="season-chevron-closed" size={15} /> {season.title || `Season ${season.seasonNumber}`}</span>
                <small>{season.episodes.length} episodes</small>
              </summary>
              <div className="admin-season-content">
                {editingSeason === season.id ? (
                  <form className="admin-inline-form" onSubmit={(event) => saveSeason(event, season.id)}>
                    <div className="admin-form-grid admin-form-grid-three">
                      <label>Season number<input type="number" min={1} value={editingSeasonDraft.seasonNumber} onChange={(event) => setEditingSeasonDraft({ ...editingSeasonDraft, seasonNumber: Number(event.target.value) })} required data-testid={`input-edit-season-number-${season.id}`} /></label>
                      <label>Title<input value={editingSeasonDraft.title} onChange={(event) => setEditingSeasonDraft({ ...editingSeasonDraft, title: event.target.value })} maxLength={200} data-testid={`input-edit-season-title-${season.id}`} /></label>
                      <label>Description<input value={editingSeasonDraft.description} onChange={(event) => setEditingSeasonDraft({ ...editingSeasonDraft, description: event.target.value })} maxLength={10000} data-testid={`input-edit-season-description-${season.id}`} /></label>
                    </div>
                    <div className="admin-row-actions">
                      <button className="admin-primary-button" type="submit" disabled={updateSeason.isPending} data-testid={`button-save-season-${season.id}`}>Save season</button>
                      <button className="admin-quiet-button" type="button" onClick={() => setEditingSeason(null)} data-testid={`button-cancel-season-${season.id}`}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="admin-season-meta">
                    <p>{season.description || "No description provided."}</p>
                    <div className="admin-row-actions">
                      <button className="admin-quiet-button" onClick={() => beginEditSeason(season)} data-testid={`button-edit-season-${season.id}`}><Pencil size={13} /> Edit season</button>
                      <button className="admin-quiet-button danger" onClick={() => removeSeason(season)} data-testid={`button-delete-season-${season.id}`}><Trash2 size={13} /> Delete season</button>
                    </div>
                  </div>
                )}

                {season.episodes.map((episode) => (
                  <article className="admin-episode" key={episode.id}>
                    {editingEpisode === episode.id ? (
                      <form className="admin-inline-form" onSubmit={(event) => saveEpisode(event, episode.id)}>
                        <div className="admin-form-grid admin-form-grid-three">
                          <label>Episode number<input type="number" min={1} value={editingEpisodeDraft.episodeNumber} onChange={(event) => setEditingEpisodeDraft({ ...editingEpisodeDraft, episodeNumber: Number(event.target.value) })} required data-testid={`input-edit-episode-number-${episode.id}`} /></label>
                          <label>Title<input value={editingEpisodeDraft.title} onChange={(event) => setEditingEpisodeDraft({ ...editingEpisodeDraft, title: event.target.value })} required maxLength={200} data-testid={`input-edit-episode-title-${episode.id}`} /></label>
                          <label>Release date<input type="date" value={editingEpisodeDraft.releaseDate ?? ""} onChange={(event) => setEditingEpisodeDraft({ ...editingEpisodeDraft, releaseDate: event.target.value || null })} data-testid={`input-edit-episode-date-${episode.id}`} /></label>
                          <label>Duration (seconds)<input type="number" min={0} value={editingEpisodeDraft.durationSeconds} onChange={(event) => setEditingEpisodeDraft({ ...editingEpisodeDraft, durationSeconds: Number(event.target.value) })} data-testid={`input-edit-episode-duration-${episode.id}`} /></label>
                          <label className="admin-span-two">Description<textarea value={editingEpisodeDraft.description} onChange={(event) => setEditingEpisodeDraft({ ...editingEpisodeDraft, description: event.target.value })} maxLength={10000} rows={2} data-testid={`input-edit-episode-description-${episode.id}`} /></label>
                        </div>
                        <div className="admin-row-actions">
                          <button className="admin-primary-button" type="submit" disabled={updateEpisode.isPending} data-testid={`button-save-episode-${episode.id}`}>Save episode</button>
                          <button className="admin-quiet-button" type="button" onClick={() => setEditingEpisode(null)} data-testid={`button-cancel-episode-${episode.id}`}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="admin-episode-heading">
                          <div>
                            <strong>{String(episode.episodeNumber).padStart(2, "0")} · {episode.title}</strong>
                            <p>{episode.description || "No description provided."}</p>
                            <small>{episode.releaseDate || "No release date"} · {episode.durationSeconds} sec · {episode.videoStatus ?? "No video"}</small>
                          </div>
                          <div className="admin-row-actions">
                            <button className="admin-icon-button" aria-label={`Edit ${episode.title}`} onClick={() => beginEditEpisode(episode)} data-testid={`button-edit-episode-${episode.id}`}><Pencil size={13} /></button>
                            <button className="admin-icon-button danger" aria-label={`Delete ${episode.title}`} onClick={() => removeEpisode(episode)} data-testid={`button-delete-episode-${episode.id}`}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <VideoUploader
                          titleId={seriesId}
                          episodeId={episode.id}
                          status={episode.videoStatus}
                          playbackUrl={episode.playbackUrl}
                        />
                      </>
                    )}
                  </article>
                ))}

                {addingEpisodeTo === season.id ? (
                  <form className="admin-inline-form admin-episode-create" onSubmit={(event) => submitEpisode(event, season.id)}>
                    <div className="admin-form-title"><Plus size={14} /> Add an episode</div>
                    <div className="admin-form-grid admin-form-grid-three">
                      <label>Episode number<input type="number" min={1} value={episodeDraft.episodeNumber} onChange={(event) => setEpisodeDraft({ ...episodeDraft, episodeNumber: Number(event.target.value) })} required data-testid={`input-episode-number-${season.id}`} /></label>
                      <label>Title<input value={episodeDraft.title} onChange={(event) => setEpisodeDraft({ ...episodeDraft, title: event.target.value })} required maxLength={200} data-testid={`input-episode-title-${season.id}`} /></label>
                      <label>Release date<input type="date" value={episodeDraft.releaseDate ?? ""} onChange={(event) => setEpisodeDraft({ ...episodeDraft, releaseDate: event.target.value || null })} data-testid={`input-episode-date-${season.id}`} /></label>
                      <label>Duration (seconds)<input type="number" min={0} value={episodeDraft.durationSeconds} onChange={(event) => setEpisodeDraft({ ...episodeDraft, durationSeconds: Number(event.target.value) })} data-testid={`input-episode-duration-${season.id}`} /></label>
                      <label className="admin-span-two">Description<textarea value={episodeDraft.description} onChange={(event) => setEpisodeDraft({ ...episodeDraft, description: event.target.value })} maxLength={10000} rows={2} data-testid={`input-episode-description-${season.id}`} /></label>
                    </div>
                    <div className="admin-row-actions">
                      <button className="admin-primary-button" type="submit" disabled={createEpisode.isPending} data-testid={`button-create-episode-${season.id}`}>{createEpisode.isPending ? "Saving…" : "Add episode"}</button>
                      <button className="admin-quiet-button" type="button" onClick={() => setAddingEpisodeTo(null)} data-testid={`button-cancel-episode-create-${season.id}`}><X size={13} /> Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="admin-add-episode" onClick={() => { setEpisodeDraft({ ...emptyEpisode, episodeNumber: season.episodes.length + 1 }); setAddingEpisodeTo(season.id); }} data-testid={`button-add-episode-${season.id}`}>
                    <Plus size={14} /> Add episode
                  </button>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {message && (
        <p className={isError ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid="status-series-save">
          {isError ? <X size={13} /> : <Check size={13} />} {message}
        </p>
      )}
    </section>
  );
}
