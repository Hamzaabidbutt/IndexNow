import { db } from "@/lib/db";
import { normalizeUrl, submitUrlsSchema } from "@/lib/validation";
import { apiError, audit, chargeCredits, guard, json } from "@/lib/api";
import { crawlQueue, priorityValue, submitQueue } from "@/lib/queues";

/**
 * Public REST API (X-Api-Key auth).
 *
 * POST /api/v1/submit
 * { "urls": ["https://…"], "priority": "HIGH", "project": "example.com" }
 *
 * URLs are grouped into the caller's matching project by host; a project is
 * auto-created per host when none exists.
 */
export async function POST(req: Request) {
  const { user, errorResponse } = await guard(req, { limit: 300 });
  if (errorResponse || !user) return errorResponse!;

  const raw = await req.json().catch(() => null);
  const parsed = submitUrlsSchema.safeParse(raw);
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");

  const invalid: string[] = [];
  const byHost = new Map<string, Set<string>>();
  for (const rawUrl of parsed.data.urls) {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) {
      invalid.push(rawUrl);
      continue;
    }
    const host = new URL(normalized).host;
    const set = byHost.get(host) ?? new Set<string>();
    set.add(normalized);
    byHost.set(host, set);
  }
  if (!byHost.size) return apiError(400, `No valid URLs (${invalid.length} invalid).`);

  let accepted = 0;
  let duplicates = 0;
  const allIds: string[] = [];

  for (const [host, urlSet] of byHost) {
    const project = await db.project.upsert({
      where: { userId_host: { userId: user.id, host } },
      update: {},
      create: { userId: user.id, name: host, host },
    });
    const urls = [...urlSet];
    const existing = await db.url.findMany({
      where: { projectId: project.id, url: { in: urls } },
      select: { url: true },
    });
    const existingSet = new Set(existing.map((e) => e.url));
    const fresh = urls.filter((u) => !existingSet.has(u));
    duplicates += urls.length - fresh.length;

    if (!fresh.length) continue;
    if (!(await chargeCredits(user.id, fresh.length))) {
      return apiError(402, `Insufficient credits (needed ${fresh.length} more). Partial batch already accepted: ${accepted}.`);
    }
    const created = await db.$transaction(
      fresh.map((url) =>
        db.url.create({
          data: { projectId: project.id, url, priority: parsed.data.priority },
          select: { id: true },
        })
      )
    );
    accepted += created.length;
    allIds.push(...created.map((c) => c.id));
  }

  if (allIds.length) {
    const prio = priorityValue(parsed.data.priority);
    await submitQueue().add("api-batch", { urlIds: allIds, userId: user.id }, { priority: prio });
    await crawlQueue().addBulk(
      allIds.map((urlId) => ({ name: "crawl", data: { urlId, userId: user.id }, opts: { priority: prio } }))
    );
  }
  await audit(user.id, "api.submit", { accepted, duplicates, invalid: invalid.length }, req);

  return json({ accepted, duplicates, invalid: invalid.length, credits_remaining: (await db.user.findUnique({ where: { id: user.id }, select: { credits: true } }))?.credits }, { status: 202 });
}
