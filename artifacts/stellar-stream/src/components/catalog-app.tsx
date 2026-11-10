"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Film,
  Heart,
  Info,
  Menu,
  Play,
  Plus,
  Search,
  Sparkles,
  Tv,
  X,
} from "lucide-react";
import {
  getGetAccountQueryKey,
  getGetCatalogQueryKey,
  getGetCatalogTitleQueryKey,
  getGetGenresQueryKey,
  getGetWatchProgressQueryKey,
  getGetWatchlistQueryKey,
  useAddWatchlistEntry,
  useDeleteWatchlistEntry,
  useGetAccount,
  useGetCatalog,
  useGetCatalogTitle,
  useGetGenres,
  useGetWatchProgress,
  useGetWatchlist,
  type CatalogTitle,
  type Episode,
  type WatchlistInputEntryKind,
} from "@workspace/api-client-react";
import HlsVideoPlayer from "@/components/hls-video-player";
import { isAnime, titleArtwork, titleDuration, titleYear } from "@/lib/catalog-view";

const navItems = [
  { label: "For you", href: "/", icon: Compass },
  { label: "Films", href: "/films", icon: Film },
  { label: "Series", href: "/series", icon: Tv },
  { label: "Anime", href: "/anime", icon: Sparkles },
  { label: "Discover", href: "/discover", icon: ArrowUpRight },
  { label: "My list", href: "/my-list", icon: Bookmark },
  { label: "Continue", href: "/continue", icon: Play },
];

const watchlistParams = { entryKind: "watchlist" as const };
const favoriteParams = { entryKind: "favorite" as const };
const fallbackHeroGradient =
  "linear-gradient(90deg,rgba(8,11,17,.96) 0%,rgba(8,11,17,.83) 28%,rgba(8,11,17,.28) 59%,rgba(8,11,17,.12) 100%),linear-gradient(0deg,#0d1017 0%,rgba(13,16,23,.03) 38%)";

function cssImage(url: string | null): string {
  if (!url) return fallbackHeroGradient;
  const escaped = url.replace(/["\\\n\r]/g, "\\$&");
  return `${fallbackHeroGradient},url("${escaped}")`;
}

function titleMatches(title: CatalogTitle, query: string) {
  return `${title.title} ${title.genres.join(" ")} ${title.kind} ${title.description}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatProgress(current: number, duration: number): string {
  const minutes = Math.floor(Math.max(0, current) / 60);
  const total = Math.floor(Math.max(0, duration) / 60);
  return `${minutes} of ${total} min`;
}

export default function CatalogApp({ page }: { page: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogTitle | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [watching, setWatching] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  const [slide, setSlide] = useState(0);
  const [genre, setGenre] = useState("All genres");
  const [sort, setSort] = useState("Recommended");
  const [kindFilter, setKindFilter] = useState("Everything");
  const [listKind, setListKind] = useState<WatchlistInputEntryKind>("watchlist");
  const [notice, setNotice] = useState("");

  const catalogParams =
    page === "/search" && query.trim() ? { search: query.trim() } : undefined;
  const catalogQuery = useGetCatalog(catalogParams, {
    query: {
      queryKey: getGetCatalogQueryKey(catalogParams),
    },
  });
  const genresQuery = useGetGenres({
    query: { queryKey: getGetGenresQueryKey() },
  });
  const accountQuery = useGetAccount({
    query: {
      enabled: authLoaded && Boolean(isSignedIn),
      queryKey: getGetAccountQueryKey(),
    },
  });
  const watchlistQuery = useGetWatchlist(watchlistParams, {
    query: {
      enabled: authLoaded && Boolean(isSignedIn),
      queryKey: getGetWatchlistQueryKey(watchlistParams),
    },
  });
  const favoritesQuery = useGetWatchlist(favoriteParams, {
    query: {
      enabled: authLoaded && Boolean(isSignedIn),
      queryKey: getGetWatchlistQueryKey(favoriteParams),
    },
  });
  const progressQuery = useGetWatchProgress({
    query: {
      enabled: authLoaded && Boolean(isSignedIn),
      queryKey: getGetWatchProgressQueryKey(),
    },
  });
  const addEntry = useAddWatchlistEntry();
  const deleteEntry = useDeleteWatchlistEntry();
  const detailQuery = useGetCatalogTitle(selected?.id ?? "", {
    query: {
      enabled: Boolean(selected),
      queryKey: getGetCatalogTitleQueryKey(selected?.id ?? ""),
    },
  });

  const titles = catalogQuery.data ?? [];
  const watchlist = watchlistQuery.data ?? [];
  const favorites = favoritesQuery.data ?? [];
  const progress = progressQuery.data ?? [];
  const activeHref = pathname || "/";
  const activeEntries = listKind === "watchlist" ? watchlist : favorites;
  const selectedDetail = detailQuery.data;
  const selectedSeasons = selectedDetail?.seasons ?? [];
  const playerSource =
    selected?.kind === "movie"
      ? selected.playbackUrl
      : activeEpisode?.playbackUrl ?? null;
  const playerEpisodeId =
    selected?.kind === "series" ? activeEpisode?.id ?? null : null;

  useEffect(() => {
    const syncSearch = () => {
      const params = new URLSearchParams(window.location.search);
      const nextQuery = pathname === "/search" ? params.get("q") || "" : "";
      setQuery(nextQuery);
      setSearchText(nextQuery);
    };
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, [pathname]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const heroItems = useMemo(() => titles.slice(0, 3), [titles]);
  const safeSlide = heroItems.length ? slide % heroItems.length : 0;
  const hero = heroItems[safeSlide];
  const pageTitle: Record<string, string> = {
    "/": "Stories worth staying up for.",
    "/films": "Films for every kind of night.",
    "/series": "A story with room to unfold.",
    "/anime": "Worlds beyond the ordinary.",
    "/discover": "Follow a feeling.",
    "/my-list": "Your saved stories.",
    "/continue": "Pick up where you left off.",
    "/search": query ? `Results for “${query}”` : "Find your next favorite.",
  };
  const pageLabel: Record<string, string> = {
    "/": "A WORLD OF STORIES",
    "/films": "THE FEATURE COLLECTION",
    "/series": "SERIES TO SETTLE INTO",
    "/anime": "ANIMATION, WITHOUT BORDERS",
    "/discover": "A LITTLE CURIOSITY GOES A LONG WAY",
    "/my-list": listKind === "favorite" ? "YOUR FAVORITES" : "KEPT CLOSE FOR LATER",
    "/continue": "YOUR RECENT VIEWING",
    "/search": "SEARCH THE COLLECTION",
  };

  const filtered = useMemo(() => {
    let items: CatalogTitle[] = [];
    if (page === "/my-list") {
      items = activeEntries.map((entry) => entry.title);
    } else {
      items = titles.filter((title) => {
        if (page === "/films") return title.kind === "movie";
        if (page === "/series") return title.kind === "series";
        if (page === "/anime") return isAnime(title);
        if (page === "/search") return query ? titleMatches(title, query) : false;
        return true;
      });
    }

    if (page === "/discover") {
      if (genre !== "All genres") {
        items = items.filter((title) =>
          title.genres.some((name) =>
            name.toLowerCase().includes(genre.toLowerCase()),
          ),
        );
      }
      if (kindFilter === "Films") items = items.filter((title) => title.kind === "movie");
      if (kindFilter === "Series") items = items.filter((title) => title.kind === "series");
      if (kindFilter === "Anime") items = items.filter(isAnime);
    }
    if (page === "/discover" && sort === "Top rated") {
      items = [...items].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    if (page === "/discover" && sort === "Newest") {
      items = [...items].sort((a, b) =>
        (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      );
    }
    return items;
  }, [activeEntries, genre, kindFilter, listKind, page, query, sort, titles]);

  const loadingList =
    page === "/my-list" &&
    Boolean(isSignedIn) &&
    (listKind === "watchlist" ? watchlistQuery.isLoading : favoritesQuery.isLoading);
  const isAuthenticatedCollection =
    (page === "/my-list" || page === "/continue") && !isSignedIn;

  function closeDialog() {
    setSelected(null);
    setActiveEpisode(null);
    setWatching(false);
    setResumeAt(0);
  }

  function openTitle(title: CatalogTitle) {
    setSelected(title);
    setActiveEpisode(null);
    setResumeAt(0);
    setWatching(false);
  }

  function resumeProgressItem(item: (typeof progress)[number]) {
    setSelected(item.title);
    setActiveEpisode(item.episode);
    setResumeAt(item.currentTimeSeconds);
    setWatching(
      Boolean(
        item.episode?.playbackUrl ||
          (item.title.kind === "movie" && item.title.playbackUrl),
      ),
    );
  }

  function startWatching() {
    if (!selected) return;
    if (selected.kind === "series" && !activeEpisode) {
      const firstReady = selectedSeasons
        .flatMap((season) => season.episodes)
        .find((episode) => episode.playbackUrl);
      setActiveEpisode(firstReady ?? null);
    }
    setResumeAt(0);
    setWatching(true);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = searchText.trim();
    setQuery(value);
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    setMobileOpen(false);
  }

  function refreshSavedQueries() {
    void queryClient.invalidateQueries({
      queryKey: getGetWatchlistQueryKey(watchlistParams),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetWatchlistQueryKey(favoriteParams),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetCatalogQueryKey(),
    });
  }

  function toggleEntry(titleId: string, entryKind: WatchlistInputEntryKind) {
    setNotice("");
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    const entries = entryKind === "watchlist" ? watchlist : favorites;
    const exists = entries.some((entry) => entry.titleId === titleId);
    if (exists) {
      deleteEntry.mutate(
        { titleId, entryKind },
        {
          onSuccess: refreshSavedQueries,
          onError: () => setNotice("Your list could not be updated. Try again."),
        },
      );
    } else {
      addEntry.mutate(
        { data: { titleId, entryKind } },
        {
          onSuccess: refreshSavedQueries,
          onError: () => setNotice("Your list could not be updated. Try again."),
        },
      );
    }
  }

  function scrollShelf(direction: -1 | 1) {
    document
      .querySelector(".poster-grid")
      ?.scrollBy({ left: direction * 350, behavior: "smooth" });
  }

  const heroStyle = hero
    ? ({ backgroundImage: cssImage(titleArtwork(hero)) } as CSSProperties)
    : undefined;
  const genres = genresQuery.data ?? [];
  const displayName =
    accountQuery.data?.displayName || user?.firstName || user?.username || "";
  const savedCount = watchlist.length;
  const isSaving = addEntry.isPending || deleteEntry.isPending;

  return (
    <main className="site-shell">
      <header className="topbar">
        <button
          className="mobile-menu icon-button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          data-testid="button-mobile-menu"
        >
          <Menu size={18} />
        </button>
        <Link href="/" className="brand" aria-label="MoiFilmi home" data-testid="link-brand">
          <span className="brand-mark"><Sparkles size={16} /></span>
          <span>MOIFILMI</span>
        </Link>
        <nav className={`nav-links ${mobileOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`nav-item ${activeHref === href ? "active" : ""}`}
              aria-current={activeHref === href ? "page" : undefined}
              data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`}
            >
              <Icon size={14} />
              <span>{label}</span>
              {label === "My list" && savedCount > 0 && <em>{savedCount}</em>}
              {label === "Continue" && progress.length > 0 && <em>{progress.length}</em>}
            </Link>
          ))}
        </nav>
        <div className="top-actions">
          <form className="search-box" onSubmit={submitSearch} role="search">
            <Search size={15} />
            <input
              aria-label="Search catalog"
              placeholder="Search titles, genres…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              data-testid="input-search"
            />
            {searchText && (
              <button
                type="button"
                className="clear-search"
                aria-label="Clear search"
                onClick={() => setSearchText("")}
                data-testid="button-clear-search"
              >
                <X size={13} />
              </button>
            )}
          </form>
          {isSignedIn ? (
            <div className="profile-actions">
              <Link
                href="/account"
                className="avatar"
                aria-label={`Open ${displayName || "your"} account`}
                data-testid="link-account"
              >
                {initials(displayName || "M")}
              </Link>
              <button
                className="sign-out-compact"
                onClick={() => void signOut({ redirectUrl: "/" })}
                data-testid="button-sign-out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link className="sign-in-link" href="/sign-in" data-testid="link-sign-in">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {page === "/" ? (
        hero ? (
          <section className="hero" style={heroStyle}>
            <div className="hero-content" key={hero.id}>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                MOIFILMI SELECTS <span className="eyebrow-dot">·</span> AVAILABLE TO WATCH
              </div>
              <h1>{hero.title}</h1>
              <p className="hero-genre">{hero.genres.join(" · ") || "MoiFilmi collection"}</p>
              <p className="hero-description">{hero.description}</p>
              <div className="metadata">
                <span>{titleYear(hero)}</span>
                <span className="meta-dot" />
                <span className="rating-star">★</span>
                <span>{hero.rating?.toFixed(1) ?? "NR"}</span>
                {hero.videoStatus === "ready" && <span className="rating-tag">READY</span>}
                <span>{titleDuration(hero)}</span>
              </div>
              <div className="hero-buttons">
                <button
                  className="watch-button"
                  onClick={() => openTitle(hero)}
                  data-testid="button-watch-hero"
                >
                  <Play size={15} fill="currentColor" />
                  View title
                </button>
                <button
                  className="round-button"
                  aria-label={`More information about ${hero.title}`}
                  onClick={() => openTitle(hero)}
                  data-testid="button-info-hero"
                >
                  <Info size={17} />
                </button>
                <button
                  className={`round-button ${watchlist.some((entry) => entry.titleId === hero.id) ? "is-saved" : ""}`}
                  aria-label="Add to My list"
                  onClick={() => toggleEntry(hero.id, "watchlist")}
                  data-testid="button-save-hero"
                >
                  {watchlist.some((entry) => entry.titleId === hero.id) ? <Check size={17} /> : <Plus size={18} />}
                </button>
              </div>
            </div>
            <div className="hero-controls">
              <div className="slide-count">
                <span>0{safeSlide + 1}</span><i />0{heroItems.length}
              </div>
              <div className="slide-dots">
                {heroItems.map((item, index) => (
                  <button
                    key={item.id}
                    className={safeSlide === index ? "current" : ""}
                    onClick={() => setSlide(index)}
                    aria-label={`Show featured title ${index + 1}`}
                    data-testid={`button-slide-${index + 1}`}
                  />
                ))}
              </div>
              <div className="hero-arrows">
                <button
                  onClick={() => setSlide((safeSlide + heroItems.length - 1) % heroItems.length)}
                  aria-label="Previous feature"
                  data-testid="button-previous-slide"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  onClick={() => setSlide((safeSlide + 1) % heroItems.length)}
                  aria-label="Next feature"
                  data-testid="button-next-slide"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            <div className="hero-caption">A better story is just around the corner.</div>
          </section>
        ) : (
          <section className="hero hero-empty">
            <div className="hero-content">
              <div className="eyebrow"><span className="eyebrow-line" />THE MOIFILMI COLLECTION</div>
              <h1>Good stories travel.</h1>
              <p className="hero-description">
                Published films and series will appear here when the catalog is ready.
              </p>
              <Link href="/discover" className="watch-button" data-testid="link-empty-catalog">
                Explore the collection <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        )
      ) : (
        <section className={`route-banner route-banner-${page.slice(1) || "home"}`}>
          <div className="route-banner-image" aria-hidden="true" />
          <div className="route-banner-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              MOIFILMI / {page.slice(1).replace("-", " ").toUpperCase() || "HOME"}
            </p>
            <h1>{pageTitle[page]}</h1>
            <p>
              {page === "/discover"
                ? "Browse by genre, format, or the kind of story you need tonight."
                : page === "/my-list"
                  ? "Everything you keep close, together in one place."
                  : page === "/continue"
                    ? "Your saved viewing progress is ready when you are."
                    : page === "/search"
                      ? "A title, a feeling, a world you remember."
                      : "A thoughtful collection, ready when you are."}
            </p>
            {page === "/discover" && (
              <a className="banner-jump" href="#discover-shelves">
                Explore the collection <ArrowRight size={15} />
              </a>
            )}
          </div>
          <span className="route-banner-index">MOIFILMI · 01—07</span>
        </section>
      )}

      {page === "/discover" && (
        <section className="discover-panel" id="discover-shelves" aria-label="Discover filters">
          <div className="discover-intro">
            <span className="shelf-marker" />
            <div><p className="section-kicker">MAKE IT YOUR EVENING</p><h2>What are you in the mood for?</h2></div>
          </div>
          <div className="discover-controls">
            <label>
              Genre
              <select value={genre} onChange={(event) => setGenre(event.target.value)} data-testid="select-genre">
                <option>All genres</option>
                {genres.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <label>
              Format
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} data-testid="select-format">
                {["Everything", "Films", "Series", "Anime"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value)} data-testid="select-sort">
                {["Recommended", "Top rated", "Newest"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <button
              className="filter-reset"
              onClick={() => { setGenre("All genres"); setKindFilter("Everything"); setSort("Recommended"); }}
              data-testid="button-reset-filters"
            >
              Reset filters
            </button>
          </div>
          <div className="mood-shelves">
            <button onClick={() => { setGenre("Mystery"); setKindFilter("Everything"); }} data-testid="mood-mystery">
              A little mystery <span>Clues, secrets & second acts</span>
            </button>
            <button onClick={() => { setGenre("Sci-fi"); setKindFilter("Everything"); }} data-testid="mood-far-away">
              Somewhere far away <span>New worlds, familiar feelings</span>
            </button>
            <button onClick={() => { setGenre("Drama"); setKindFilter("Films"); }} data-testid="mood-slow-burn">
              A slow-burn film <span>Take the scenic route</span>
            </button>
          </div>
        </section>
      )}

      {page === "/" && isSignedIn && progress.length > 0 && (
        <section className="continue-shelf" aria-label="Continue watching">
          <div className="section-heading">
            <div><p className="section-kicker">YOUR RECENT VIEWING</p><h2>Continue watching</h2></div>
            <Link className="view-all" href="/continue" data-testid="link-view-continue">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="continue-grid">
            {progress.slice(0, 4).map((item) => {
              const image = titleArtwork(item.title);
              const percentage = item.durationSeconds
                ? Math.min(100, (item.currentTimeSeconds / item.durationSeconds) * 100)
                : 0;
              return (
                <button
                  className="continue-card"
                  key={item.id}
                  onClick={() => resumeProgressItem(item)}
                  data-testid={`button-continue-${item.id}`}
                >
                  <span className="continue-image">
                    {image ? <img src={image} alt="" loading="lazy" /> : <span className="poster-placeholder" />}
                    <i style={{ width: `${percentage}%` }} />
                    <span className="continue-play"><Play size={14} fill="currentColor" /></span>
                  </span>
                  <strong>{item.episode?.title || item.title.title}</strong>
                  <small>{formatProgress(item.currentTimeSeconds, item.durationSeconds)}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{pageLabel[page]}</p>
            <h2>{pageTitle[page]}</h2>
          </div>
          {page !== "/search" && page !== "/my-list" && page !== "/discover" && page !== "/continue" && (
            <Link className="view-all" href="/discover" data-testid="link-view-discover">
              Discover more <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
        {page === "/my-list" && (
          <div className="list-tabs" role="tablist" aria-label="Personal lists">
            <button
              role="tab"
              aria-selected={listKind === "watchlist"}
              className={listKind === "watchlist" ? "active" : ""}
              onClick={() => setListKind("watchlist")}
              data-testid="tab-watchlist"
            >
              <Bookmark size={14} /> My watchlist
            </button>
            <button
              role="tab"
              aria-selected={listKind === "favorite"}
              className={listKind === "favorite" ? "active" : ""}
              onClick={() => setListKind("favorite")}
              data-testid="tab-favorites"
            >
              <Heart size={14} /> Favorites
            </button>
          </div>
        )}
        <div className="shelf-tools">
          <div className="shelf-label">
            <span className="shelf-marker" />
            {page === "/my-list"
              ? listKind === "favorite" ? "YOUR FAVORITES" : "SAVED FOR LATER"
              : page === "/continue"
                ? "PICK UP WHERE YOU STOPPED"
                : page === "/search"
                  ? "MATCHING STORIES"
                  : page === "/discover"
                    ? `${filtered.length} TITLES · ${sort.toUpperCase()}`
                    : "CURATED FOR YOUR EVENING"}
          </div>
          <div className="shelf-controls">
            <button aria-label="Scroll shelf left" onClick={() => scrollShelf(-1)} data-testid="button-shelf-left"><ChevronLeft size={16} /></button>
            <button aria-label="Scroll shelf right" onClick={() => scrollShelf(1)} data-testid="button-shelf-right"><ChevronRight size={16} /></button>
          </div>
        </div>

        {isAuthenticatedCollection ? (
          <div className="empty-state" data-testid="empty-auth-collection">
            <div className="empty-icon"><Bookmark size={23} /></div>
            <h3>Sign in to keep your stories close.</h3>
            <p>Your watchlist, favorites, and playback progress stay with your account.</p>
            <Link href="/sign-in" className="empty-link" data-testid="link-collection-sign-in">Sign in</Link>
          </div>
        ) : catalogQuery.isError ? (
          <div className="empty-state" role="alert" data-testid="status-catalog-error">
            <div className="empty-icon"><Info size={23} /></div>
            <h3>We couldn’t load the catalog.</h3>
            <p>Check your connection and try again.</p>
            <button onClick={() => void catalogQuery.refetch()} data-testid="button-retry-catalog">Try again</button>
          </div>
        ) : loadingList || (catalogQuery.isLoading && page !== "/continue") ? (
          <div className="loading-grid" aria-label="Loading titles"><i /><i /><i /><i /></div>
        ) : page === "/continue" ? (
          progressQuery.isError ? (
            <div className="empty-state" role="alert" data-testid="status-progress-error">
              <h3>Viewing progress is unavailable.</h3>
              <p>Refresh the page to try again.</p>
              <button onClick={() => void progressQuery.refetch()} data-testid="button-retry-progress">Try again</button>
            </div>
          ) : progress.length > 0 ? (
            <div className="continue-grid continue-grid-full">
              {progress.map((item) => {
                const image = titleArtwork(item.title);
                const percentage = item.durationSeconds
                  ? Math.min(100, (item.currentTimeSeconds / item.durationSeconds) * 100)
                  : 0;
                return (
                  <button className="continue-card" key={item.id} onClick={() => resumeProgressItem(item)} data-testid={`button-continue-${item.id}`}>
                    <span className="continue-image">
                      {image ? <img src={image} alt="" loading="lazy" /> : <span className="poster-placeholder" />}
                      <i style={{ width: `${percentage}%` }} />
                      <span className="continue-play"><Play size={14} fill="currentColor" /></span>
                    </span>
                    <strong>{item.episode?.title || item.title.title}</strong>
                    <small>{item.episode ? `${item.title.title} · ` : ""}{formatProgress(item.currentTimeSeconds, item.durationSeconds)}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state" data-testid="empty-progress">
              <div className="empty-icon"><Play size={23} /></div>
              <h3>Your next story is waiting.</h3>
              <p>Start watching a published title and it will be ready to resume here.</p>
              <Link href="/discover" className="empty-link" data-testid="link-progress-discover">Explore the collection</Link>
            </div>
          )
        ) : filtered.length > 0 ? (
          <div className="poster-grid">
            {filtered.map((title, index) => (
              <article
                className="poster-card"
                key={`${title.id}-${index}`}
                style={{ "--order": index } as CSSProperties}
                data-testid={`card-title-${title.id}`}
              >
                <div
                  className="poster-frame"
                  onClick={() => openTitle(title)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openTitle(title);
                    }
                  }}
                  data-testid={`poster-open-${title.id}`}
                  aria-label={`View ${title.title} details`}
                >
                  {title.posterUrl ? (
                    <img src={title.posterUrl} alt={`${title.title} poster`} loading="lazy" />
                  ) : (
                    <span className="poster-placeholder"><span>{title.title}</span></span>
                  )}
                  <div className="poster-shade" />
                  <span className="card-badge">{title.kind.toUpperCase()}</span>
                  <button
                    className={`card-save ${watchlist.some((entry) => entry.titleId === title.id) ? "saved" : ""}`}
                    aria-label={watchlist.some((entry) => entry.titleId === title.id) ? `Remove ${title.title} from My list` : `Add ${title.title} to My list`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleEntry(title.id, "watchlist");
                    }}
                    disabled={isSaving}
                    data-testid={`button-save-${title.id}`}
                  >
                    {watchlist.some((entry) => entry.titleId === title.id) ? <Check size={15} /> : <Plus size={15} />}
                  </button>
                  <button
                    className="poster-play"
                    aria-label={`View ${title.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openTitle(title);
                    }}
                    data-testid={`button-play-${title.id}`}
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
                <div className="poster-info">
                  <div className="poster-title-line">
                    <h3>{title.title}</h3>
                    <span className="poster-rating">★ {title.rating?.toFixed(1) ?? "NR"}</span>
                  </div>
                  <p>{titleYear(title)}<span>·</span>{title.genres.join(", ") || "Uncategorized"}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state" data-testid="empty-state">
            <div className="empty-icon">{page === "/search" ? <Search size={23} /> : page === "/my-list" ? (listKind === "favorite" ? <Heart size={23} /> : <Bookmark size={23} />) : <Film size={23} />}</div>
            <h3>
              {page === "/my-list"
                ? listKind === "favorite" ? "No favorites yet." : "Your list is waiting for a story."
                : page === "/search"
                  ? query ? "No stories found just yet." : "Search the MoiFilmi collection."
                  : page === "/continue"
                    ? "Your next story is waiting."
                    : page === "/" || page === "/films" || page === "/series" || page === "/anime"
                      ? "No published titles yet."
                      : "No titles match those filters."}
            </h3>
            <p>
              {page === "/my-list"
                ? "Add a title from the collection and it will appear here."
                : page === "/search"
                  ? "Try another title, genre, or a shorter phrase."
                  : page === "/" || page === "/films" || page === "/series" || page === "/anime"
                    ? "The catalog is connected to the database; published titles will show up here."
                    : "Change a filter or reset them to see the full collection."}
            </p>
            {page === "/my-list" ? (
              <Link href="/discover" className="empty-link" data-testid="link-empty-discover">Explore the collection</Link>
            ) : (
              <button
                onClick={() =>
                  page === "/discover"
                    ? (setGenre("All genres"), setKindFilter("Everything"))
                    : (setSearchText(""), router.push("/search"))
                }
                data-testid="button-empty-reset"
              >
                {page === "/discover" ? "Reset filters" : "Clear search"}
              </button>
            )}
          </div>
        )}

        {notice && <p className="list-notice" role="alert" data-testid="status-list-error">{notice}</p>}

        {page === "/" && (
          <div className="collection-note">
            <span className="note-spark"><Sparkles size={20} /></span>
            <div><p>INDEPENDENTLY CURATED</p><span>Stories from the makers and distributors who believe in them.</span></div>
            <span className="note-right">A SMALLER, BETTER WATCHLIST</span>
          </div>
        )}
      </section>

      <footer className="footer">
        <span className="footer-brand">MOIFILMI<span>®</span></span>
        <span>Good stories travel.</span>
        <span className="footer-meta">PUBLISHED STORIES · REAL PROGRESS</span>
      </footer>

      {selected && (
        <div className="modal-backdrop" onClick={closeDialog} role="presentation">
          <section
            className={`detail-modal ${watching ? "watch-mode" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={watching ? `${selected.title} video player` : `${selected.title} details`}
            onClick={(event) => event.stopPropagation()}
            data-testid="dialog-title-detail"
          >
            <button className="modal-close" onClick={closeDialog} aria-label="Close dialog" data-testid="button-close-dialog">
              <X size={18} />
            </button>
            {watching ? (
              <div className="player-screen">
                <div className="player-heading">
                  <p>{selected.title}{activeEpisode ? ` · ${activeEpisode.title}` : ""}</p>
                  {playerSource && (
                    <HlsVideoPlayer
                      key={`${selected.id}-${playerEpisodeId ?? "movie"}-${playerSource}`}
                      src={playerSource}
                      titleId={selected.id}
                      episodeId={playerEpisodeId}
                      resumeAt={resumeAt}
                      signedIn={Boolean(isSignedIn)}
                    />
                  )}
                  {!playerSource && (
                    <div className="player-unavailable" role="status" data-testid="status-video-unavailable">
                      <Play size={25} />
                      <h2>Video isn’t ready yet.</h2>
                      <p>This title will be playable after an administrator publishes its video.</p>
                      <button onClick={() => setWatching(false)} data-testid="button-player-back">Back to details</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="detail-art"
                  style={{ backgroundImage: cssImage(titleArtwork(selected)) }}
                />
                <div className="detail-copy">
                  <div className="eyebrow">
                    <span className="eyebrow-line" />{selected.kind.toUpperCase()}
                    <span className="eyebrow-dot">·</span>{selected.genres.join(" · ") || "MOIFILMI"}
                  </div>
                  <h2>{selected.title}</h2>
                  <div className="metadata">
                    <span>{titleYear(selected)}</span>
                    <span className="meta-dot" />
                    <span className="rating-star">★</span>
                    <span>{selected.rating?.toFixed(1) ?? "NR"}</span>
                    <span>{titleDuration(selected)}</span>
                  </div>
                  <p>{selected.description}</p>
                  {selected.kind === "series" && (
                    <div className="episode-list">
                      <div className="episode-list-heading">
                        <h3>Episodes</h3>
                        {detailQuery.isLoading && <span>Loading…</span>}
                      </div>
                      {selectedSeasons.length === 0 && !detailQuery.isLoading ? (
                        <p className="episode-empty">Episodes will appear here when they are added.</p>
                      ) : selectedSeasons.map((season) => (
                        <div className="season-block" key={season.id}>
                          <h4>{season.title || `Season ${season.seasonNumber}`}</h4>
                          {season.episodes.map((episode) => (
                            <div className="episode-row" key={episode.id}>
                              <div>
                                <strong>{String(episode.episodeNumber).padStart(2, "0")} · {episode.title}</strong>
                                <p>{episode.description}</p>
                                <small>{episode.videoStatus ?? "No video"} · {episode.durationSeconds ? titleDuration({ ...selected, durationSeconds: episode.durationSeconds }) : "Duration unavailable"}</small>
                              </div>
                              <button
                                aria-label={`Play ${episode.title}`}
                                disabled={!episode.playbackUrl}
                                onClick={() => {
                                  setActiveEpisode(episode);
                                  setResumeAt(0);
                                  setWatching(true);
                                }}
                                data-testid={`button-play-episode-${episode.id}`}
                              >
                                <Play size={14} fill="currentColor" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="detail-actions">
                    <button
                      className="watch-button"
                      onClick={startWatching}
                      disabled={selected.kind === "movie" && !selected.playbackUrl}
                      data-testid="button-watch-detail"
                    >
                      <Play size={15} fill="currentColor" />
                      {selected.kind === "movie" && !selected.playbackUrl ? "Video unavailable" : "Watch title"}
                    </button>
                    <button
                      className={`detail-list-button ${watchlist.some((entry) => entry.titleId === selected.id) ? "is-saved" : ""}`}
                      onClick={() => toggleEntry(selected.id, "watchlist")}
                      disabled={isSaving}
                      data-testid="button-save-detail"
                    >
                      {watchlist.some((entry) => entry.titleId === selected.id) ? <Check size={16} /> : <Plus size={16} />}
                      {watchlist.some((entry) => entry.titleId === selected.id) ? "In my list" : "Add to my list"}
                    </button>
                    <button
                      className={`detail-list-button ${favorites.some((entry) => entry.titleId === selected.id) ? "is-saved" : ""}`}
                      onClick={() => toggleEntry(selected.id, "favorite")}
                      disabled={isSaving}
                      data-testid="button-favorite-detail"
                    >
                      <Heart size={15} fill={favorites.some((entry) => entry.titleId === selected.id) ? "currentColor" : "none"} />
                      {favorites.some((entry) => entry.titleId === selected.id) ? "Favorited" : "Favorite"}
                    </button>
                  </div>
                  <div className="rights-note">
                    <span className="rights-dot" /> Published in the MoiFilmi catalog
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
