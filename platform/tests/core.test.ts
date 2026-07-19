import { describe, expect, it } from "vitest";
import { normalizeUrl, hostSchema } from "../src/lib/validation";
import { parseRobots, robotsAllows } from "../src/lib/services/crawlcheck";
import { buildSitemap, buildRss } from "../src/lib/services/discovery";
import { groupByHost } from "../src/lib/services/indexnow";

describe("normalizeUrl", () => {
  it("accepts valid http(s) URLs and strips fragments", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
    expect(normalizeUrl("  http://example.com/a?b=1  ")).toBe("http://example.com/a?b=1");
  });
  it("rejects non-http protocols and garbage", () => {
    expect(normalizeUrl("ftp://example.com/x")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("https://nodots")).toBeNull();
  });
  it("blocks SSRF targets", () => {
    expect(normalizeUrl("http://localhost/admin")).toBeNull();
    expect(normalizeUrl("http://127.0.0.1:8080/")).toBeNull();
    expect(normalizeUrl("http://192.168.1.1/")).toBeNull();
    expect(normalizeUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(normalizeUrl("http://10.0.0.5/x")).toBeNull();
    expect(normalizeUrl("http://172.20.3.4/x")).toBeNull();
  });
});

describe("hostSchema", () => {
  it("accepts hostnames, rejects URLs and invalid labels", () => {
    expect(hostSchema.safeParse("example.com").success).toBe(true);
    expect(hostSchema.safeParse("blog.example.co.uk").success).toBe(true);
    expect(hostSchema.safeParse("https://example.com").success).toBe(false);
    expect(hostSchema.safeParse("-bad.com").success).toBe(false);
    expect(hostSchema.safeParse("nodots").success).toBe(false);
  });
});

describe("robots.txt", () => {
  const txt = `
User-agent: *
Disallow: /private/
Allow: /private/public-page
Sitemap: https://example.com/sitemap.xml

User-agent: OtherBot
Disallow: /
`;
  it("parses groups and sitemaps", () => {
    const rules = parseRobots(txt);
    expect(rules.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
    expect(rules.disallow).toContain("/private/");
  });
  it("applies longest-match with Allow winning ties", () => {
    const rules = parseRobots(txt);
    expect(robotsAllows(rules, "/public")).toBe(true);
    expect(robotsAllows(rules, "/private/secret")).toBe(false);
    expect(robotsAllows(rules, "/private/public-page")).toBe(true);
  });
  it("supports wildcards", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /*.pdf");
    expect(robotsAllows(rules, "/doc.pdf")).toBe(false);
    expect(robotsAllows(rules, "/doc.html")).toBe(true);
  });
});

describe("discovery artifacts", () => {
  const entries = [{ url: "https://example.com/a?x=1&y=2", updatedAt: new Date("2026-07-01T00:00:00Z") }];
  it("builds escaped, well-formed sitemap XML", () => {
    const xml = buildSitemap(entries);
    expect(xml).toContain("<loc>https://example.com/a?x=1&amp;y=2</loc>");
    expect(xml).toContain("<lastmod>2026-07-01T00:00:00.000Z</lastmod>");
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });
  it("builds RSS with guid and pubDate", () => {
    const rss = buildRss("Test", "https://example.com/", entries);
    expect(rss).toContain("<rss version=\"2.0\">");
    expect(rss).toContain("guid isPermaLink=\"true\"");
  });
});

describe("groupByHost", () => {
  it("groups URLs per host for IndexNow batching", () => {
    const groups = groupByHost(["https://a.com/1", "https://a.com/2", "https://b.com/1"]);
    expect(groups.get("a.com")).toHaveLength(2);
    expect(groups.get("b.com")).toHaveLength(1);
  });
});
