import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { titlesTable } from "./titles";

export const genresTable = pgTable("genres", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const titleGenresTable = pgTable("title_genres", {
  titleId: uuid("title_id").notNull().references(() => titlesTable.id, { onDelete: "cascade" }),
  genreId: uuid("genre_id").notNull().references(() => genresTable.id, { onDelete: "cascade" }),
}, (table) => [
  uniqueIndex("title_genres_pair_unique").on(table.titleId, table.genreId),
]);

export const insertGenreSchema = createInsertSchema(genresTable).omit({ id: true, createdAt: true });
export type InsertGenre = z.infer<typeof insertGenreSchema>;
export type Genre = typeof genresTable.$inferSelect;
