import Redis from "ioredis";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream for realtime dashboard updates.
 * Workers publish to Redis channel events:<userId>; this route relays them.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Dedicated connection — subscriber mode blocks the shared client
  const sub = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  const channel = `events:${session.userId}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          /* stream already closed */
        }
      };
      await sub.subscribe(channel);
      sub.on("message", (_ch, message) => send(message));
      send(JSON.stringify({ type: "connected" }));
      const ping = setInterval(() => send(JSON.stringify({ type: "ping" })), 25_000);
      const cleanup = () => {
        clearInterval(ping);
        sub.quit().catch(() => {});
      };
      sub.on("end", cleanup);
    },
    cancel() {
      sub.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
