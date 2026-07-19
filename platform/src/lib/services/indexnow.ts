/**
 * IndexNow submission — reaches Bing, Yandex, Seznam.cz, Naver and every
 * other participating engine through the shared api.indexnow.org endpoint.
 *
 * Ownership model: engines only accept URLs for hosts that serve the key
 * file at https://<host>/<key>.txt. Verified projects instruct the owner to
 * host it; unverified submissions are attempted and reported honestly.
 */

export type IndexNowResult = {
  host: string;
  status: number;
  ok: boolean;
  message: string;
};

const ENDPOINT = "https://api.indexnow.org/indexnow";

const STATUS_MEANING: Record<number, string> = {
  200: "Accepted",
  202: "Accepted — key validation pending",
  400: "Bad request",
  403: "Key file not found on host — ownership not proven",
  422: "URLs don't match host or key mismatch",
  429: "Rate limited by IndexNow",
};

export function getIndexNowKey(): string {
  const key = process.env.INDEXNOW_KEY;
  if (!key || !/^[a-f0-9]{16,64}$/i.test(key)) {
    throw new Error("INDEXNOW_KEY env var must be a 16–64 char hex string.");
  }
  return key;
}

/** Submit a batch of same-host URLs. Caller groups by host. */
export async function submitToIndexNow(host: string, urls: string[]): Promise<IndexNowResult> {
  const key = getIndexNowKey();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: urls.slice(0, 10_000),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const ok = res.status === 200 || res.status === 202;
  return {
    host,
    status: res.status,
    ok,
    message: STATUS_MEANING[res.status] ?? `HTTP ${res.status}`,
  };
}

export function groupByHost(urls: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const u of urls) {
    const host = new URL(u).host;
    const list = groups.get(host) ?? [];
    list.push(u);
    groups.set(host, list);
  }
  return groups;
}
