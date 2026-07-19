import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueCounts } from "@/lib/queues";
import { Stat } from "@/components/ui";
import { RetryButton } from "./queue-client";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = (await getSession())!;
  const where = { project: { userId: session.userId } };

  const [counts, failed] = await Promise.all([
    queueCounts().catch(() => null),
    db.url.findMany({
      where: { ...where, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { project: { select: { host: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Queue & Failures</h1>

      {counts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Waiting (submit)" value={counts.submit.waiting ?? 0} />
          <Stat label="Active (submit)" value={counts.submit.active ?? 0} />
          <Stat label="Waiting (crawl)" value={counts.crawl.waiting ?? 0} />
          <Stat label="Active (crawl)" value={counts.crawl.active ?? 0} />
        </div>
      ) : (
        <p className="card text-sm text-amber-700">Queue stats unavailable — is Redis running?</p>
      )}

      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Failed URLs {failed.length ? `(${failed.length})` : ""}</h2>
          {failed.length > 0 && <RetryButton />}
        </div>
        {failed.length === 0 ? (
          <p className="text-sm text-slate-500">No failures — everything in your account has been processed cleanly.</p>
        ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">URL</th>
                <th className="pb-2 pr-3">Project</th>
                <th className="pb-2 pr-3">Attempts</th>
                <th className="pb-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {failed.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="max-w-[280px] truncate py-2 pr-3 font-mono text-xs">{u.url}</td>
                  <td className="py-2 pr-3 text-xs">{u.project.host}</td>
                  <td className="py-2 pr-3 tabular-nums">{u.attempts}</td>
                  <td className="max-w-[240px] truncate py-2 text-xs text-red-600">{u.lastError}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
