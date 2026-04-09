import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const authRouter = Router();

authRouter.get("/auth/me", async (req, res) => {
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

  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessionClaims = auth.sessionClaims as Record<string, string> | undefined;

  let user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkUserId),
  });

  if (!user) {
    const newId = uuidv4();
    const username =
      sessionClaims?.["username"] ??
      sessionClaims?.["email"]?.split("@")[0] ??
      `user_${newId.slice(0, 8)}`;

    const [created] = await db.insert(usersTable).values({
      id: newId,
      clerkId: clerkUserId,
      username,
      email: sessionClaims?.["email"],
      avatarUrl: sessionClaims?.["image_url"],
      isGuest: false,
    }).returning();
    user = created;
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
