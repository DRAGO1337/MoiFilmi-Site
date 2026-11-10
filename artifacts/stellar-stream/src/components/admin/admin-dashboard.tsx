"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAccountQueryKey,
  getGetAdminCatalogQueryKey,
  getGetAdminGenresQueryKey,
  getGetCatalogQueryKey,
  useDeleteTitle,
  useGetAccount,
  useGetAdminCatalog,
  useGetAdminGenres,
  useUpdateTitle,
  type CatalogTitle,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  Check,
  Film,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Tv,
  Upload,
  X,
} from "lucide-react";
import GenreManager from "./genre-manager";
import TitleEditor from "./title-editor";

type TitleKind = "movie" | "series";

export default function AdminDashboard() {
  const { isLoaded, isSignedIn } = useUser();
  const accountQuery = useGetAccount({
    query: {
      enabled: isLoaded && Boolean(isSignedIn),
      queryKey: getGetAccountQueryKey(),
    },
  });

  if (!isLoaded || (isSignedIn && accountQuery.isLoading)) {
    return <main className="admin-page"><div className="admin-loading admin-center"><LoaderCircle size={18} className="animate-spin" /> Checking administrator access…</div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="admin-page">
        <Link href="/" className="admin-back-link"><ArrowLeft size={15} /> Back to MoiFilmi</Link>
        <section className="admin-access-card">
          <ShieldAlert size={25} />
          <h1>Sign in to continue</h1>
          <p>This area is reserved for authorized MoiFilmi administrators.</p>
          <Link className="admin-primary-button" href="/sign-in" data-testid="link-admin-sign-in">Sign in</Link>
        </section>
      </main>
    );
  }

  if (accountQuery.isError) {
    return (
      <main className="admin-page">
        <Link href="/" className="admin-back-link"><ArrowLeft size={15} /> Back to MoiFilmi</Link>
        <div className="admin-error admin-access-error" role="alert">Administrator access could not be verified. Refresh the page to try again.</div>
      </main>
    );
  }

  if (accountQuery.data?.role !== "admin") {
    return (
      <main className="admin-page">
        <Link href="/" className="admin-back-link"><ArrowLeft size={15} /> Back to MoiFilmi</Link>
        <section className="admin-access-card">
          <ShieldAlert size={25} />
          <h1>Administrator access required</h1>
          <p>Your account does not have permission to manage the catalog.</p>
          <Link className="admin-secondary-button" href="/">Return to MoiFilmi</Link>
        </section>
      </main>
    );
  }

  return <AdminWorkspace />;
}

function AdminWorkspace() {
  const queryClient = useQueryClient();
  const catalogQuery = useGetAdminCatalog({
    query: { queryKey: getGetAdminCatalogQueryKey() },
  });
  const genresQuery = useGetAdminGenres({
    query: { queryKey: getGetAdminGenresQueryKey() },
  });
  const updateTitle = useUpdateTitle();
  const deleteTitle = useDeleteTitle();
  const [tab, setTab] = useState<"catalog" | "genres">("catalog");
  const [search, setSearch] = useState("");
  const [createKind, setCreateKind] = useState<TitleKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isNoticeError, setIsNoticeError] = useState(false);

  const titles = catalogQuery.data ?? [];
  const genres = genresQuery.data ?? [];
  const selectedTitle =
    titles.find((title) => title.id === selectedId) ?? null;
  const visibleTitles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return titles;
    return titles.filter((title) =>
      `${title.title} ${title.slug} ${title.genres.join(" ")} ${title.kind}`
        .toLowerCase()
        .includes(term),
    );
  }, [search, titles]);
  const editorOpen = Boolean(createKind || selectedId);

  function refreshCatalog() {
    void queryClient.invalidateQueries({ queryKey: getGetAdminCatalogQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
  }

  function closeEditor() {
    setSelectedId(null);
    setCreateKind(null);
  }

  function onSaved(titleId: string) {
    setCreateKind(null);
    setSelectedId(titleId);
    setIsNoticeError(false);
    setNotice("Catalog entry saved.");
    refreshCatalog();
  }

  function togglePublication(title: CatalogTitle) {
    const nextStatus = title.status === "published" ? "unpublished" : "published";
    updateTitle.mutate(
      { titleId: title.id, data: { status: nextStatus } },
      {
        onSuccess: () => {
          refreshCatalog();
          setNotice(nextStatus === "published" ? `${title.title} is published.` : `${title.title} is unpublished.`);
          setIsNoticeError(false);
        },
        onError: (error) => {
          setNotice(error instanceof Error ? error.message : "Publication status could not be changed.");
          setIsNoticeError(true);
        },
      },
    );
  }

  function removeTitle(title: CatalogTitle) {
    if (!window.confirm(`Delete “${title.title}” and its associated media? This cannot be undone.`)) return;
    deleteTitle.mutate(
      { titleId: title.id },
      {
        onSuccess: () => {
          refreshCatalog();
          if (selectedId === title.id) closeEditor();
          setNotice(`${title.title} was deleted.`);
          setIsNoticeError(false);
        },
        onError: (error) => {
          setNotice(error instanceof Error ? error.message : "Title and media could not be deleted.");
          setIsNoticeError(true);
        },
      },
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link href="/" className="admin-back-link" data-testid="link-admin-home"><ArrowLeft size={15} /> MoiFilmi</Link>
        <div className="admin-user-pill"><span className="admin-access-dot" /> Administrator workspace</div>
      </header>

      <div className="admin-main">
        <header className="admin-page-heading">
          <div>
            <p className="admin-kicker">MOIFILMI · CATALOG OPERATIONS</p>
            <h1>Catalog dashboard</h1>
            <p>Manage published stories, artwork, and streaming assets.</p>
          </div>
          <div className="admin-summary">
            <span><strong>{titles.length}</strong> titles</span>
            <span><strong>{titles.filter((title) => title.status === "published").length}</strong> published</span>
            <span><strong>{genres.length}</strong> genres</span>
          </div>
        </header>

        <div className="admin-workspace">
          <div className="admin-workspace-main">
            <div className="admin-tabs" role="tablist" aria-label="Admin sections">
              <button role="tab" aria-selected={tab === "catalog"} className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")} data-testid="tab-admin-catalog">
                <Film size={14} /> Catalog
              </button>
              <button role="tab" aria-selected={tab === "genres"} className={tab === "genres" ? "active" : ""} onClick={() => setTab("genres")} data-testid="tab-admin-genres">
                <Tv size={14} /> Genres
              </button>
            </div>

            {tab === "catalog" ? (
              <section className="admin-catalog-panel" aria-label="Catalog management">
                <div className="admin-catalog-toolbar">
                  <div>
                    <h2>Titles</h2>
                    <p>Published and unpublished catalog entries.</p>
                  </div>
                  <div className="admin-create-actions">
                    <button className="admin-secondary-button" onClick={() => { setSelectedId(null); setCreateKind("movie"); }} data-testid="button-add-movie"><Plus size={14} /> Add movie</button>
                    <button className="admin-primary-button" onClick={() => { setSelectedId(null); setCreateKind("series"); }} data-testid="button-add-series"><Plus size={14} /> Add series</button>
                  </div>
                </div>
                <label className="admin-search">
                  <Search size={15} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles or genres" aria-label="Search catalog" data-testid="input-admin-search" />
                </label>
                {notice && (
                  <p className={isNoticeError ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid="status-admin-notice">
                    {isNoticeError ? <X size={13} /> : <Check size={13} />} {notice}
                  </p>
                )}
                {catalogQuery.isLoading ? (
                  <div className="admin-loading"><LoaderCircle size={16} className="animate-spin" /> Loading catalog…</div>
                ) : catalogQuery.isError ? (
                  <div className="admin-error" role="alert">
                    Catalog could not be loaded.
                    <button className="admin-quiet-button" onClick={() => void catalogQuery.refetch()} data-testid="button-retry-admin-catalog">Try again</button>
                  </div>
                ) : visibleTitles.length === 0 ? (
                  <div className="admin-empty">
                    <Film size={22} />
                    <h3>{search ? "No matching titles." : "Your catalog is empty."}</h3>
                    <p>{search ? "Try another title, slug, or genre." : "Add a movie or series to start building the collection."}</p>
                  </div>
                ) : (
                  <div className="admin-title-list">
                    {visibleTitles.map((title) => (
                      <article className={`admin-title-row ${selectedId === title.id ? "selected" : ""}`} key={title.id} data-testid={`row-admin-title-${title.id}`}>
                        <button className="admin-title-main" onClick={() => { setCreateKind(null); setSelectedId(title.id); }} data-testid={`button-open-title-${title.id}`}>
                          <span className="admin-title-art">
                            {title.posterUrl ? <img src={title.posterUrl} alt="" /> : <span><Film size={16} /></span>}
                          </span>
                          <span className="admin-title-text">
                            <strong>{title.title}</strong>
                            <small>{title.kind === "movie" ? "Movie" : "Series"} · {title.releaseDate || "No release date"} · {title.genres.join(", ") || "No genres"}</small>
                          </span>
                        </button>
                        <div className="admin-title-state">
                          <span className={`admin-status-chip ${title.status}`}>{title.status}</span>
                          <span className={`admin-status-dot status-${title.videoStatus ?? "missing"}`} title={`Video status: ${title.videoStatus ?? "none"}`} />
                        </div>
                        <div className="admin-title-actions">
                          <button className="admin-quiet-button" onClick={() => togglePublication(title)} disabled={updateTitle.isPending} data-testid={`button-publication-${title.id}`}>
                            {title.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                          <button className="admin-icon-button" aria-label={`Edit ${title.title}`} onClick={() => { setCreateKind(null); setSelectedId(title.id); }} data-testid={`button-edit-title-${title.id}`}><Pencil size={14} /></button>
                          <button className="admin-icon-button danger" aria-label={`Delete ${title.title}`} onClick={() => removeTitle(title)} disabled={deleteTitle.isPending} data-testid={`button-delete-title-${title.id}`}><X size={14} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <GenreManager
                genres={genres}
                isLoading={genresQuery.isLoading}
                isError={genresQuery.isError}
              />
            )}
          </div>

          {editorOpen && (
            <aside className="admin-editor-column">
              {selectedId && !selectedTitle ? (
                <div className="admin-loading"><LoaderCircle size={16} className="animate-spin" /> Loading title details…</div>
              ) : (
                <TitleEditor
                  title={selectedTitle}
                  newKind={createKind}
                  genres={genres}
                  onClose={closeEditor}
                  onSaved={onSaved}
                />
              )}
            </aside>
          )}
        </div>

        <footer className="admin-footer">
          <span><Upload size={13} /> Artwork is stored in Replit App Storage.</span>
          <span>Video uploads and HLS playback use Cloudflare Stream.</span>
        </footer>
      </div>
    </main>
  );
}
