# IndexJet — Fast URL Indexing Platform

A premium, enterprise-grade SaaS website for rapid URL indexing across Google, Bing and every IndexNow-powered search engine. Built as a fully static, dependency-free site optimized for Core Web Vitals, accessibility (WCAG 2.2 AA) and SEO.

## ✨ Highlights

- **Zero dependencies** — semantic HTML5, modern CSS and vanilla JavaScript. No build step, no framework payload, CDN-ready as-is.
- **Premium SaaS design** — deep navy / electric blue / cyan palette, subtle glassmorphism, soft shadows, 14–18px radii, gradients, micro-interactions and smooth scroll-reveal animations.
- **Full page set** — Home, Features, Pricing, Docs, API Reference, Blog (+6 SEO articles), Contact, Login, Register, Dashboard, Privacy, Terms, Refund Policy, Status, Changelog, 404.
- **Enterprise dashboard** with dark mode (persisted + system-preference aware), sidebar navigation, live-updating submission feed, charts, API key management, billing, team, notifications and settings panels.
- **Interactive submission widget** — single URL, bulk paste, drag-and-drop .txt/.csv upload and API tab, with instant client-side validation, dedupe and toast notifications.

## 📁 Structure

```
├── index.html              # Homepage (hero, widget, live dashboard, features,
│                           #   stats, workflow, pricing, testimonials, FAQ, blog, CTA)
├── features.html           # Full feature breakdown
├── pricing.html            # 5 plans, billing toggle, comparison matrix, FAQ
├── docs.html               # Documentation (quickstart → webhooks → errors)
├── api.html                # REST API reference with copyable examples
├── blog.html               # Blog index
├── blog/*.html             # 6 full articles (Google indexing, IndexNow, crawl budget…)
├── contact.html            # Contact form + support channels
├── login.html / register.html
├── dashboard.html          # SaaS dashboard (dark mode, 10 panels)
├── privacy.html / terms.html / refund.html
├── status.html             # System status + incident history
├── changelog.html          # Release timeline
├── 404.html
├── assets/
│   ├── css/styles.css      # Design system + marketing styles
│   ├── css/dashboard.css   # Dashboard (light/dark themes)
│   ├── js/main.js          # Nav, tabs, FAQ, counters, reveal, toasts, widget
│   ├── js/dashboard.js     # Theme toggle, panel routing, live demo data
│   └── img/favicon.svg
├── robots.txt
├── sitemap.xml
└── site.webmanifest
```

## 🚀 Run locally

Any static server works:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## ⚡ Performance & SEO

- System font stack, inline SVG icons, no external requests → sub-second FCP
- `IntersectionObserver`-driven animations with full `prefers-reduced-motion` support
- Semantic landmarks, skip links, keyboard-navigable tabs/accordions/menus, visible focus states
- Schema.org structured data (Organization, SoftwareApplication, FAQPage, BlogPosting)
- Canonical URLs, Open Graph + Twitter Cards on every page, XML sitemap and robots.txt

## 🎨 Design tokens

| Token | Value |
|---|---|
| Deep Navy | `#0A1128` |
| Electric Blue | `#2563EB` |
| Cyan | `#06B6D4` |
| Emerald (success) | `#10B981` |
| Radius | 14–18px |
| Font | Inter / system-ui stack |

## 🔴 Real URL submission (live engine)

The repo includes a **working submission engine** built on GitHub Actions — no server needed. It submits through:

- **IndexNow** → Bing, Yandex, Seznam.cz, Naver (works out of the box)
- **Google Indexing API** → works after a one-time secret setup (below)

### The 5 ways to submit

| Method | How |
|---|---|
| **Manual run** | GitHub → Actions → *Submit URLs to Search Engines* → Run workflow → paste URLs or a sitemap URL |
| **Push-to-submit** | Add URLs to `submissions/urls.txt`, push to `main` — they're submitted automatically |
| **Sitemap monitoring** | List sitemaps in `submissions/sitemaps.txt` — every 6 h, URLs with a fresh `<lastmod>` are submitted |
| **Website widget** | On the live site, click *Enable live submissions* in the submission widget and paste a GitHub fine-grained PAT (Actions read/write on this repo). The widget then triggers real workflow runs |
| **CLI** | `node tools/indexnow.mjs --urls "https://site.com/page"` or `--sitemap https://site.com/sitemap.xml` |

Results appear in each workflow run's **Summary** (per-engine, per-host status).

### Making submissions work for your domain (IndexNow)

IndexNow verifies ownership via a key file. This repo's key is **`dbcb3885cc778f6b193c6e0e81ab7d31`**, already hosted for the GitHub Pages site itself. To submit URLs for **any other domain you own**, upload the file

```
https://yourdomain.com/dbcb3885cc778f6b193c6e0e81ab7d31.txt
```

containing exactly `dbcb3885cc778f6b193c6e0e81ab7d31` (same file as in this repo root). That's it — submissions for that domain will then return HTTP 200/202. Without the key file, engines reject them (403/422) — this is how IndexNow prevents people from submitting sites they don't own.

### Google Indexing API setup (one-time)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Web Search Indexing API**.
2. Create a **service account**, then create a JSON key for it.
3. In [Google Search Console](https://search.google.com/search-console), add the service account's email as an **Owner** of your property.
4. In this repo: Settings → Secrets and variables → Actions → New repository secret named `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the entire JSON key file.

⚠️ Google officially supports this API for **JobPosting and livestream pages only**; for general pages, rely on IndexNow, sitemaps and the quality signals covered in the blog articles. Default quota is 200 URLs/day.

### Honest expectations

Submission ≠ indexing. These APIs get your URLs **discovered and crawled fast** (Bing/Yandex typically within the hour). Whether a page **enters the index** is always the engine's decision, based on content quality, canonicals and site authority. No tool can guarantee 100% indexing — anyone claiming otherwise is selling something.

The dashboard's charts and tables still show simulated demo data; the submission paths above are real.
