import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { titlesTable } from "./titles";

export const seriesTable = pgTable("series", {
  id: uuid("id").primaryKey().references(() => titlesTable.id, { onDelete: "cascade" }),
  seasonCount: integer("season_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSeriesSchema = createInsertSchema(seriesTable).omit({ createdAt: true });
export type InsertSeries = z.infer<typeof insertSeriesSchema>;
export type Series = typeof seriesTable.$inferSelect;
