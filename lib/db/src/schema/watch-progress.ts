import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { episodesTable } from "./episodes";
import { titlesTable } from "./titles";
import { usersTable } from "./users";

export const watchProgressTable = pgTable("watch_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  titleId: uuid("title_id").notNull().references(() => titlesTable.id, { onDelete: "cascade" }),
  episodeId: uuid("episode_id").references(() => episodesTable.id, { onDelete: "cascade" }),
  progressKey: text("progress_key").notNull(),
  currentTimeSeconds: integer("current_time_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("watch_progress_user_title_key_unique").on(table.userId, table.titleId, table.progressKey),
]);

export const insertWatchProgressSchema = createInsertSchema(watchProgressTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertWatchProgress = z.infer<typeof insertWatchProgressSchema>;
export type WatchProgress = typeof watchProgressTable.$inferSelect;
