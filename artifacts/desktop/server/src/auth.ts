import { Request, Response, NextFunction } from "express";
import { sign, verify } from "./jwt.js";

export interface AuthUser {
  id: string;
  username: string;
  isGuest: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  const guestToken = req.headers["x-guest-token"] as string | undefined;

  const token = header?.startsWith("Bearer ") ? header.slice(7) : guestToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verify(token) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  const guestToken = req.headers["x-guest-token"] as string | undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : guestToken;

  if (token) {
    try {
      const payload = verify(token) as AuthUser;
      req.user = payload;
    } catch { /* ignore */ }
  }
  next();
}

export function createGuestToken(userId: string, username: string): string {
  return sign({ id: userId, username, isGuest: true });
}

export function createCollabToken(userId: string, username: string): string {
  return sign({ id: userId, username, isGuest: true, scope: "collab" }, "24h");
}

export function verifyCollabToken(token: string): AuthUser | null {
  try {
    return verify(token) as AuthUser;
  } catch {
    return null;
  }
}
