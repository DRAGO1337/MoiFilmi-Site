import { createInsertSchema } from "drizzle-zod";
import { date, pgEnum, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const titleKindEnum = pgEnum("title_kind", ["movie", "series"]);
export const publicationStatusEnum = pgEnum("publication_status", ["draft", "published", "unpublished"]);

export const titlesTable = pgTable("titles", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: titleKindEnum("kind").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  releaseDate: date("release_date", { mode: "string" }),
  rating: real("rating"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  status: publicationStatusEnum("status").notNull().default("draft"),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTitleSchema = createInsertSchema(titlesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTitle = z.infer<typeof insertTitleSchema>;
export type Title = typeof titlesTable.$inferSelect;
