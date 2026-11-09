import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const adminBootstrapTable = pgTable("admin_bootstrap", {
  id: integer("id").primaryKey(),
  email: text("email").notNull().unique(),
  claimedUserId: text("claimed_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminBootstrapSchema = createInsertSchema(adminBootstrapTable).omit({
  createdAt: true,
});
export type InsertAdminBootstrap = z.infer<typeof insertAdminBootstrapSchema>;
export type AdminBootstrap = typeof adminBootstrapTable.$inferSelect;
