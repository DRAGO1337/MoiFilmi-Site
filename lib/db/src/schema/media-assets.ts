import { createInsertSchema } from "drizzle-zod";
import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { episodesTable } from "./episodes";
import { titlesTable } from "./titles";
import { usersTable } from "./users";

export const mediaProviderEnum = pgEnum("media_provider", ["cloudflare_stream", "replit_object_storage"]);
export const mediaKindEnum = pgEnum("media_kind", ["video", "poster", "backdrop"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending", "processing", "ready", "failed"]);

export const mediaAssetsTable = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  titleId: uuid("title_id").notNull().references(() => titlesTable.id, { onDelete: "cascade" }),
  episodeId: uuid("episode_id").references(() => episodesTable.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  provider: mediaProviderEnum("provider").notNull(),
  kind: mediaKindEnum("kind").notNull(),
  status: mediaStatusEnum("status").notNull().default("pending"),
  providerUid: text("provider_uid").unique(),
  objectPath: text("object_path"),
  playbackUrl: text("playback_url"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssetsTable.$inferSelect;
