import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import {
  adminBootstrapTable,
  db,
  usersTable,
  type AppUser,
} from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

async function claimInitialAdmin(user: AppUser): Promise<AppUser> {
  if (!user.emailVerified || user.role === "admin") return user;

  return db.transaction(async (tx) => {
    const [bootstrap] = await tx
      .select()
      .from(adminBootstrapTable)
      .where(
        and(
          eq(adminBootstrapTable.email, user.email.toLowerCase()),
          isNull(adminBootstrapTable.claimedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!bootstrap) return user;

    const [admin] = await tx
      .update(usersTable)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .returning();
    await tx
      .update(adminBootstrapTable)
      .set({ claimedUserId: user.id, claimedAt: new Date() })
      .where(
        and(
          eq(adminBootstrapTable.id, bootstrap.id),
          isNull(adminBootstrapTable.claimedAt),
        ),
      );
    return admin ?? user;
  });
}

async function getOrCreateAppUser(userId: string): Promise<AppUser> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing?.emailVerified) return claimInitialAdmin(existing);

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
      role: "viewer",
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email,
        avatarUrl: clerkUser.imageUrl || null,
        emailVerified,
        updatedAt: new Date(),
      },
    })
    .returning();

  return claimInitialAdmin(created);
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
