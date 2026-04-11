import * as oidcLib from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  upsertUser,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const authRouter: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

authRouter.get("/auth/user", (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    return res.json({ user: req.user });
  }
  return res.json({ user: null });
});

authRouter.get("/auth/me", async (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    return res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl,
      isGuest: req.user.isGuest,
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
      });
    }
  }

  return res.status(401).json({ error: "Unauthorized" });
});

authRouter.get("/login", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;
    const returnTo = getSafeReturnTo(req.query.returnTo);

    const state = oidcLib.randomState();
    const nonce = oidcLib.randomNonce();
    const codeVerifier = oidcLib.randomPKCECodeVerifier();
    const codeChallenge = await oidcLib.calculatePKCECodeChallenge(codeVerifier);

    const redirectUrl = oidcLib.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "oidc_nonce", nonce);
    setOidcCookie(res, "oidc_state", state);
    setOidcCookie(res, "return_to", returnTo);

    return res.redirect(redirectUrl.href);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).send("Login failed");
  }
});

authRouter.get("/callback", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const origin = getOrigin(req);
    const callbackUrl = `${origin}/api/callback`;

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.oidc_nonce;
    const expectedState = req.cookies?.oidc_state;
    const returnTo = getSafeReturnTo(req.cookies?.return_to);

    if (!codeVerifier || !expectedState) {
      return res.redirect("/api/login");
    }

    const searchParams = new URLSearchParams(req.query as Record<string, string>);
    const currentUrl = new URL(`${callbackUrl}?${searchParams}`);

    const tokens = await oidcLib.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
    });

    const claims = tokens.claims();
    if (!claims) {
      return res.status(401).send("No claims in token");
    }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: dbUser,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() != null ? now + tokens.expiresIn()! : undefined,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);

    res.clearCookie("code_verifier");
    res.clearCookie("oidc_nonce");
    res.clearCookie("oidc_state");
    res.clearCookie("return_to");

    return res.redirect(returnTo);
  } catch (err) {
    console.error("Callback error:", err);
    return res.status(500).send("Auth callback failed");
  }
});

authRouter.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await clearSession(res, sid);
  }
  try {
    const config = await getOidcConfig();
    const endSessionUrl = oidcLib.buildEndSessionUrl(config, {
      post_logout_redirect_uri: `${getOrigin(req)}/`,
    });
    return res.redirect(endSessionUrl.href);
  } catch {
    return res.redirect("/");
  }
});

authRouter.post("/auth/guest", async (req: Request, res: Response) => {
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
