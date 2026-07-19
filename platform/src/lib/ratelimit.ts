import { getRedis } from "./redis";

export type RateLimitResult = { allowed: boolean; remaining: number; resetInSec: number };

/**
 * Fixed-window rate limiter backed by Redis.
 * Key by user id (authenticated) or IP (anonymous).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redis = getRedis();
  const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const count = await redis.incr(bucket);
  if (count === 1) await redis.expire(bucket, windowSec);
  const ttl = await redis.ttl(bucket);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetInSec: Math.max(0, ttl),
  };
}

export function rateLimitHeaders(r: RateLimitResult, limit: number): HeadersInit {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(r.resetInSec),
    ...(r.allowed ? {} : { "Retry-After": String(r.resetInSec) }),
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
