/**
 * IndexJet background worker process.
 *
 * Runs three BullMQ workers with parallel processing:
 *  - submit:  pushes URL batches to IndexNow (+ Google when configured)
 *  - crawl:   runs crawlability diagnostics for any URL, any domain
 *  - monitor: polls project sitemaps and auto-enqueues new/changed URLs
 *
 * Start with: npm run worker   (separate process/container from the web app)
 */
import { Worker, Job } from "bullmq";
import { db } from "../lib/db";
import { getRedis, publishEvent } from "../lib/redis";
import {
  QUEUE_SUBMIT,
  QUEUE_CRAWL,
  QUEUE_MONITOR,
  type SubmitJob,
  type CrawlJob,
  type MonitorJob,
  crawlQueue,
  monitorQueue,
  submitQueue,
  priorityValue,
} from "../lib/queues";
import { groupByHost, submitToIndexNow } from "../lib/services/indexnow";
import { googleEnabled, submitToGoogle } from "../lib/services/google";
import { runCrawlCheck } from "../lib/services/crawlcheck";
import { fetchSitemapUrls } from "../lib/services/discovery";

const log = (scope: string, msg: string, extra: object = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), scope, msg, ...extra }));

// ============================== submit worker ==============================

async function processSubmit(job: Job<SubmitJob>) {
  const { urlIds, userId } = job.data;
  const urls = await db.url.findMany({
    where: { id: { in: urlIds } },
    include: { project: true },
  });
  if (!urls.length) return;

  await db.url.updateMany({ where: { id: { in: urlIds } }, data: { status: "PROCESSING" } });
  await publishEvent(userId, { type: "batch.processing", count: urls.length });

  const byHost = groupByHost(urls.map((u) => u.url));
  const hostResults = new Map<string, { status: number; ok: boolean; message: string }>();

  for (const [host, hostUrls] of byHost) {
    try {
      const result = await submitToIndexNow(host, hostUrls);
      hostResults.set(host, result);
      log("submit", `IndexNow ${host}`, { status: result.status, urls: hostUrls.length });
    } catch (err) {
      hostResults.set(host, { status: 0, ok: false, message: (err as Error).message });
    }
  }

  const useGoogle = googleEnabled();

  for (const url of urls) {
    const host = new URL(url.url).host;
    const inResult = hostResults.get(host)!;
    const engineResults: Record<string, unknown> = {
      indexnow: { status: inResult.status, ok: inResult.ok, message: inResult.message, at: new Date().toISOString() },
    };

    let googleOk = false;
    if (useGoogle && url.project.verified) {
      try {
        const g = await submitToGoogle(url.url);
        googleOk = g.ok;
        engineResults.google = { status: g.status, ok: g.ok, message: g.message, at: new Date().toISOString() };
        await new Promise((r) => setTimeout(r, 250)); // stay under per-minute quota
      } catch (err) {
        engineResults.google = { status: 0, ok: false, message: (err as Error).message };
      }
    }

    const anyOk = inResult.ok || googleOk;
    await db.url.update({
      where: { id: url.id },
      data: {
        status: anyOk ? "SUBMITTED" : "FAILED",
        attempts: { increment: 1 },
        lastError: anyOk ? null : inResult.message,
        engineResults: engineResults as object,
        submittedAt: anyOk ? new Date() : undefined,
      },
    });
  }

  const okCount = urls.filter((u) => hostResults.get(new URL(u.url).host)?.ok).length;
  await publishEvent(userId, { type: "batch.done", ok: okCount, failed: urls.length - okCount });

  // Throw when everything failed so BullMQ retries with backoff
  if (okCount === 0) {
    throw new Error([...hostResults.values()].map((r) => r.message).join("; "));
  }
}

// ============================== crawl worker ==============================

async function processCrawl(job: Job<CrawlJob>) {
  const { urlId, userId } = job.data;
  const url = await db.url.findUnique({ where: { id: urlId } });
  if (!url) return;

  const report = await runCrawlCheck(url.url);
  await db.crawlCheck.create({
    data: {
      urlId,
      httpStatus: report.httpStatus,
      redirectChain: report.redirectChain,
      responseTimeMs: report.responseTimeMs,
      etag: report.etag,
      lastModified: report.lastModified,
      contentType: report.contentType,
      robotsAllowed: report.robotsAllowed,
      metaRobots: report.metaRobots,
      canonicalUrl: report.canonicalUrl,
      canonicalOk: report.canonicalOk,
      title: report.title,
      h1Count: report.h1Count,
      hasStructuredData: report.hasStructuredData,
      htmlValid: report.htmlValid,
      sitemapListed: report.sitemapListed,
      score: report.score,
      findings: report.findings,
    },
  });

  // Unverified-domain URLs finish as DISCOVERED once diagnostics complete
  if (url.status === "QUEUED" || url.status === "PROCESSING") {
    await db.url.update({
      where: { id: urlId },
      data: { status: url.status === "PROCESSING" ? url.status : "DISCOVERED" },
    });
  }
  await publishEvent(userId, { type: "crawl.done", urlId, score: report.score });
  log("crawl", url.url, { score: report.score });
}

// ============================== monitor worker ==============================

async function processMonitor(job: Job<MonitorJob>) {
  const project = await db.project.findUnique({ where: { id: job.data.projectId } });
  if (!project?.sitemapUrl) return;

  const entries = await fetchSitemapUrls(project.sitemapUrl);
  const cutoff = Date.now() - 6.5 * 3600 * 1000; // slightly over the 6h schedule
  const fresh = entries.filter((e) => e.lastmod && new Date(e.lastmod).getTime() >= cutoff).slice(0, 1000);
  if (!fresh.length) {
    log("monitor", `No fresh URLs in ${project.sitemapUrl}`);
    return;
  }

  const created: string[] = [];
  for (const e of fresh) {
    const u = await db.url.upsert({
      where: { projectId_url: { projectId: project.id, url: e.loc } },
      update: { status: "QUEUED" },
      create: { projectId: project.id, url: e.loc, status: "QUEUED" },
    });
    created.push(u.id);
  }
  await submitQueue().add("sitemap-fresh", { urlIds: created, userId: project.userId });
  log("monitor", `Queued ${created.length} fresh URLs from ${project.sitemapUrl}`);
}

// ============================== bootstrap ==============================

async function main() {
  const connection = getRedis();
  const workers = [
    new Worker<SubmitJob>(QUEUE_SUBMIT, processSubmit, { connection, concurrency: 4 }),
    new Worker<CrawlJob>(QUEUE_CRAWL, processCrawl, { connection, concurrency: 8 }),
    new Worker<MonitorJob>(QUEUE_MONITOR, processMonitor, { connection, concurrency: 2 }),
  ];
  for (const w of workers) {
    w.on("failed", (job, err) => log(w.name, `job ${job?.id} failed`, { error: err.message, attempts: job?.attemptsMade }));
    w.on("error", (err) => log(w.name, "worker error", { error: err.message }));
  }

  // Re-arm sitemap monitoring for every project with a sitemap (6-hourly, spread by project)
  const projects = await db.project.findMany({ where: { sitemapUrl: { not: null } }, select: { id: true } });
  for (const p of projects) {
    await monitorQueue().add(
      `monitor:${p.id}`,
      { projectId: p.id },
      { repeat: { every: 6 * 3600 * 1000 }, jobId: `monitor:${p.id}` }
    );
  }

  log("worker", `Started. submit/crawl/monitor workers online; ${projects.length} sitemap monitors armed.`);

  const shutdown = async () => {
    log("worker", "Shutting down…");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
