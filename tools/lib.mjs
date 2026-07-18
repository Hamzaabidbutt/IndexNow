/**
 * Shared helpers for the IndexJet submission scripts.
 * Node 18+ (global fetch), zero dependencies.
 */

export function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

export function isValidUrl(value) {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function splitList(raw) {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Fetch a sitemap (or sitemap index) and return [{loc, lastmod}] entries. */
export async function fetchSitemapEntries(sitemapUrl, depth = 0) {
  if (depth > 3) return [];
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "IndexJet-Submitter/1.0 (+https://github.com/Hamzaabidbutt/IndexNow)" },
  });
  if (!res.ok) {
    console.error(`  ! Could not fetch sitemap ${sitemapUrl} (HTTP ${res.status})`);
    return [];
  }
  const xml = await res.text();

  // Sitemap index → recurse into child sitemaps
  if (/<sitemapindex[\s>]/i.test(xml)) {
    const children = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi)].map(
      (m) => m[1]
    );
    const all = [];
    for (const child of children) {
      all.push(...(await fetchSitemapEntries(child, depth + 1)));
    }
    return all;
  }

  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].flatMap((m) => {
    const block = m[1];
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
    if (!loc) return [];
    const lastmod = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i);
    return [{ loc: loc[1], lastmod: lastmod ? lastmod[1] : null }];
  });
}

/**
 * Collect URLs from --urls, --file and/or --sitemap args.
 * With --recent-hours N, sitemap URLs are kept only when lastmod falls
 * inside the window (URLs without lastmod are skipped in that mode).
 */
export async function collectUrls(args, readFile) {
  let urls = [];

  if (typeof args.urls === "string") urls.push(...splitList(args.urls));

  if (typeof args.file === "string") {
    const raw = await readFile(args.file, "utf8");
    urls.push(
      ...raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    );
  }

  if (typeof args.sitemap === "string") {
    for (const sm of splitList(args.sitemap)) {
      const entries = await fetchSitemapEntries(sm);
      console.log(`Sitemap ${sm}: ${entries.length} URLs`);
      let picked = entries;
      if (args["recent-hours"]) {
        const windowMs = Number(args["recent-hours"]) * 3600 * 1000;
        const cutoff = Date.now() - windowMs;
        picked = entries.filter((e) => e.lastmod && new Date(e.lastmod).getTime() >= cutoff);
        console.log(`  → ${picked.length} changed in the last ${args["recent-hours"]}h (by <lastmod>)`);
      }
      urls.push(...picked.map((e) => e.loc));
    }
  }

  // Validate + dedupe, preserving order
  const seen = new Set();
  const clean = [];
  for (const u of urls) {
    if (!isValidUrl(u)) {
      console.error(`  ! Skipping invalid URL: ${u}`);
      continue;
    }
    const norm = u.trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      clean.push(norm);
    }
  }
  return clean;
}

/** Group URLs by host — IndexNow requires one request per host. */
export function groupByHost(urls) {
  const groups = new Map();
  for (const u of urls) {
    const host = new URL(u).host;
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(u);
  }
  return groups;
}

/** Append a line to the GitHub Actions job summary when available. */
export async function summary(line, appendFile) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, line + "\n");
  }
}
