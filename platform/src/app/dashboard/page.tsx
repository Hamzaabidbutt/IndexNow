import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Stat, StatusPill } from "@/components/ui";
import { LiveFeed } from "./nav-client";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const session = (await getSession())!;
  const where = { project: { userId: session.userId } };

  const [total, submitted, failed, queued, recent, user] = await Promise.all([
    db.url.count({ where }),
    db.url.count({ where: { ...where, status: "SUBMITTED" } }),
    db.url.count({ where: { ...where, status: "FAILED" } }),
    db.url.count({ where: { ...where, status: { in: ["QUEUED", "PROCESSING"] } } }),
    db.url.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { project: { select: { host: true } }, crawlChecks: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.user.findUnique({ where: { id: session.userId } }),
  ]);
  const successRate = total ? Math.round((submitted / total) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total URLs" value={total.toLocaleString()} />
        <Stat label="Submitted" value={submitted.toLocaleString()} sub={`${successRate}% success rate`} />
        <Stat label="In queue" value={queued.toLocaleString()} />
        <Stat label="Failed" value={failed.toLocaleString()} sub={`${user?.credits.toLocaleString()} credits remaining`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-base font-bold">Live activity</h2>
          <LiveFeed />
        </section>
        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-base font-bold">Recent URLs</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing yet — create a project and submit your first URLs.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3">URL</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="max-w-[260px] truncate py-2 pr-3 font-mono text-xs">{u.url}</td>
                    <td className="py-2 pr-3"><StatusPill status={u.status} /></td>
                    <td className="py-2 tabular-nums">{u.crawlChecks[0]?.score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
