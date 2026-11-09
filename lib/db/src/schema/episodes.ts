import { createInsertSchema } from "drizzle-zod";
import { date, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { seriesTable } from "./series";

export const episodesTable = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id").notNull().references(() => seriesTable.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  episodeNumber: integer("episode_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  releaseDate: date("release_date", { mode: "string" }),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("episodes_season_number_unique").on(table.seasonId, table.episodeNumber),
]);

export const insertEpisodeSchema = createInsertSchema(episodesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEpisode = z.infer<typeof insertEpisodeSchema>;
export type Episode = typeof episodesTable.$inferSelect;
