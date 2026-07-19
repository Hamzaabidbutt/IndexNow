import { db } from "@/lib/db";
import { submitUrlsSchema, normalizeUrl } from "@/lib/validation";
import { apiError, audit, chargeCredits, guard, json } from "@/lib/api";
import { crawlQueue, priorityValue, submitQueue } from "@/lib/queues";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req);
  if (errorResponse || !user) return errorResponse!;

  const project = await db.project.findFirst({ where: { id: params.id, userId: user.id } });
  if (!project) return apiError(404, "Project not found");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const cursor = searchParams.get("cursor") ?? undefined;
  const take = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const urls = await db.url.findMany({
    where: { projectId: project.id, ...(status ? { status: status as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { crawlChecks: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const nextCursor = urls.length > take ? urls.pop()!.id : null;
  return json({ urls, nextCursor });
}

/**
 * Bulk URL submission. Any URL, any domain:
 *  - every URL gets a crawlability-diagnostic job
 *  - URLs on the project's (or any) host also get an engine-submission job;
 *    engines accept them once the host serves the IndexNow key file
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, errorResponse } = await guard(req, { limit: 60 });
  if (errorResponse || !user) return errorResponse!;

  const project = await db.project.findFirst({ where: { id: params.id, userId: user.id } });
  if (!project) return apiError(404, "Project not found");

  const parsed = submitUrlsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");

  // Validate + normalize + dedupe
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.data.urls) {
    const normalized = normalizeUrl(raw);
    if (!normalized) invalid.push(raw);
    else seen.add(normalized);
  }
  const clean = [...seen];
  if (!clean.length) return apiError(400, `No valid URLs. ${invalid.length} line(s) failed validation.`);

  // Skip URLs already submitted in this project (free dedupe)
  const existing = await db.url.findMany({
    where: { projectId: project.id, url: { in: clean } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map((e) => e.url));
  const fresh = clean.filter((u) => !existingSet.has(u));

  if (fresh.length && !(await chargeCredits(user.id, fresh.length))) {
    return apiError(402, `Insufficient credits: ${fresh.length} needed. Upgrade your plan or reduce the batch.`);
  }

  const created = await db.$transaction(
    fresh.map((url) =>
      db.url.create({
        data: { projectId: project.id, url, priority: parsed.data.priority },
        select: { id: true },
      })
    )
  );
  const urlIds = created.map((c) => c.id);

  if (urlIds.length) {
    const prio = priorityValue(parsed.data.priority);
    await submitQueue().add("user-batch", { urlIds, userId: user.id }, { priority: prio });
    await crawlQueue().addBulk(
      urlIds.map((urlId) => ({ name: "crawl", data: { urlId, userId: user.id }, opts: { priority: prio } }))
    );
  }

  await audit(user.id, "url.submit", { project: project.host, count: urlIds.length, invalid: invalid.length }, req);
  return json(
    {
      accepted: urlIds.length,
      duplicates: clean.length - fresh.length,
      invalid: invalid.length,
      creditsCharged: fresh.length,
    },
    { status: 202 }
  );
}
