import { db } from "@/lib/db";
import { buildLinkHub, buildRss, buildSitemap } from "@/lib/services/discovery";
import { apiError, guard } from "@/lib/api";

/**
 * Discovery artifacts generated from the project's URL set:
 *   ?type=sitemap  → XML sitemap (deploy at /sitemap.xml, reference in robots.txt)
 *   ?type=rss      → RSS 2.0 feed of latest URLs
 *   ?type=linkhub  → HTML snippet for an internal-link hub page
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await db.project.findFirst({ where: { id: params.id, userId: user.id } });
  if (!project) return apiError(404, "Project not found");

  const urls = await db.url.findMany({
    where: { projectId: project.id, status: { notIn: ["FAILED", "CANCELLED"] } },
    orderBy: { updatedAt: "desc" },
    select: { url: true, updatedAt: true },
  });
  const entries = urls.map((u) => ({ url: u.url, updatedAt: u.updatedAt }));

  const type = new URL(req.url).searchParams.get("type") ?? "sitemap";
  switch (type) {
    case "sitemap":
      return new Response(buildSitemap(entries), {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    case "rss":
      return new Response(buildRss(project.name, `https://${project.host}/`, entries), {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
    case "linkhub":
      return new Response(buildLinkHub(entries), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    default:
      return apiError(400, "type must be sitemap, rss or linkhub");
  }
}
