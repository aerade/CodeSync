import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const collabRouter = Router();

const collabTokens = new Map<string, { userId: string; username: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of collabTokens) {
    if (data.expiresAt < now) {
      collabTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

async function issueCollabToken(req: Request, res: Response): Promise<void> {
  if (req.isAuthenticated()) {
    const token = uuidv4();
    collabTokens.set(token, {
      userId: req.user.id,
      username: req.user.username,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    res.json({ token, userId: req.user.id, username: req.user.username });
    return;
  }

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
