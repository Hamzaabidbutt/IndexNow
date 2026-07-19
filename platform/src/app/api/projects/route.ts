import { db } from "@/lib/db";
import { projectSchema } from "@/lib/validation";
import { apiError, audit, guard, json } from "@/lib/api";

export async function GET(req: Request) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { urls: true } } },
  });
  return json({ projects });
}

export async function POST(req: Request) {
  const { user, errorResponse } = await guard(req, { limit: 30 });
  if (errorResponse || !user) return errorResponse!;

  const parsed = projectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await db.project.findUnique({
    where: { userId_host: { userId: user.id, host: parsed.data.host } },
  });
  if (existing) return apiError(409, "You already have a project for this host");

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      host: parsed.data.host,
      sitemapUrl: parsed.data.sitemapUrl ?? null,
    },
  });
  await audit(user.id, "project.create", { host: project.host }, req);
  return json({ project }, { status: 201 });
}
