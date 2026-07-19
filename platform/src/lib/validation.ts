import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(200);
export const nameSchema = z.string().trim().min(1).max(100);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

/** Strict http(s) URL validation with normalization. */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.hostname.includes(".")) return null;
  // Block obvious SSRF targets — the crawler fetches these URLs server-side
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "[::1]" ||
    host === "::1"
  ) {
    return null;
  }
  u.hash = "";
  return u.toString();
}

export const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, "Enter a valid hostname like example.com");

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  host: hostSchema,
  sitemapUrl: z.string().url().max(2048).optional().nullable(),
});

export const submitUrlsSchema = z.object({
  urls: z.array(z.string().max(2048)).min(1).max(10_000),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
});

export const apiKeySchema = z.object({ name: z.string().trim().min(1).max(60) });
