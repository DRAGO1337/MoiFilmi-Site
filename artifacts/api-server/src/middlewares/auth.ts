import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type AppUser } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.MOIFILMI_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function getOrCreateAppUser(userId: string): Promise<AppUser> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing) {
    const role =
      existing.emailVerified &&
      configuredAdminEmails().has(existing.email.toLowerCase())
        ? "admin"
        : "viewer";

    if (existing.role !== role) {
      const [updated] = await db
        .update(usersTable)
        .set({ role, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning();
      return updated;
    }

    return existing;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (address) => address.id === clerkUser.primaryEmailAddressId,
    ) ?? clerkUser.emailAddresses[0];

  if (!primaryEmail) {
    throw new Error("The signed-in account does not have an email address.");
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();
  const emailVerified = primaryEmail.verification?.status === "verified";
  const role =
    emailVerified && configuredAdminEmails().has(email) ? "admin" : "viewer";
  const displayName =
    clerkUser.fullName?.trim() ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0];

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      email,
      displayName,
      avatarUrl: clerkUser.imageUrl || null,
      emailVerified,
      role,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email,
        avatarUrl: clerkUser.imageUrl || null,
        emailVerified,
        role,
        updatedAt: new Date(),
      },
    })
    .returning();

  return created;
}

export async function requireViewer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in required." });
      return;
    }

    req.appUser = await getOrCreateAppUser(userId);
    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not load signed-in account");
    res.status(503).json({ error: "Your account could not be loaded." });
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireViewer(req, res, () => {
    if (req.appUser?.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    next();
  });
}
