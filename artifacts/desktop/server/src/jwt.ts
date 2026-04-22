import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.JWT_SECRET || randomBytes(32).toString("hex");

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function decodeBase64url(str: string): string {
  return Buffer.from(str, "base64url").toString("utf8");
}

export function sign(payload: object, _expiresIn?: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verify(token: string): object {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) throw new Error("Invalid signature");
  return JSON.parse(decodeBase64url(body));
}
