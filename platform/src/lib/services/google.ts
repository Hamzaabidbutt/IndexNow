/**
 * Google Indexing API client (service-account JWT auth, zero deps).
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON and the service account added as an
 * OWNER of the property in Search Console. Google officially supports this
 * API for JobPosting/BroadcastEvent pages; other content types may be
 * ignored — surfaced honestly in results.
 */
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/indexing";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

type ServiceAccount = { client_email: string; private_key: string };

let cachedToken: { token: string; expiresAt: number } | null = null;

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key.");
  }
  return sa;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(sa.private_key, "base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token exchange failed: ${data.error_description ?? res.status}`);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + 55 * 60_000 };
  return data.access_token;
}

export type GoogleResult = { status: number; ok: boolean; message: string };

export async function submitToGoogle(url: string): Promise<GoogleResult> {
  const token = await getAccessToken();
  const res = await fetch(PUBLISH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) return { status: res.status, ok: true, message: "Published" };
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return {
    status: res.status,
    ok: false,
    message:
      body.error?.message ??
      (res.status === 403
        ? "Service account is not an owner of this property in Search Console"
        : `HTTP ${res.status}`),
  };
}
