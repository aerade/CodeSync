import { Router, Request, Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const collabRouter = Router();

// Short-lived in-memory collaboration tokens: token -> { userId, username, expiresAt }
const collabTokens = new Map<string, { userId: string; username: string; expiresAt: number }>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of collabTokens) {
    if (data.expiresAt < now) {
      collabTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

async function issueCollabToken(req: Request, res: Response): Promise<void> {
  // Always prefer Clerk auth
  const auth = getAuth(req);
  if (auth?.userId) {
    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, auth.userId),
    });

    if (!user) {
      res.status(401).json({ error: "User not found — call /api/auth/me first" });
      return;
    }

    // Refresh the username from Clerk on each token issuance to ensure it's current
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const firstName = clerkUser.firstName ?? "";
      const lastName = clerkUser.lastName ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const freshUsername =
        clerkUser.username ??
        (fullName || null) ??
        clerkUser.emailAddresses[0]?.emailAddress.split("@")[0] ??
        user.username;

      if (freshUsername && freshUsername !== user.username) {
        const [updated] = await db
          .update(usersTable)
          .set({ username: freshUsername })
          .where(eq(usersTable.clerkId, auth.userId))
          .returning();
        if (updated) user = updated;
      }
    } catch {
      // Non-fatal: keep existing username
    }

    const token = uuidv4();
    collabTokens.set(token, {
      userId: user.id,
      username: user.username,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    res.json({ token, userId: user.id, username: user.username });
    return;
  }

  // Fall back to guest token
  const guestToken = req.headers["x-guest-token"];
  if (typeof guestToken === "string" && guestToken) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.guestToken, guestToken),
    });
    if (user) {
      const token = uuidv4();
      collabTokens.set(token, {
        userId: user.id,
        username: user.username,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      res.json({ token, userId: user.id, username: user.username });
      return;
    }
    res.status(401).json({ error: "Invalid guest token" });
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

collabRouter.post("/collab/token", (req, res) => { void issueCollabToken(req, res); });

export { collabTokens };
export default collabRouter;
