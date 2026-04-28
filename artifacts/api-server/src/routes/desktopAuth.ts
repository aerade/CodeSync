/**
 * Desktop OAuth flow for Electron app.
 *
 * Flow:
 *   1. Desktop calls POST /api/desktop-auth/start?provider=google|github
 *      → returns { url, state }
 *   2. Desktop opens `url` in system browser.
 *   3. Provider redirects to GET /api/desktop-auth/callback/:provider?code=...&state=...
 *      → exchanges code for user profile, stores a short-lived exchange token
 *      → redirects browser to codesync://auth?token=<exchangeToken>
 *   4. Electron receives the deep link, calls GET /api/desktop-auth/exchange?token=...
 *      → returns { user } and deletes the token (one-time use)
 */

import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

const router = Router();

// ─── In-memory stores (TTL 10 min) ───────────────────────────────────────────

interface OAuthState {
  provider: "google" | "github";
  expiresAt: number;
}

interface ExchangeToken {
  user: DesktopUser;
  expiresAt: number;
}

interface DesktopUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  provider: "google" | "github";
}

const oauthStates = new Map<string, OAuthState>();
const exchangeTokens = new Map<string, ExchangeToken>();
const TTL = 10 * 60 * 1000; // 10 minutes

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of oauthStates) if (v.expiresAt < now) oauthStates.delete(k);
  for (const [k, v] of exchangeTokens) if (v.expiresAt < now) exchangeTokens.delete(k);
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function apiBase(): string {
  // Priority: explicit override → production domain(s) → dev domain
  const explicit = process.env.API_PUBLIC_URL;
  if (explicit?.trim()) {
    const u = explicit.trim().replace(/\/$/, "");
    return u.startsWith("http") ? u : `https://${u}`;
  }

  // REPLIT_DOMAINS may contain multiple comma-separated domains; take the first
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains?.trim()) {
    const first = replitDomains.split(",")[0].trim();
    return `https://${first}`;
  }

  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain?.trim()) return `https://${devDomain.trim()}`;

  throw new Error("Cannot determine API public URL. Set API_PUBLIC_URL secret.");
}

// ─── POST /api/desktop-auth/start ────────────────────────────────────────────

router.post("/desktop-auth/start", (req, res) => {
  const provider = (req.query.provider ?? req.body?.provider) as string;
  if (provider !== "google" && provider !== "github") {
    return res.status(400).json({ error: "provider must be 'google' or 'github'" });
  }

  cleanExpired();

  const googleId = process.env.GOOGLE_CLIENT_ID;
  const githubId = process.env.GITHUB_CLIENT_ID;

  if (provider === "google" && !googleId) {
    return res.status(503).json({ error: "Google OAuth is not configured on this server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
  }
  if (provider === "github" && !githubId) {
    return res.status(503).json({ error: "GitHub OAuth is not configured on this server. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." });
  }

  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, expiresAt: Date.now() + TTL });

  let url: string;
  const callbackUrl = `${apiBase()}/api/desktop-auth/callback/${provider}`;

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: googleId!,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  } else {
    const params = new URLSearchParams({
      client_id: githubId!,
      redirect_uri: callbackUrl,
      scope: "read:user user:email",
      state,
    });
    url = `https://github.com/login/oauth/authorize?${params}`;
  }

  return res.json({ url, state });
});

// ─── GET /api/desktop-auth/callback/:provider ─────────────────────────────────

router.get("/desktop-auth/callback/:provider", async (req, res) => {
  const provider = req.params.provider as "google" | "github";
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`codesync://auth?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  cleanExpired();
  const storedState = oauthStates.get(state);
  if (!storedState || storedState.provider !== provider) {
    return res.status(400).send("Invalid or expired state");
  }
  oauthStates.delete(state);

  try {
    let desktopUser: DesktopUser;

    if (provider === "google") {
      const callbackUrl = `${apiBase()}/api/desktop-auth/callback/google`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
      const tokenData = await tokenRes.json() as { access_token: string };

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!profileRes.ok) throw new Error(`Google profile fetch failed: ${profileRes.status}`);
      const profile = await profileRes.json() as { id: string; name: string; email: string; picture: string };

      desktopUser = {
        id: `google_${profile.id}`,
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.picture,
        provider: "google",
      };
    } else {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID!,
          client_secret: process.env.GITHUB_CLIENT_SECRET!,
          code,
        }),
      });
      if (!tokenRes.ok) throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
      const tokenData = await tokenRes.json() as { access_token: string };

      const profileRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "CodeSync-Desktop/1.0",
        },
      });
      if (!profileRes.ok) throw new Error(`GitHub profile fetch failed: ${profileRes.status}`);
      const profile = await profileRes.json() as { id: number; login: string; name: string | null; email: string | null; avatar_url: string };

      let email = profile.email;
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "CodeSync-Desktop/1.0" },
        });
        if (emailsRes.ok) {
          const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
          email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? "";
        }
      }

      desktopUser = {
        id: `github_${profile.id}`,
        name: profile.name ?? profile.login,
        email: email ?? "",
        avatarUrl: profile.avatar_url,
        provider: "github",
      };
    }

    // Upsert user in DB
    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, desktopUser.id),
    }).catch(() => null);

    if (!existingUser) {
      await db.insert(usersTable).values({
        id: desktopUser.id,
        username: desktopUser.name,
        email: desktopUser.email,
        avatarUrl: desktopUser.avatarUrl,
        isGuest: false,
      }).onConflictDoNothing().catch(() => {});
    } else {
      await db.update(usersTable).set({
        username: desktopUser.name,
        email: desktopUser.email,
        avatarUrl: desktopUser.avatarUrl,
      }).where(eq(usersTable.id, desktopUser.id)).catch(() => {});
    }

    const exchangeToken = randomBytes(32).toString("hex");
    exchangeTokens.set(exchangeToken, { user: desktopUser, expiresAt: Date.now() + TTL });

    return res.redirect(`codesync://auth?token=${exchangeToken}`);
  } catch (err) {
    logger.error({ err }, "Desktop OAuth callback error");
    return res.redirect(`codesync://auth?error=${encodeURIComponent("Authentication failed")}`);
  }
});

// ─── GET /api/desktop-auth/exchange ──────────────────────────────────────────

router.get("/desktop-auth/exchange", (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: "token is required" });

  cleanExpired();
  const entry = exchangeTokens.get(token);
  if (!entry) return res.status(404).json({ error: "Token not found or expired" });

  exchangeTokens.delete(token);
  return res.json({ user: entry.user });
});

export default router;
