import { db } from "@/lib/db";
import { submitQueue } from "@/lib/queues";
import { apiError, audit, guard, json } from "@/lib/api";

/** Re-queue all FAILED URLs (admin), or the caller's own failed URLs. */
export async function POST(req: Request) {
  const { user, errorResponse } = await guard(req, { limit: 10 });
  if (errorResponse || !user) return errorResponse!;

  const scopeAll = user.role === "ADMIN" && new URL(req.url).searchParams.get("scope") === "all";
  const failed = await db.url.findMany({
    where: { status: "FAILED", ...(scopeAll ? {} : { project: { userId: user.id } }) },
    select: { id: true, project: { select: { userId: true } } },
    take: 5000,
  });
  if (!failed.length) return json({ requeued: 0 });

  await db.url.updateMany({ where: { id: { in: failed.map((f) => f.id) } }, data: { status: "QUEUED", lastError: null } });

  // Group by owner so worker events reach the right dashboards
  const byOwner = new Map<string, string[]>();
  for (const f of failed) {
    const list = byOwner.get(f.project.userId) ?? [];
    list.push(f.id);
    byOwner.set(f.project.userId, list);
  }
  for (const [ownerId, urlIds] of byOwner) {
    await submitQueue().add("retry-failed", { urlIds, userId: ownerId });
  }

  await audit(user.id, "url.retry", { count: failed.length, scopeAll }, req);
  return json({ requeued: failed.length });
}
