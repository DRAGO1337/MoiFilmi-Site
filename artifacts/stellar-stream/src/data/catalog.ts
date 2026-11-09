export type CatalogTitle = {
  id: string;
  title: string;
  kind: "Film" | "Series" | "Anime";
  year: string;
  rating: string;
  genre: string;
  duration: string;
  image: string;
  description: string;
  source: string;
  badge?: string;
};

export const catalog: CatalogTitle[] = [
  { id: "tide", title: "A Quiet Tide", kind: "Film", year: "2025", rating: "8.4", genre: "Mystery · Drama", duration: "1h 48m", image: "/images/hero-tidal.jpg", description: "A lighthouse keeper returns to the island she fled, only to find the sea has brought back more than old memories.", source: "Northstar Pictures", badge: "MOIFILMI PREMIERE" },
  { id: "orbit", title: "The Garden Between", kind: "Series", year: "2024", rating: "8.7", genre: "Sci-fi · Intimate", duration: "8 episodes", image: "/images/poster-orbit.jpg", description: "On the quiet edge of the moon, a botanist grows something neither Earth nor the stars can explain.", source: "Little Comet Studio", badge: "NEW EPISODES" },
  { id: "ember", title: "The Last Check-In", kind: "Film", year: "2023", rating: "7.9", genre: "Thriller · Mystery", duration: "1h 56m", image: "/images/poster-ember.jpg", description: "One night. One hotel. A guest who was never meant to arrive.", source: "Cinder House" },
  { id: "river", title: "Where the River Bends", kind: "Film", year: "2025", rating: "8.1", genre: "Adventure · Drama", duration: "2h 04m", image: "/images/poster-river.jpg", description: "Two siblings follow a forgotten river north to the place their family story began.", source: "Morrow Films", badge: "JUST ADDED" },
  { id: "city", title: "After the Blue Hour", kind: "Series", year: "2024", rating: "8.2", genre: "Romance · Noir", duration: "6 episodes", image: "/images/poster-city.jpg", description: "A jazz musician and a night-shift cook build a friendship in a city that never quite sleeps.", source: "Elsewhere Media" },
  { id: "sky", title: "Small Hours of the Universe", kind: "Film", year: "2022", rating: "7.8", genre: "Coming-of-age · Drama", duration: "1h 39m", image: "/images/poster-sky.jpg", description: "A young astronomer discovers the stars are easier to read than the people closest to her.", source: "August Pictures" },
  { id: "silence", title: "The Shape of Silence", kind: "Film", year: "2021", rating: "8.0", genre: "Drama · Mystery", duration: "1h 42m", image: "/images/hero-tidal.jpg", description: "A sound archivist returns to her coastal hometown to record its vanishing stories.", source: "Northstar Pictures" },
  { id: "harvest", title: "Blue Harvest", kind: "Series", year: "2023", rating: "8.3", genre: "Sci-fi · Adventure", duration: "10 episodes", image: "/images/poster-orbit.jpg", description: "The last crew on Europa is growing food and questioning who gets to call it home.", source: "Little Comet Studio" },
  { id: "paper-moon", title: "Paper Moon Station", kind: "Anime", year: "2025", rating: "8.6", genre: "Anime · Fantasy", duration: "12 episodes", image: "/images/poster-sky.jpg", description: "A courier carries letters between a city that sleeps and the constellations above it.", source: "Kite & Lantern Animation", badge: "NEW SERIES" },
  { id: "summer-ghosts", title: "Summer of Small Ghosts", kind: "Anime", year: "2024", rating: "8.5", genre: "Anime · Coming-of-age", duration: "1h 36m", image: "/images/poster-river.jpg", description: "Three friends spend one last summer learning which memories are ready to let go.", source: "Mizu Studio" },
  { id: "orbiting", title: "Orbiting the Sunroom", kind: "Anime", year: "2023", rating: "8.1", genre: "Anime · Sci-fi", duration: "10 episodes", image: "/images/poster-orbit.jpg", description: "A shy mechanic and her tiny robot repair a greenhouse drifting between planets.", source: "Kite & Lantern Animation" },
];

export const genres = ["All genres", "Drama", "Mystery", "Sci-fi", "Adventure", "Romance", "Fantasy", "Coming-of-age"];
