import { Queue } from "bullmq";
import { getRedis } from "./redis";

export const QUEUE_SUBMIT = "submit";
export const QUEUE_CRAWL = "crawl";
export const QUEUE_MONITOR = "monitor";

export type SubmitJob = { urlIds: string[]; userId: string };
export type CrawlJob = { urlId: string; userId: string };
export type MonitorJob = { projectId: string };

const globalForQueues = globalThis as unknown as {
  submitQueue?: Queue<SubmitJob>;
  crawlQueue?: Queue<CrawlJob>;
  monitorQueue?: Queue<MonitorJob>;
};

const PRIORITY_MAP = { HIGH: 1, NORMAL: 5, LOW: 10 } as const;

export function priorityValue(p: keyof typeof PRIORITY_MAP): number {
  return PRIORITY_MAP[p];
}

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 }, // 30s → 1m → 2m → 4m
  removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
  removeOnFail: { age: 30 * 24 * 3600 },
};

export function submitQueue(): Queue<SubmitJob> {
  if (!globalForQueues.submitQueue) {
    globalForQueues.submitQueue = new Queue(QUEUE_SUBMIT, { connection: getRedis(), defaultJobOptions });
  }
  return globalForQueues.submitQueue;
}

export function crawlQueue(): Queue<CrawlJob> {
  if (!globalForQueues.crawlQueue) {
    globalForQueues.crawlQueue = new Queue(QUEUE_CRAWL, {
      connection: getRedis(),
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    });
  }
  return globalForQueues.crawlQueue;
}

export function monitorQueue(): Queue<MonitorJob> {
  if (!globalForQueues.monitorQueue) {
    globalForQueues.monitorQueue = new Queue(QUEUE_MONITOR, { connection: getRedis(), defaultJobOptions });
  }
  return globalForQueues.monitorQueue;
}

export async function queueCounts() {
  const [submit, crawl] = await Promise.all([
    submitQueue().getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    crawlQueue().getJobCounts("waiting", "active", "completed", "failed", "delayed"),
  ]);
  return { submit, crawl };
}
