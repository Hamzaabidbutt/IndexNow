import { db } from "@/lib/db";
import { queueCounts } from "@/lib/queues";
import { apiError, guard, json } from "@/lib/api";

export async function GET(req: Request) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;
  if (user.role !== "ADMIN") return apiError(403, "Admin access required");

  const [users, projects, urls, failed, queues, recentAudit] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.url.count(),
    db.url.count({ where: { status: "FAILED" } }),
    queueCounts(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { user: { select: { email: true } } } }),
  ]);
  return json({ users, projects, urls, failed, queues, recentAudit });
}
