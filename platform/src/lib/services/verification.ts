/**
 * Domain ownership verification.
 * Methods: hosted file, DNS TXT record, or IndexNow key file.
 */
import { resolveTxt } from "node:dns/promises";
import { getIndexNowKey } from "./indexnow";

const UA = "IndexJetBot/1.0 (+domain verification)";

export type VerifyOutcome = { verified: boolean; method: "FILE" | "DNS" | "INDEXNOW_KEY" | null; detail: string };

export async function verifyDomain(host: string, token: string): Promise<VerifyOutcome> {
  // 1. Hosted file: https://<host>/indexjet-verify-<token>.txt containing the token
  try {
    const res = await fetch(`https://${host}/indexjet-verify-${token}.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok && (await res.text()).trim() === token) {
      return { verified: true, method: "FILE", detail: "Verification file found" };
    }
  } catch {
    /* fall through */
  }

  // 2. DNS TXT: indexjet-verify=<token> on the host or its apex
  const apex = host.split(".").slice(-2).join(".");
  for (const name of new Set([host, apex])) {
    try {
      const records = (await resolveTxt(name)).flat();
      if (records.some((r) => r.trim() === `indexjet-verify=${token}`)) {
        return { verified: true, method: "DNS", detail: `TXT record found on ${name}` };
      }
    } catch {
      /* NXDOMAIN or no TXT — keep trying */
    }
  }

  // 3. IndexNow key file (also unlocks IndexNow submissions)
  try {
    const key = getIndexNowKey();
    const res = await fetch(`https://${host}/${key}.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok && (await res.text()).trim() === key) {
      return { verified: true, method: "INDEXNOW_KEY", detail: "IndexNow key file found" };
    }
  } catch {
    /* fall through */
  }

  return {
    verified: false,
    method: null,
    detail:
      "No verification found. Host the verification file, add the DNS TXT record, or host the IndexNow key file, then retry.",
  };
}
