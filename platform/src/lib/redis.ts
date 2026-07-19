import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });
  }
  return globalForRedis.redis;
}

/** Publish a realtime event to a user's SSE stream. */
export async function publishEvent(userId: string, event: Record<string, unknown>) {
  await getRedis().publish(`events:${userId}`, JSON.stringify({ ...event, at: Date.now() }));
}
