import { db } from "@/lib/db";
import { apiError, audit, guard, json } from "@/lib/api";
import { z } from "zod";

async function ownedProject(userId: string, id: string) {
  return db.project.findFirst({ where: { id, userId } });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await ownedProject(user.id, params.id);
  if (!project) return apiError(404, "Project not found");

  const [urlStats, recentChecks] = await Promise.all([
    db.url.groupBy({ by: ["status"], where: { projectId: project.id }, _count: true }),
    db.crawlCheck.findMany({
      where: { url: { projectId: project.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { url: { select: { url: true } } },
    }),
  ]);
  return json({ project, urlStats, recentChecks });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sitemapUrl: z.string().url().max(2048).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await ownedProject(user.id, params.id);
  if (!project) return apiError(404, "Project not found");

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, "Invalid input");

  const updated = await db.project.update({ where: { id: project.id }, data: parsed.data });
  return json({ project: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await ownedProject(user.id, params.id);
  if (!project) return apiError(404, "Project not found");

  await db.project.delete({ where: { id: project.id } });
  await audit(user.id, "project.delete", { host: project.host }, req);
  return json({ ok: true });
}
