# IndexJet Platform

Production URL-indexing and search-engine-discovery platform. Accepts **any URL from any domain**, runs full crawlability diagnostics, generates discovery artifacts, and submits through official engine protocols — backed by a real queue engine with parallel workers, priority lanes and exponential-backoff retries.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Redis · BullMQ · Docker · Server-Sent Events

## What it actually does (honest scope)

| Capability | Any domain | Verified domains only |
|---|---|---|
| Crawlability analysis (robots, canonical, meta robots, redirects, TTFB, ETag/Last-Modified, structured data, HTML validity, sitemap listing) with 0–100 score | ✅ | |
| XML sitemap / RSS feed / internal link-hub generation from your URL set | ✅ | |
| Queue processing, retries, priority, job history, realtime events | ✅ | |
| IndexNow submission (Bing, Yandex, Seznam, Naver) | attempted, accepted once the host serves the key file | ✅ |
| Google Indexing API submission | | ✅ (service account + Search Console owner) |

We do **not** place customer URLs on link networks or crawler-bait pages. That's how "no-verification" indexing services operate, it violates search engine spam policies, and it puts client domains at risk. Everything here is standards-compliant.

## Quick start (Docker)

```bash
cd platform
cp .env.example .env
# edit .env: set AUTH_SECRET (openssl rand -hex 32), INDEXNOW_KEY (openssl rand -hex 16),
#            ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up --build
# web:    http://localhost:3000
# worker: runs queues in its own container
docker compose exec worker npx tsx prisma/seed.ts   # create the admin account
```

## Local development (no Docker)

```bash
cd platform
npm install
cp .env.example .env            # point DATABASE_URL/REDIS_URL at local services
npx prisma migrate dev          # creates schema
npm run seed                    # admin account
npm run dev                     # web on :3000
npm run worker                  # in a second terminal
npm test                        # vitest unit tests
npm run typecheck
```

## Architecture

```
┌─────────────┐   HTTP    ┌───────────────────────┐
│  Next.js UI  │◄────────►│  API routes (/api/*)   │──► PostgreSQL (Prisma)
│  + SSE feed  │           │  auth · zod · ratelimit│
└─────────────┘           └──────────┬────────────┘
                                      │ enqueue
                                      ▼
                              Redis + BullMQ
                     ┌────────────┬───────────────┐
                     ▼            ▼               ▼
               submit worker  crawl worker  monitor worker
               (IndexNow +    (crawlability (sitemap diff,
                Google API)    diagnostics)  6-hourly)
                     │            │
                     └────► Redis pub/sub ──► SSE ──► dashboard
```

- **Clean layering:** `lib/services/*` are pure domain services (no HTTP concerns); API routes handle auth/validation/rate limits; workers orchestrate.
- **Retries:** BullMQ exponential backoff (30s → 16m, 5 attempts submit / 3 crawl); failed URLs re-queueable from the dashboard and platform-wide from admin.
- **Priority queue:** HIGH/NORMAL/LOW map to BullMQ priorities 1/5/10.
- **Security:** bcrypt(12) passwords, HS256 JWT httpOnly cookies, API keys stored as SHA-256 hashes and shown once, zod validation everywhere, SSRF guard on submitted URLs, per-user Redis rate limiting with standard headers, security response headers, audit log.
- **Billing-ready:** credit ledger with atomic decrement, plan enum, nullable Stripe customer/subscription fields — drop in Stripe webhooks without a migration.

## REST API

```bash
curl -X POST https://your-host/api/v1/submit \
  -H "X-Api-Key: ijp_live_…" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com/new"], "priority": "HIGH"}'
# → 202 { "accepted": 1, "duplicates": 0, "invalid": 0, "credits_remaining": 49 }
```

Endpoints: `POST /api/v1/submit` (key auth) plus the session-authenticated
`/api/projects*`, `/api/keys`, `/api/events` (SSE), `/api/admin*` routes used by the dashboard.

## Deployment guide

**Single VPS (simplest):** install Docker, clone, set `.env`, `docker compose up -d`. Put Caddy/nginx with TLS in front of :3000.

**Split (scales further):**
- Web → Vercel (set all env vars; `output: standalone` already configured)
- Postgres → Neon/Supabase/RDS
- Redis → Upstash (use `rediss://` URL) or Elasticache
- Worker → any Node host / Fly.io / Railway: `npm ci && npx prisma generate && npm run worker`

Run `npx prisma migrate deploy` on every release. Horizontal scale: add worker replicas — BullMQ distributes jobs safely.

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `INDEXNOW_KEY`, `APP_URL`. Optional: `GOOGLE_SERVICE_ACCOUNT_JSON` (enables Google submissions), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed).
