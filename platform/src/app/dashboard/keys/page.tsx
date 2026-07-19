import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { KeyManager } from "./keys-client";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const session = (await getSession())!;
  const keys = await db.apiKey.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">API Keys</h1>
      <KeyManager
        keys={keys.map((k) => ({
          ...k,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />
      <section className="card">
        <h2 className="mb-3 text-base font-bold">Usage</h2>
        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-200">{`curl -X POST ${process.env.APP_URL ?? "https://your-host"}/api/v1/submit \\
  -H "X-Api-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"urls": ["https://example.com/new-page"], "priority": "HIGH"}'`}</pre>
        <p className="mt-3 text-xs text-slate-500">
          Rate limit: 300 requests/min per key. Responses include X-RateLimit-* headers. URLs are auto-grouped into
          per-host projects.
        </p>
      </section>
    </div>
  );
}
