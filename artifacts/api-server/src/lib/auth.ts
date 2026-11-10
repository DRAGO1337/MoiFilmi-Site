import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { adminBootstrapTable, db, usersTable, type AppUser } from "@workspace/db";

async function claimInitialAdmin(user: AppUser): Promise<AppUser> {
  if (!user.emailVerified || user.role === "admin") return user;

  return db.transaction(async (tx) => {
    const [bootstrap] = await tx
      .select()
      .from(adminBootstrapTable)
      .where(and(eq(adminBootstrapTable.email, user.email.toLowerCase()), isNull(adminBootstrapTable.claimedAt)))
      .for("update")
      .limit(1);

    if (!bootstrap) return user;

    await tx
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, user.id));
    await tx
      .update(adminBootstrapTable)
      .set({ claimedUserId: user.id, claimedAt: new Date() })
      .where(and(eq(adminBootstrapTable.id, bootstrap.id), isNull(adminBootstrapTable.claimedAt)));

    const [updated] = await tx.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    return updated ?? user;
  });
}

async function syncClerkUser(clerkUserId: string): Promise<AppUser> {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, clerkUserId)).limit(1);
  if (existing?.emailVerified) return claimInitialAdmin(existing);

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  );
  if (!primaryEmail) {
    throw new Error("Your account needs a primary email address before it can use MoiFilmi.");
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();
  const emailVerified = primaryEmail.verification?.status === "verified";
  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    email;
  const [user] = await db
    .insert(usersTable)
    .values({
      id: clerkUserId,
      email,
      displayName,
      avatarUrl: clerkUser.imageUrl || null,
      emailVerified,
      role: "viewer",
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { email, avatarUrl: clerkUser.imageUrl || null, emailVerified },
    })
    .returning();

  if (!user) throw new Error("Could not create the MoiFilmi profile.");
  return claimInitialAdmin(user);
}

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    req.appUser = await syncClerkUser(userId);
    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not synchronize the signed-in user");
    res.status(503).json({ error: "Your account could not be loaded. Please try again." });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.appUser) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (req.appUser.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
};

export function getRequestUser(req: Express.Request): AppUser {
  if (!req.appUser) throw new Error("Authenticated request is missing its application user.");
  return req.appUser;
}
