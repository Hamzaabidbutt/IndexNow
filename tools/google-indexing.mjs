#!/usr/bin/env node
/**
 * Submit URLs to the Google Indexing API.
 *
 * Requires the GOOGLE_SERVICE_ACCOUNT_JSON env var — the full JSON key of a
 * Google Cloud service account that:
 *   1. Has the "Web Search Indexing API" enabled in its GCP project, and
 *   2. Is added as an OWNER of the target property in Google Search Console.
 * Without the env var the script skips gracefully (exit 0), so the workflow
 * stays green for IndexNow-only users.
 *
 * NOTE: Google officially supports this API for JobPosting and
 * BroadcastEvent (livestream) pages only. Submissions for other page types
 * may be ignored by Google — IndexNow + sitemaps remain the reliable path
 * for general content.
 *
 * Usage mirrors indexnow.mjs:
 *   node tools/google-indexing.mjs --urls "https://a.com/x"
 *   node tools/google-indexing.mjs --file submissions/urls.txt
 *   node tools/google-indexing.mjs --sitemap https://site.com/sitemap.xml [--recent-hours 24]
 */
import { readFile, appendFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { parseArgs, collectUrls, summary } from "./lib.mjs";

const SCOPE = "https://www.googleapis.com/auth/indexing";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

/** Build a signed JWT and exchange it for an OAuth2 access token. */
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function main() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.log("GOOGLE_SERVICE_ACCOUNT_JSON secret not set — skipping Google Indexing API.");
    console.log("See README.md § Google Indexing API setup to enable it.");
    return;
  }

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON — paste the full service account key file.");
  }

  const args = parseArgs(process.argv);
  const urls = await collectUrls(args, readFile);
  if (!urls.length) {
    console.log("No URLs to submit — nothing to do.");
    return;
  }

  console.log(`Authenticating as ${sa.client_email}…`);
  const token = await getAccessToken(sa);
  console.log(`Submitting ${urls.length} URL(s) to the Google Indexing API…\n`);

  let ok = 0;
  let failed = 0;
  for (const url of urls) {
    const res = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    if (res.ok) {
      ok++;
      console.log(`✅ ${url}`);
    } else {
      failed++;
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `HTTP ${res.status}`;
      console.log(`❌ ${url} — ${msg}`);
      if (res.status === 403) {
        console.log(`   Fix: add ${sa.client_email} as an OWNER of this property in Google Search Console.`);
      }
      if (res.status === 429) {
        console.log("   Daily quota reached (default 200/day) — remaining URLs will fail; rerun tomorrow.");
        break;
      }
    }
    // Stay well under the API's per-minute limits
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nGoogle Indexing API: ${ok} succeeded, ${failed} failed.`);
  await summary(`| Google Indexing API | — | ${ok} ok / ${failed} failed | ${failed ? "⚠️" : "✅"} |`, appendFile);
  if (failed && !ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Google Indexing API submission failed:", err.message);
  process.exitCode = 1;
});
