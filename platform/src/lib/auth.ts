import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "ijp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (>= 32 chars).");
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; role: "USER" | "ADMIN" };

export async function createSession(userId: string, role: Session["role"]) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { userId: payload.sub, role: (payload.role as Session["role"]) ?? "USER" };
  } catch {
    return null;
  }
}

/** For API routes: session cookie OR X-Api-Key header. Returns the user or null. */
export async function authenticateRequest(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = hashApiKey(apiKey);
    const record = await db.apiKey.findUnique({ where: { keyHash }, include: { user: true } });
    if (!record || record.revokedAt) return null;
    await db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return record.user;
  }
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.userId } });
}

// ---------- passwords ----------
export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// ---------- API keys ----------
export function generateApiKey(): { plaintext: string; keyHash: string; prefix: string } {
  const plaintext = `ijp_live_${randomBytes(24).toString("hex")}`;
  return { plaintext, keyHash: hashApiKey(plaintext), prefix: plaintext.slice(0, 12) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
