import { createInsertSchema } from "drizzle-zod";
import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appRoleEnum = pgEnum("app_role", ["viewer", "admin"]);

export const usersTable = pgTable("app_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: appRoleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AppUser = typeof usersTable.$inferSelect;
