import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE_NAME = "rts_session";
const MAX_AGE = 604800;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function signSession(userId: number): string {
  const expiry = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token: string): { userId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdRaw, expiryRaw, signature] = parts;
  const userId = Number(userIdRaw);
  const expiry = Number(expiryRaw);
  if (!Number.isInteger(userId) || !Number.isInteger(expiry)) return null;
  if (Date.now() > expiry) return null;
  const expected = sign(`${userIdRaw}.${expiryRaw}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return { userId };
}

export function sessionCookie(token: string | null): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (!token) {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
  }
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export function readSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}
