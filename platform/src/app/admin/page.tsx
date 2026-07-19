import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueCounts } from "@/lib/queues";
import { Stat } from "@/components/ui";
import Link from "next/link";
import { AdminRetryButton } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");

  const [users, projects, urls, failed, queues, recentUsers, audit] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.url.count(),
    db.url.count({ where: { status: "FAILED" } }),
    queueCounts().catch(() => null),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, email: true, plan: true, credits: true, createdAt: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { email: true } } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <Link href="/dashboard" className="btn-secondary !py-1.5 text-xs">← Dashboard</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={users} />
        <Stat label="Projects" value={projects} />
        <Stat label="URLs" value={urls.toLocaleString()} />
        <Stat label="Failed URLs" value={failed} sub={queues ? `Queues: ${queues.submit.waiting ?? 0} waiting / ${queues.submit.failed ?? 0} failed` : "Redis offline"} />
      </div>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Operations</h2>
          <AdminRetryButton />
        </div>
        <p className="text-sm text-slate-600">Re-queues every FAILED URL across all accounts with fresh retry budgets.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-base font-bold">Newest users</h2>
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs uppercase text-slate-500"><th className="pb-2 pr-3">Email</th><th className="pb-2 pr-3">Plan</th><th className="pb-2">Credits</th></tr></thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3"><span className="pill-blue">{u.plan}</span></td>
                  <td className="py-2 tabular-nums">{u.credits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-base font-bold">Audit trail</h2>
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="font-mono text-xs text-slate-400">{a.createdAt.toISOString().slice(11, 19)}</span>
                <span className="font-semibold">{a.action}</span>
                <span className="truncate text-slate-500">{a.user?.email ?? "system"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
