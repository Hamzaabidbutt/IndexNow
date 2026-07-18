#!/usr/bin/env node
/**
 * Submit URLs to every IndexNow-participating search engine
 * (Bing, Yandex, Seznam.cz, Naver, …) through api.indexnow.org.
 *
 * Usage:
 *   node tools/indexnow.mjs --urls "https://a.com/x,https://a.com/y"
 *   node tools/indexnow.mjs --file submissions/urls.txt
 *   node tools/indexnow.mjs --sitemap https://site.com/sitemap.xml [--recent-hours 24]
 *
 * Key handling:
 *   The key below is committed as <key>.txt in this repo, so it is served by
 *   GitHub Pages and validates URLs under KEY_LOCATIONS' prefixes. To submit
 *   URLs for ANY OTHER domain, upload the same <key>.txt file to that
 *   domain's root (https://thatdomain.com/<key>.txt) — one key works
 *   everywhere it is hosted. Override with the INDEXNOW_KEY env var.
 */
import { readFile, appendFile } from "node:fs/promises";
import { parseArgs, collectUrls, groupByHost, summary } from "./lib.mjs";

const KEY = process.env.INDEXNOW_KEY || "dbcb3885cc778f6b193c6e0e81ab7d31";

// Hosts whose key file lives somewhere other than the domain root.
const KEY_LOCATIONS = {
  "hamzaabidbutt.github.io": `https://hamzaabidbutt.github.io/IndexNow/${KEY}.txt`,
};

const ENDPOINT = "https://api.indexnow.org/indexnow";

const STATUS_MEANING = {
  200: "OK — submission accepted",
  202: "Accepted — key validation pending",
  400: "Bad request — invalid format",
  403: "Forbidden — key file not found or key invalid for this host",
  422: "Unprocessable — URLs don't belong to the host or key mismatch",
  429: "Too many requests — slow down",
};

async function main() {
  const args = parseArgs(process.argv);
  const urls = await collectUrls(args, readFile);

  if (!urls.length) {
    console.log("No URLs to submit — nothing to do.");
    return;
  }
  console.log(`Submitting ${urls.length} URL(s) via IndexNow…\n`);

  let failures = 0;
  for (const [host, hostUrls] of groupByHost(urls)) {
    const payload = {
      host,
      key: KEY,
      keyLocation: KEY_LOCATIONS[host] || `https://${host}/${KEY}.txt`,
      urlList: hostUrls,
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const meaning = STATUS_MEANING[res.status] || (await res.text().catch(() => "")) || "Unknown response";
    const ok = res.status === 200 || res.status === 202;
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${host} — ${hostUrls.length} URL(s) → HTTP ${res.status}: ${meaning}`);
    if (!ok) {
      failures++;
      if (res.status === 403 || res.status === 422) {
        console.log(`   Fix: host ${payload.keyLocation} with content "${KEY}" so IndexNow can verify ownership.`);
      }
    }
    await summary(`| IndexNow | ${host} | ${hostUrls.length} | HTTP ${res.status} ${ok ? "✅" : "❌"} |`, appendFile);
  }

  if (failures) process.exitCode = 1;
}

main().catch((err) => {
  console.error("IndexNow submission failed:", err);
  process.exitCode = 1;
});
