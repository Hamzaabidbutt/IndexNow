/**
 * Discovery artifact generation — standards-compliant assets the site owner
 * hosts to accelerate discovery: XML sitemaps (dynamically regenerated from
 * the project's URL set), RSS feeds, and an internal link-graph hub page.
 *
 * These are generated FOR the owner to deploy on their own domain. We do not
 * host third-party URLs on crawler-bait pages — that's the line between
 * legitimate discovery and a link scheme.
 */

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

export type UrlEntry = { url: string; updatedAt: Date };

export function buildSitemap(entries: UrlEntry[]): string {
  const items = entries
    .slice(0, 50_000)
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n    <lastmod>${e.updatedAt.toISOString()}</lastmod>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export function buildRss(projectName: string, siteUrl: string, entries: UrlEntry[]): string {
  const items = entries
    .slice(0, 500)
    .map(
      (e) => `    <item>
      <title>${escapeXml(new URL(e.url).pathname)}</title>
      <link>${escapeXml(e.url)}</link>
      <guid isPermaLink="true">${escapeXml(e.url)}</guid>
      <pubDate>${e.updatedAt.toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(projectName)} — content feed</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Latest and updated pages on ${escapeXml(projectName)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/**
 * Internal link hub — an HTML snippet the owner embeds on a crawled page of
 * THEIR OWN site (e.g. an "All pages" or HTML-sitemap page) so every target
 * URL is reachable via internal links.
 */
export function buildLinkHub(entries: UrlEntry[]): string {
  const links = entries
    .slice(0, 1000)
    .map((e) => `  <li><a href="${escapeXml(e.url)}">${escapeXml(new URL(e.url).pathname)}</a></li>`)
    .join("\n");
  return `<!-- IndexJet internal link hub — embed on an indexable page of your own site -->\n<ul>\n${links}\n</ul>\n`;
}

/**
 * Parse a remote sitemap (or sitemap index) into URL entries.
 * Used by the sitemap-monitoring worker.
 */
export async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<{ loc: string; lastmod: string | null }[]> {
  if (depth > 3) return [];
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "IndexJetBot/1.0 (+sitemap monitor)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const children = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi)].map((m) => m[1]);
    const all: { loc: string; lastmod: string | null }[] = [];
    for (const child of children.slice(0, 50)) {
      all.push(...(await fetchSitemapUrls(child, depth + 1)));
    }
    return all;
  }

  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].flatMap((m) => {
    const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i);
    if (!loc) return [];
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i);
    return [{ loc: loc[1], lastmod: lastmod?.[1] ?? null }];
  });
}
