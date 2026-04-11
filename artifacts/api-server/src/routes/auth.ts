import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const authRouter = Router();

async function getClerkUsername(clerkUserId: string): Promise<{ username: string; email?: string; avatarUrl?: string }> {
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const firstName = clerkUser.firstName ?? "";
    const lastName = clerkUser.lastName ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const username =
      clerkUser.username ??
      (fullName || null) ??
      email?.split("@")[0] ??
      `user_${clerkUserId.slice(-8)}`;

    return { username, email, avatarUrl: clerkUser.imageUrl ?? undefined };
  } catch {
    return { username: `user_${clerkUserId.slice(-8)}` };
  }
}

authRouter.get("/auth/me", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (clerkUserId) {
    const { username, email, avatarUrl } = await getClerkUsername(clerkUserId);

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkUserId),
    });

    if (!user) {
      const newId = uuidv4();
      const [created] = await db.insert(usersTable).values({
        id: newId,
        clerkId: clerkUserId,
        username,
        email,
        avatarUrl,
        isGuest: false,
      }).returning();
      user = created;
    } else {
      // Always update with fresh Clerk data to keep names in sync
      const [updated] = await db
        .update(usersTable)
        .set({ username, email: email ?? user.email, avatarUrl: avatarUrl ?? user.avatarUrl })
        .where(eq(usersTable.clerkId, clerkUserId))
        .returning();
      user = updated ?? user;
    }

    if (!user) {
      return res.status(500).json({ error: "Failed to get or create user" });
    }

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isGuest: false,
      createdAt: user.createdAt.toISOString(),
    });
  }

  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) {
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isGuest: true,
        createdAt: user.createdAt.toISOString(),
      });
    }
  }

  return res.status(401).json({ error: "Unauthorized" });
});

authRouter.post("/auth/guest", async (req, res) => {
  const body = req.body as { username?: unknown };
  const username = typeof body.username === "string" ? body.username : undefined;

  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: "Invalid username" });
  }

  const guestToken = uuidv4();
  const guestId = `guest_${uuidv4()}`;

  const [user] = await db.insert(usersTable).values({
    id: guestId,
    username: username.trim(),
    isGuest: true,
    guestToken,
  }).returning();

  return res.json({
    token: guestToken,
    user: {
      id: user.id,
      username: user.username,
      email: null,
      avatarUrl: null,
      isGuest: true,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

export default authRouter;
