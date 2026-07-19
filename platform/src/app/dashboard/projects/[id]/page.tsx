import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatusPill, ScoreBadge } from "@/components/ui";
import { SubmitUrlsForm, VerifyPanel } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  const session = (await getSession())!;
  const project = await db.project.findFirst({ where: { id: params.id, userId: session.userId } });
  if (!project) notFound();

  const urls = await db.url.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { crawlChecks: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{project.name}</h1>
          <p className="font-mono text-sm text-slate-500">{project.host}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a className="btn-secondary !py-1.5 text-xs" href={`/api/projects/${project.id}/artifacts?type=sitemap`} target="_blank">Sitemap XML</a>
          <a className="btn-secondary !py-1.5 text-xs" href={`/api/projects/${project.id}/artifacts?type=rss`} target="_blank">RSS feed</a>
          <a className="btn-secondary !py-1.5 text-xs" href={`/api/projects/${project.id}/artifacts?type=linkhub`} target="_blank">Link hub</a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SubmitUrlsForm projectId={project.id} />

          <section className="card overflow-x-auto">
            <h2 className="mb-4 text-base font-bold">URLs ({urls.length >= 100 ? "latest 100" : urls.length})</h2>
            {urls.length === 0 ? (
              <p className="text-sm text-slate-500">No URLs submitted yet.</p>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3">URL</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Crawl score</th>
                    <th className="pb-2 pr-3">Attempts</th>
                    <th className="pb-2">Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 align-top">
                      <td className="max-w-[300px] truncate py-2 pr-3 font-mono text-xs">{u.url}</td>
                      <td className="py-2 pr-3"><StatusPill status={u.status} /></td>
                      <td className="py-2 pr-3"><ScoreBadge score={u.crawlChecks[0]?.score} /></td>
                      <td className="py-2 pr-3 tabular-nums">{u.attempts}</td>
                      <td className="max-w-[200px] truncate py-2 text-xs text-red-600">{u.lastError ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <VerifyPanel projectId={project.id} verified={project.verified} method={project.verificationMethod} />
      </div>
    </div>
  );
}
