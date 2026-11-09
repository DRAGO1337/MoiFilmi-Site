import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { titlesTable } from "./titles";

export const moviesTable = pgTable("movies", {
  id: uuid("id").primaryKey().references(() => titlesTable.id, { onDelete: "cascade" }),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMovieSchema = createInsertSchema(moviesTable).omit({ createdAt: true });
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof moviesTable.$inferSelect;
