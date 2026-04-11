import * as oidc from "openid-client";
import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  isGuest: boolean;
}

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

let oidcConfig: oidc.Configuration | null = null;

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!oidcConfig) {
    oidcConfig = await oidc.discovery(
      new URL(ISSUER_URL),
      process.env.REPL_ID!,
    );
  }
  return oidcConfig;
}

export async function upsertUser(claims: Record<string, unknown>): Promise<AuthUser> {
  const sub = String(claims.sub ?? "");
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const firstName = typeof claims.first_name === "string" ? claims.first_name : "";
  const lastName = typeof claims.last_name === "string" ? claims.last_name : "";
  const username = [firstName, lastName].filter(Boolean).join(" ").trim() || email?.split("@")[0] || `user_${sub.slice(-8)}`;
  const avatarUrl = typeof claims.profile_image_url === "string" ? claims.profile_image_url : undefined;

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, sub),
  });

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({ username, email, avatarUrl, updatedAt: new Date() })
      .where(eq(usersTable.clerkId, sub))
      .returning();
    return {
      id: updated.id,
      username: updated.username,
      email: updated.email ?? undefined,
      avatarUrl: updated.avatarUrl ?? undefined,
      isGuest: updated.isGuest,
    };
  }

  const newId = crypto.randomUUID();
  const [created] = await db
    .insert(usersTable)
    .values({ id: newId, clerkId: sub, username, email, avatarUrl, isGuest: false })
    .returning();
  return {
    id: created.id,
    username: created.username,
    email: created.email ?? undefined,
    avatarUrl: created.avatarUrl ?? undefined,
    isGuest: created.isGuest,
  };
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(sid: string, data: SessionData): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export function getSessionId(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE];
}

export function clearSession(res: Response, sid: string): Promise<void> {
  res.clearCookie(SESSION_COOKIE);
  return deleteSession(sid);
}
