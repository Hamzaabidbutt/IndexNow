import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { authenticateRequest } from "./auth";
import { db } from "./db";
import { clientIp, rateLimit, rateLimitHeaders } from "./ratelimit";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(status: number, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

/**
 * Authenticate (session cookie or X-Api-Key) and rate-limit in one step.
 * Anonymous requests are limited by IP.
 */
export async function guard(
  req: Request,
  { limit = 120, windowSec = 60, requireAuth = true }: { limit?: number; windowSec?: number; requireAuth?: boolean } = {}
): Promise<{ user: User | null; errorResponse: NextResponse | null }> {
  const user = await authenticateRequest(req);
  if (requireAuth && !user) {
    return { user: null, errorResponse: apiError(401, "Authentication required") };
  }
  const rlKey = user ? `u:${user.id}` : `ip:${clientIp(req)}`;
  const rl = await rateLimit(rlKey, limit, windowSec);
  if (!rl.allowed) {
    return {
      user,
      errorResponse: apiError(429, "Too many requests", rateLimitHeaders(rl, limit)),
    };
  }
  return { user, errorResponse: null };
}

export async function audit(userId: string | null, action: string, detail?: object, req?: Request) {
  await db.auditLog
    .create({ data: { userId, action, detail: detail as object, ip: req ? clientIp(req) : null } })
    .catch(() => {}); // auditing must never break the request path
}

/** Charge URL credits atomically; returns false when the balance is insufficient. */
export async function chargeCredits(userId: string, amount: number): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId, credits: { gte: amount } },
    data: { credits: { decrement: amount }, creditsUsed: { increment: amount } },
  });
  return result.count === 1;
}
