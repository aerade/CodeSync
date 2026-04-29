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
 *
 * Email auth flow:
 *   POST /api/desktop-auth/email/register     → { user }
 *   POST /api/desktop-auth/email/login        → { user }
 *   POST /api/desktop-auth/email/request-code → { ok: true }
 *   POST /api/desktop-auth/email/verify-code  → { user }
 */

import { Router } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";

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
  provider: "google" | "github" | "email";
}

interface EmailCode {
  code: string;
  expiresAt: number;
}

const oauthStates = new Map<string, OAuthState>();
const exchangeTokens = new Map<string, ExchangeToken>();
const emailCodes = new Map<string, EmailCode>(); // key: email
const TTL = 10 * 60 * 1000; // 10 minutes

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of oauthStates) if (v.expiresAt < now) oauthStates.delete(k);
  for (const [k, v] of exchangeTokens) if (v.expiresAt < now) exchangeTokens.delete(k);
  for (const [k, v] of emailCodes) if (v.expiresAt < now) emailCodes.delete(k);
}

// ─── Password hashing helpers (Node.js built-in crypto) ──────────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  try {
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// ─── Email sending helper ─────────────────────────────────────────────────────

async function sendEmailCode(to: string, code: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? "noreply@codesync.app";

  if (!host || !user || !pass) {
    logger.info({ to, code }, "[DEV] Email auth code (SMTP not configured, logging to console)");
    console.log(`\n==== CodeSync Email Auth Code ====\nTo: ${to}\nCode: ${code}\n==================================\n`);
    return;
  }

  const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
  await transporter.sendMail({
    from,
    to,
    subject: "CodeSync — код для входа",
    text: `Ваш код для входа в CodeSync: ${code}\n\nКод действителен 10 минут.`,
    html: `<p>Ваш код для входа в <strong>CodeSync</strong>: <strong style="font-size:1.4em">${code}</strong></p><p>Код действителен 10 минут.</p>`,
  });
}

// ─── Config helpers ───────────────────────────────────────────────────────────

function apiBase(): string {
  const explicit = process.env.API_PUBLIC_URL;
  if (explicit?.trim()) {
    const u = explicit.trim().replace(/\/$/, "");
    return u.startsWith("http") ? u : `https://${u}`;
  }

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

// ─── POST /api/desktop-auth/email/register ────────────────────────────────────

router.post("/desktop-auth/email/register", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "password must be at least 6 characters" });
  }

  try {
    // Check if user already exists
    const existing = await db.execute(
      `SELECT id FROM users WHERE email = $1 AND password_hash IS NOT NULL LIMIT 1`,
      [email]
    ).catch(() => ({ rows: [] as { id: string }[] }));

    if ((existing.rows as { id: string }[]).length > 0) {
      return res.status(409).json({ error: "Пользователь с таким email уже существует" });
    }

    const id = `email_${uuidv4()}`;
    const passwordHash = hashPassword(password);
    const name = email.split("@")[0];

    await db.execute(
      `INSERT INTO users (id, username, email, avatar_url, is_guest, password_hash)
       VALUES ($1, $2, $3, $4, false, $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, email, "", passwordHash]
    );

    const user: DesktopUser = { id, name, email, avatarUrl: "", provider: "email" };
    return res.json({ user });
  } catch (err) {
    logger.error({ err }, "Email register error");
    return res.status(500).json({ error: "Ошибка регистрации" });
  }
});

// ─── POST /api/desktop-auth/email/login ──────────────────────────────────────

router.post("/desktop-auth/email/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await db.execute(
      `SELECT id, username, email, avatar_url, password_hash FROM users WHERE email = $1 AND password_hash IS NOT NULL LIMIT 1`,
      [email]
    ).catch(() => ({ rows: [] as Record<string, string>[] }));

    const rows = result.rows as Record<string, string>[];
    if (rows.length === 0) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const row = rows[0];
    if (!verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const user: DesktopUser = {
      id: row.id,
      name: row.username,
      email: row.email,
      avatarUrl: row.avatar_url ?? "",
      provider: "email",
    };
    return res.json({ user });
  } catch (err) {
    logger.error({ err }, "Email login error");
    return res.status(500).json({ error: "Ошибка входа" });
  }
});

// ─── POST /api/desktop-auth/email/request-code ───────────────────────────────

router.post("/desktop-auth/email/request-code", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  cleanExpired();

  const code = String(Math.floor(100000 + Math.random() * 900000));
  emailCodes.set(email, { code, expiresAt: Date.now() + TTL });

  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  try {
    await sendEmailCode(email, code);
    // In dev mode (no SMTP), return the code in the response so the client can display it
    if (!smtpConfigured) {
      return res.json({ ok: true, devCode: code });
    }
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to send email code");
    return res.status(500).json({ error: "Не удалось отправить код" });
  }
});

// ─── POST /api/desktop-auth/email/verify-code ────────────────────────────────

router.post("/desktop-auth/email/verify-code", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }

  cleanExpired();

  const stored = emailCodes.get(email);
  if (!stored || stored.code !== code.trim()) {
    return res.status(401).json({ error: "Неверный или истёкший код" });
  }

  emailCodes.delete(email);

  try {
    // Find or create user by email (code-based users have no password_hash)
    const result = await db.execute(
      `SELECT id, username, email, avatar_url FROM users WHERE email = $1 LIMIT 1`,
      [email]
    ).catch(() => ({ rows: [] as Record<string, string>[] }));

    let user: DesktopUser;
    const rows = result.rows as Record<string, string>[];

    if (rows.length > 0) {
      const row = rows[0];
      user = { id: row.id, name: row.username, email: row.email, avatarUrl: row.avatar_url ?? "", provider: "email" };
    } else {
      const id = `email_${uuidv4()}`;
      const name = email.split("@")[0];
      await db.execute(
        `INSERT INTO users (id, username, email, avatar_url, is_guest)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (id) DO NOTHING`,
        [id, name, email, ""]
      );
      user = { id, name, email, avatarUrl: "", provider: "email" };
    }

    return res.json({ user });
  } catch (err) {
    logger.error({ err }, "Email verify-code error");
    return res.status(500).json({ error: "Ошибка верификации кода" });
  }
});

export default router;
