"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronLeft, ChevronRight, Compass, Film, Info, Menu, Play, Plus, Search, Sparkles, Tv, Volume2, X } from "lucide-react";
import { catalog, genres, type CatalogTitle } from "@/data/catalog";

const navItems = [
  { label: "For you", href: "/", icon: Compass },
  { label: "Films", href: "/films", icon: Film },
  { label: "Series", href: "/series", icon: Tv },
  { label: "Anime", href: "/anime", icon: Sparkles },
  { label: "Discover", href: "/discover", icon: ArrowUpRight },
  { label: "My list", href: "/my-list", icon: Bookmark },
];
const storageKey = "moifilmi-watchlist";

function titleMatches(title: CatalogTitle, query: string) {
  return `${title.title} ${title.genre} ${title.kind} ${title.description}`.toLowerCase().includes(query.trim().toLowerCase());
}

export default function CatalogApp({ page }: { page: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [saved, setSaved] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogTitle | null>(null);
  const [watching, setWatching] = useState(false);
  const [slide, setSlide] = useState(0);
  const [genre, setGenre] = useState("All genres");
  const [sort, setSort] = useState("Recommended");
  const [kindFilter, setKindFilter] = useState("Everything");

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(parsed)) setSaved(parsed.filter((id): id is string => typeof id === "string"));
    } catch { setSaved([]); }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [saved, hydrated]);
  useEffect(() => {
    const syncSearch = () => {
      const params = new URLSearchParams(window.location.search);
      const nextQuery = pathname === "/search" ? (params.get("q") || "") : "";
      setQuery(nextQuery);
      setSearchText(nextQuery);
    };
    syncSearch();
    window.addEventListener("popstate", syncSearch);
    return () => window.removeEventListener("popstate", syncSearch);
  }, [pathname]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeDialog(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [selected]);

  function toggleSaved(id: string) {
    setSaved(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  }
  function closeDialog() { setSelected(null); setWatching(false); }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = searchText.trim();
    setQuery(value);
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
    setMobileOpen(false);
  }

  const heroItems = [catalog[0], catalog[3], catalog[1]];
  const hero = heroItems[slide];
  const pageTitle: Record<string, string> = {
    "/": "Stories worth staying up for.",
    "/films": "Films for every kind of night.",
    "/series": "A story with room to unfold.",
    "/anime": "Worlds beyond the ordinary.",
    "/discover": "Follow a feeling.",
    "/my-list": "Your saved stories.",
    "/search": query ? `Results for “${query}”` : "Find your next favorite.",
  };
  const pageLabel: Record<string, string> = {
    "/": "A WORLD OF STORIES", "/films": "THE FEATURE COLLECTION", "/series": "SERIES TO SETTLE INTO",
    "/anime": "ANIMATION, WITHOUT BORDERS", "/discover": "A LITTLE CURIOSITY GOES A LONG WAY",
    "/my-list": "KEPT CLOSE FOR LATER", "/search": "SEARCH THE COLLECTION",
  };
  const filtered = useMemo(() => {
    let items = catalog.filter(title => {
      if (page === "/films") return title.kind === "Film";
      if (page === "/series") return title.kind === "Series";
      if (page === "/anime") return title.kind === "Anime";
      if (page === "/my-list") return hydrated && saved.includes(title.id);
      if (page === "/search") return query ? titleMatches(title, query) : false;
      return true;
    });
    if (page === "/discover") {
      if (genre !== "All genres") items = items.filter(title => title.genre.toLowerCase().includes(genre.toLowerCase()));
      if (kindFilter !== "Everything") items = items.filter(title => title.kind === kindFilter.slice(0, -1) || title.kind === kindFilter);
    }
    if (page === "/discover" && sort === "Top rated") items = [...items].sort((a, b) => Number(b.rating) - Number(a.rating));
    if (page === "/discover" && sort === "Newest") items = [...items].sort((a, b) => Number(b.year) - Number(a.year));
    return items;
  }, [page, query, saved, hydrated, genre, kindFilter, sort]);
  const activeHref = pathname || "/";

  return <main className="site-shell">
    <header className="topbar">
      <button className="mobile-menu icon-button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)} data-testid="button-mobile-menu"><Menu size={18}/></button>
      <Link href="/" className="brand" aria-label="MoiFilmi home" data-testid="link-brand"><span className="brand-mark"><Sparkles size={16}/></span><span>MOIFILMI</span></Link>
      <nav className={`nav-links ${mobileOpen ? "nav-open" : ""}`} aria-label="Main navigation">
        {navItems.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-item ${activeHref === href ? "active" : ""}`} aria-current={activeHref === href ? "page" : undefined} data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`}><Icon size={14}/><span>{label}</span>{label === "My list" && hydrated && saved.length > 0 && <em>{saved.length}</em>}</Link>)}
      </nav>
      <div className="top-actions">
        <form className="search-box" onSubmit={submitSearch} role="search">
          <Search size={15}/><input aria-label="Search catalog" placeholder="Search titles, genres…" value={searchText} onChange={event => setSearchText(event.target.value)} data-testid="input-search"/>
          {searchText && <button type="button" className="clear-search" aria-label="Clear search" onClick={() => setSearchText("")} data-testid="button-clear-search"><X size={13}/></button>}
        </form><span className="avatar" aria-label="Guest profile">M</span>
      </div>
    </header>

    {page === "/" ? <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,11,17,.96) 0%,rgba(8,11,17,.83) 28%,rgba(8,11,17,.28) 59%,rgba(8,11,17,.12) 100%),linear-gradient(0deg,#0d1017 0%,rgba(13,16,23,.03) 38%),url('${hero.image}')` }}>
      <div className="hero-content" key={hero.id}><div className="eyebrow"><span className="eyebrow-line"/>{hero.badge || "MOIFILMI SELECTS"}<span className="eyebrow-dot">·</span> AVAILABLE TO WATCH</div><h1>{hero.title}</h1><p className="hero-genre">{hero.genre}</p><p className="hero-description">{hero.description}</p><div className="metadata"><span>{hero.year}</span><span className="meta-dot"/><span className="rating-star">★</span><span>{hero.rating}</span><span className="rating-tag">4K</span><span>{hero.duration}</span></div><div className="hero-buttons"><button className="watch-button" onClick={() => { setSelected(hero); setWatching(true); }} data-testid="button-watch-hero"><Play size={15} fill="currentColor"/> Watch preview</button><button className="round-button" aria-label={`More information about ${hero.title}`} onClick={() => setSelected(hero)} data-testid="button-info-hero"><Info size={17}/></button><button className={`round-button ${saved.includes(hero.id) ? "is-saved" : ""}`} aria-label={saved.includes(hero.id) ? "Remove from My list" : "Add to My list"} onClick={() => toggleSaved(hero.id)} data-testid="button-save-hero">{saved.includes(hero.id) ? <Check size={17}/> : <Plus size={18}/>}</button></div></div>
      <div className="hero-controls"><div className="slide-count"><span>0{slide + 1}</span><i/>03</div><div className="slide-dots">{heroItems.map((item, index) => <button key={item.id} className={slide === index ? "current" : ""} onClick={() => setSlide(index)} aria-label={`Show featured title ${index + 1}`} data-testid={`button-slide-${index + 1}`}/>)}</div><div className="hero-arrows"><button onClick={() => setSlide((slide + 2) % 3)} aria-label="Previous feature" data-testid="button-previous-slide"><ChevronLeft size={17}/></button><button onClick={() => setSlide((slide + 1) % 3)} aria-label="Next feature" data-testid="button-next-slide"><ChevronRight size={17}/></button></div></div>
      <div className="hero-caption">A better story is just around the corner.</div>
    </section> : <section className={`route-banner route-banner-${page.slice(1) || "home"}`}><div className="route-banner-image" aria-hidden="true"/><div className="route-banner-copy"><p className="eyebrow"><span className="eyebrow-line"/>MOIFILMI / {page.slice(1).replace("-", " ").toUpperCase() || "HOME"}</p><h1>{pageTitle[page]}</h1><p>{page === "/discover" ? "Browse by mood, genre, or the kind of story you need tonight." : page === "/my-list" ? "Everything you have saved, together in one place." : page === "/search" ? "A title, a feeling, a world you remember." : "A thoughtful collection, ready when you are."}</p>{page === "/discover" && <a className="banner-jump" href="#discover-shelves">Explore the collection <ArrowRight size={15}/></a>}</div><span className="route-banner-index">MOIFILMI · 01—07</span></section>}

    {page === "/discover" && <section className="discover-panel" id="discover-shelves" aria-label="Discover filters">
      <div className="discover-intro"><span className="shelf-marker"/><div><p className="section-kicker">MAKE IT YOUR EVENING</p><h2>What are you in the mood for?</h2></div></div>
      <div className="discover-controls"><label>Genre<select value={genre} onChange={event => setGenre(event.target.value)} data-testid="select-genre">{genres.map(item => <option key={item}>{item}</option>)}</select></label><label>Format<select value={kindFilter} onChange={event => setKindFilter(event.target.value)} data-testid="select-format">{["Everything", "Films", "Series", "Anime"].map(item => <option key={item}>{item}</option>)}</select></label><label>Sort by<select value={sort} onChange={event => setSort(event.target.value)} data-testid="select-sort">{["Recommended", "Top rated", "Newest"].map(item => <option key={item}>{item}</option>)}</select></label><button className="filter-reset" onClick={() => { setGenre("All genres"); setKindFilter("Everything"); setSort("Recommended"); }} data-testid="button-reset-filters">Reset filters</button></div>
      <div className="mood-shelves"><button onClick={() => { setGenre("Mystery"); setKindFilter("Everything"); }} data-testid="mood-mystery">A little mystery <span>Clues, secrets & second acts</span></button><button onClick={() => { setGenre("Sci-fi"); setKindFilter("Everything"); }} data-testid="mood-far-away">Somewhere far away <span>New worlds, familiar feelings</span></button><button onClick={() => { setGenre("Drama"); setKindFilter("Films"); }} data-testid="mood-slow-burn">A slow-burn film <span>Take the scenic route</span></button></div>
    </section>}

    <section className="catalog-section">
      <div className="section-heading"><div><p className="section-kicker">{pageLabel[page]}</p><h2>{pageTitle[page]}</h2></div>{page !== "/search" && page !== "/my-list" && page !== "/discover" && <Link className="view-all" href="/discover" data-testid="link-view-discover">Discover more <ArrowUpRight size={15}/></Link>}</div>
      <div className="shelf-tools"><div className="shelf-label"><span className="shelf-marker"/>{page === "/my-list" ? "SAVED FOR LATER" : page === "/search" ? "MATCHING STORIES" : page === "/discover" ? `${filtered.length} TITLES · ${sort.toUpperCase()}` : "CURATED FOR YOUR EVENING"}</div><div className="shelf-controls"><button aria-label="Scroll shelf left" onClick={() => document.querySelector(".poster-grid")?.scrollBy({ left: -350, behavior: "smooth" })} data-testid="button-shelf-left"><ChevronLeft size={16}/></button><button aria-label="Scroll shelf right" onClick={() => document.querySelector(".poster-grid")?.scrollBy({ left: 350, behavior: "smooth" })} data-testid="button-shelf-right"><ChevronRight size={16}/></button></div></div>
      {page === "/my-list" && !hydrated ? <div className="loading-grid" aria-label="Loading your saved titles"><i/><i/><i/><i/></div> : filtered.length > 0 ? <div className="poster-grid">{filtered.map((title, index) => <article className="poster-card" key={title.id} style={{ "--order": index } as CSSProperties} data-testid={`card-title-${title.id}`}><div className="poster-frame" onClick={() => setSelected(title)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(title); } }} data-testid={`poster-open-${title.id}`} aria-label={`View ${title.title} details`}><img src={title.image} alt={`${title.title} cinematic artwork`}/><div className="poster-shade"/><span className="card-badge">{title.kind.toUpperCase()}</span><button className={`card-save ${saved.includes(title.id) ? "saved" : ""}`} aria-label={saved.includes(title.id) ? `Remove ${title.title} from My list` : `Add ${title.title} to My list`} onClick={event => { event.stopPropagation(); toggleSaved(title.id); }} data-testid={`button-save-${title.id}`}>{saved.includes(title.id) ? <Check size={15}/> : <Plus size={15}/>}</button><button className="poster-play" aria-label={`Watch preview of ${title.title}`} onClick={event => { event.stopPropagation(); setSelected(title); setWatching(true); }} data-testid={`button-play-${title.id}`}><Play size={14} fill="currentColor"/></button></div><div className="poster-info"><div className="poster-title-line"><h3>{title.title}</h3><span className="poster-rating">★ {title.rating}</span></div><p>{title.year}<span>·</span>{title.genre}</p></div></article>)}</div> : <div className="empty-state" data-testid="empty-state"><div className="empty-icon">{page === "/search" ? <Search size={23}/> : <Bookmark size={23}/>}</div><h3>{page === "/my-list" ? "Your list is waiting for a story." : page === "/search" ? (query ? "No stories found just yet." : "Search the MoiFilmi collection.") : "No titles match those filters."}</h3><p>{page === "/my-list" ? "Save films, series, and anime with the plus button. They will be right here when you return." : page === "/search" ? "Try another title, genre, or a shorter phrase." : "Change a filter or reset them to see the full collection."}</p>{page === "/my-list" ? <Link href="/discover" className="empty-link" data-testid="link-empty-discover">Explore the collection</Link> : <button onClick={() => page === "/discover" ? (setGenre("All genres"), setKindFilter("Everything")) : (setSearchText(""), router.push("/search"))} data-testid="button-empty-reset">{page === "/discover" ? "Reset filters" : "Clear search"}</button>}</div>}
      {page === "/" && <div className="collection-note"><span className="note-spark"><Sparkles size={20}/></span><div><p>INDEPENDENTLY CURATED</p><span>Stories from the makers and distributors who believe in them.</span></div><span className="note-right">A SMALLER, BETTER WATCHLIST</span></div>}
    </section>
    <footer className="footer"><span className="footer-brand">MOIFILMI<span>®</span></span><span>Good stories travel.</span><span className="footer-meta">DEMO CATALOG · PREVIEW PLAYER</span></footer>

    {selected && <div className="modal-backdrop" onClick={closeDialog} role="presentation"><section className={`detail-modal ${watching ? "watch-mode" : ""}`} role="dialog" aria-modal="true" aria-label={watching ? `${selected.title} demo preview` : `${selected.title} details`} onClick={event => event.stopPropagation()} data-testid="dialog-title-detail"><button className="modal-close" onClick={closeDialog} aria-label="Close dialog" data-testid="button-close-dialog"><X size={18}/></button>{watching ? <div className="player-screen" style={{ backgroundImage: `linear-gradient(0deg,rgba(6,8,13,.86),rgba(6,8,13,.25)),url('${selected.image}')` }}><div className="player-mark"><div className="play-orbit"><Play size={22} fill="currentColor"/></div><span>DEMO PREVIEW</span><h2>{selected.title}</h2><p>This is a demo preview. Real hosting will be connected later.</p></div><div className="player-footer"><span>00:00</span><div className="progress-track"><i/></div><span>{selected.duration}</span><Volume2 size={17}/></div></div> : <><div className="detail-art" style={{ backgroundImage: `linear-gradient(0deg,#12151d,transparent 60%),url('${selected.image}')` }}/><div className="detail-copy"><div className="eyebrow"><span className="eyebrow-line"/>{selected.kind.toUpperCase()}<span className="eyebrow-dot">·</span>{selected.source}</div><h2>{selected.title}</h2><div className="metadata"><span>{selected.year}</span><span className="meta-dot"/><span className="rating-star">★</span><span>{selected.rating}</span><span>{selected.duration}</span></div><p>{selected.description}</p><div className="detail-tags"><span>{selected.genre}</span><span>Available in 4K</span><span>English</span></div><div className="detail-actions"><button className="watch-button" onClick={() => setWatching(true)} data-testid="button-watch-detail"><Play size={15} fill="currentColor"/> Watch preview</button><button className={`detail-list-button ${saved.includes(selected.id) ? "is-saved" : ""}`} onClick={() => toggleSaved(selected.id)} data-testid="button-save-detail">{saved.includes(selected.id) ? <Check size={16}/> : <Plus size={16}/>} {saved.includes(selected.id) ? "In my list" : "Add to my list"}</button></div><div className="rights-note"><span className="rights-dot"/> Shared by <b>{selected.source}</b><span>·</span> Demo catalog title</div></div></>}</section></div>}
  </main>;
}
