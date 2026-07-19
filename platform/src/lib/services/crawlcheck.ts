/**
 * Crawlability analysis — works for ANY URL on ANY domain, no ownership
 * needed. Fetches the page like a crawler would and produces a scored
 * diagnostic report: status, redirects, robots, canonical, meta robots,
 * structured data, caching headers, sitemap listing.
 */

const UA = "IndexJetBot/1.0 (+https://hamzaabidbutt.github.io/IndexNow/; crawlability check)";
const FETCH_TIMEOUT = 20_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB of HTML is plenty for analysis

export type CrawlReport = {
  httpStatus: number | null;
  redirectChain: string[];
  responseTimeMs: number | null;
  etag: string | null;
  lastModified: string | null;
  contentType: string | null;
  robotsAllowed: boolean | null;
  metaRobots: string | null;
  canonicalUrl: string | null;
  canonicalOk: boolean | null;
  title: string | null;
  h1Count: number | null;
  hasStructuredData: boolean | null;
  htmlValid: boolean | null;
  sitemapListed: boolean | null;
  score: number;
  findings: { level: "ok" | "warn" | "error"; check: string; message: string }[];
};

// ---------- robots.txt ----------

type RobotsRules = { allow: string[]; disallow: string[]; sitemaps: string[] };

export function parseRobots(txt: string, agent = "*"): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  let applies = false;
  let sawAnyAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      // A new agent group starts; matches our agent or wildcard
      applies = value === "*" || agent.toLowerCase().includes(value.toLowerCase());
      sawAnyAgent = true;
    } else if (field === "sitemap") {
      rules.sitemaps.push(value);
    } else if (applies || !sawAnyAgent) {
      if (field === "allow" && value) rules.allow.push(value);
      if (field === "disallow" && value) rules.disallow.push(value);
    }
  }
  return rules;
}

/** Longest-match precedence, Allow wins ties — mirrors Google's documented behavior. */
export function robotsAllows(rules: RobotsRules, path: string): boolean {
  const match = (patterns: string[]) => {
    let best = -1;
    for (const p of patterns) {
      const rx = new RegExp(
        "^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")
      );
      if (rx.test(path) && p.length > best) best = p.length;
    }
    return best;
  };
  const allowLen = match(rules.allow);
  const disallowLen = match(rules.disallow);
  if (disallowLen === -1) return true;
  return allowLen >= disallowLen;
}

// ---------- HTML extraction (regex-based; resilient to invalid markup) ----------

function extract(html: string) {
  const head = html.slice(0, 500_000);
  const title = head.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim() ?? null;
  const metaRobots =
    head.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']robots["']/i)?.[1] ??
    null;
  const canonical =
    head.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
    head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ??
    null;
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const hasStructuredData =
    /<script[^>]+type=["']application\/ld\+json["']/i.test(html) ||
    /itemscope/i.test(head) ||
    /property=["']og:/i.test(head);
  const htmlValid =
    /<!doctype html/i.test(html.slice(0, 200)) && /<html[\s>]/i.test(head) && /<\/html>/i.test(html.slice(-2000));
  return { title, metaRobots, canonical, h1Count, hasStructuredData, htmlValid };
}

// ---------- main ----------

async function fetchWithLimit(url: string, method: "GET" | "HEAD" = "GET") {
  const res = await fetch(url, {
    method,
    redirect: "manual",
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  return res;
}

export async function runCrawlCheck(targetUrl: string): Promise<CrawlReport> {
  const findings: CrawlReport["findings"] = [];
  const chain: string[] = [targetUrl];
  const target = new URL(targetUrl);

  // 1. robots.txt
  let robotsAllowed: boolean | null = null;
  let robotsSitemaps: string[] = [];
  try {
    const robotsRes = await fetch(`${target.origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (robotsRes.ok) {
      const rules = parseRobots(await robotsRes.text());
      robotsSitemaps = rules.sitemaps;
      robotsAllowed = robotsAllows(rules, target.pathname + target.search);
      findings.push(
        robotsAllowed
          ? { level: "ok", check: "robots.txt", message: "Crawling allowed for all user agents" }
          : { level: "error", check: "robots.txt", message: "URL is DISALLOWED by robots.txt — crawlers cannot fetch it" }
      );
    } else {
      robotsAllowed = true; // no robots.txt = allowed
      findings.push({ level: "ok", check: "robots.txt", message: `No robots.txt (HTTP ${robotsRes.status}) — crawling allowed by default` });
    }
  } catch {
    findings.push({ level: "warn", check: "robots.txt", message: "robots.txt could not be fetched" });
  }

  // 2. Fetch page, following up to 5 redirects manually
  let res: Response | null = null;
  let currentUrl = targetUrl;
  const started = Date.now();
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetchWithLimit(currentUrl);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        currentUrl = new URL(loc, currentUrl).toString();
        chain.push(currentUrl);
        continue;
      }
      break;
    }
  } catch (err) {
    findings.push({ level: "error", check: "fetch", message: `Page could not be fetched: ${(err as Error).message}` });
  }
  const responseTimeMs = Date.now() - started;

  const httpStatus = res?.status ?? null;
  const etag = res?.headers.get("etag") ?? null;
  const lastModified = res?.headers.get("last-modified") ?? null;
  const contentType = res?.headers.get("content-type") ?? null;

  if (httpStatus !== null) {
    if (httpStatus === 200) findings.push({ level: "ok", check: "status", message: "Returns HTTP 200" });
    else if (httpStatus >= 300 && httpStatus < 400)
      findings.push({ level: "error", check: "status", message: `Redirect loop or chain exceeding ${MAX_REDIRECTS} hops` });
    else findings.push({ level: "error", check: "status", message: `Returns HTTP ${httpStatus} — not indexable` });
  }
  if (chain.length > 1) {
    findings.push({
      level: chain.length > 3 ? "warn" : "ok",
      check: "redirects",
      message: `${chain.length - 1} redirect(s) before final URL${chain.length > 3 ? " — shorten the chain" : ""}`,
    });
  }
  if (responseTimeMs > 1500) findings.push({ level: "warn", check: "ttfb", message: `Slow response (${responseTimeMs}ms) reduces crawl capacity` });
  else findings.push({ level: "ok", check: "ttfb", message: `Response time ${responseTimeMs}ms` });
  if (etag || lastModified) findings.push({ level: "ok", check: "caching", message: "ETag/Last-Modified present — conditional recrawls supported" });
  else findings.push({ level: "warn", check: "caching", message: "No ETag or Last-Modified header — crawlers must re-download every visit" });

  // 3. HTML analysis
  let title: string | null = null;
  let metaRobots: string | null = null;
  let canonicalUrl: string | null = null;
  let canonicalOk: boolean | null = null;
  let h1Count: number | null = null;
  let hasStructuredData: boolean | null = null;
  let htmlValid: boolean | null = null;

  if (res && res.ok && contentType?.includes("text/html")) {
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < MAX_BODY_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    }
    const ex = extract(html);
    title = ex.title;
    metaRobots = ex.metaRobots;
    canonicalUrl = ex.canonical ? new URL(ex.canonical, currentUrl).toString() : null;
    h1Count = ex.h1Count;
    hasStructuredData = ex.hasStructuredData;
    htmlValid = ex.htmlValid;

    if (metaRobots && /noindex/i.test(metaRobots))
      findings.push({ level: "error", check: "meta-robots", message: `meta robots contains "noindex" — page will never be indexed` });
    else findings.push({ level: "ok", check: "meta-robots", message: metaRobots ? `meta robots: ${metaRobots}` : "No restrictive meta robots" });

    const xRobots = res.headers.get("x-robots-tag");
    if (xRobots && /noindex/i.test(xRobots))
      findings.push({ level: "error", check: "x-robots-tag", message: `X-Robots-Tag header contains "noindex"` });

    if (canonicalUrl) {
      const normalize = (u: string) => u.replace(/\/$/, "");
      canonicalOk = normalize(canonicalUrl) === normalize(currentUrl);
      findings.push(
        canonicalOk
          ? { level: "ok", check: "canonical", message: "Self-referencing canonical" }
          : { level: "warn", check: "canonical", message: `Canonical points elsewhere: ${canonicalUrl} — that URL gets indexed instead` }
      );
    } else {
      findings.push({ level: "warn", check: "canonical", message: "No canonical tag — engines pick one themselves" });
    }

    if (!title) findings.push({ level: "warn", check: "title", message: "Missing <title>" });
    if (h1Count === 0) findings.push({ level: "warn", check: "h1", message: "No <h1> on the page" });
    findings.push(
      hasStructuredData
        ? { level: "ok", check: "structured-data", message: "Structured data detected (JSON-LD/OG/microdata)" }
        : { level: "warn", check: "structured-data", message: "No structured data found — add Schema.org markup" }
    );
    if (!htmlValid) findings.push({ level: "warn", check: "html", message: "Document is missing doctype/<html> structure" });
  }

  // 4. Sitemap listing
  let sitemapListed: boolean | null = null;
  if (robotsSitemaps.length) {
    try {
      const smRes = await fetch(robotsSitemaps[0], { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
      if (smRes.ok) {
        const xml = (await smRes.text()).slice(0, 5 * 1024 * 1024);
        sitemapListed = xml.includes(`<loc>${targetUrl}</loc>`) || xml.includes(`<loc>${currentUrl}</loc>`);
        findings.push(
          sitemapListed
            ? { level: "ok", check: "sitemap", message: "URL is listed in the site's sitemap" }
            : { level: "warn", check: "sitemap", message: "URL not found in the first sitemap — add it for faster discovery" }
        );
      }
    } catch {
      findings.push({ level: "warn", check: "sitemap", message: "Sitemap referenced in robots.txt could not be fetched" });
    }
  } else {
    findings.push({ level: "warn", check: "sitemap", message: "No sitemap referenced in robots.txt" });
  }

  // 5. Score: start at 100, subtract per finding severity
  let score = 100;
  for (const f of findings) {
    if (f.level === "error") score -= 25;
    if (f.level === "warn") score -= 7;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    httpStatus,
    redirectChain: chain,
    responseTimeMs,
    etag,
    lastModified,
    contentType,
    robotsAllowed,
    metaRobots,
    canonicalUrl,
    canonicalOk,
    title,
    h1Count,
    hasStructuredData,
    htmlValid,
    sitemapListed,
    score,
    findings,
  };
}
