import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { titlesTable } from "./titles";
import { usersTable } from "./users";

export const libraryEntryKindEnum = pgEnum("library_entry_kind", ["watchlist", "favorite"]);

export const watchlistsTable = pgTable("watchlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  titleId: uuid("title_id").notNull().references(() => titlesTable.id, { onDelete: "cascade" }),
  entryKind: libraryEntryKindEnum("entry_kind").notNull().default("watchlist"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("watchlists_user_title_kind_unique").on(table.userId, table.titleId, table.entryKind),
]);

export const insertWatchlistSchema = createInsertSchema(watchlistsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type WatchlistEntry = typeof watchlistsTable.$inferSelect;
