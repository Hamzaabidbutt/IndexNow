import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateProjectForm } from "./project-client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = (await getSession())!;
  const projects = await db.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { urls: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Projects</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {projects.length === 0 && (
            <div className="card text-center text-sm text-slate-500">
              No projects yet. A project groups URLs for one host — create your first on the right.
            </div>
          )}
          {projects.map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="card flex items-center justify-between transition hover:border-blue-300 hover:shadow-md">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="font-mono text-xs text-slate-500">{p.host}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="tabular-nums text-slate-600">{p._count.urls.toLocaleString()} URLs</span>
                {p.verified ? <span className="pill-green">Verified</span> : <span className="pill-amber">Unverified</span>}
              </div>
            </Link>
          ))}
        </section>
        <CreateProjectForm />
      </div>
    </div>
  );
}
