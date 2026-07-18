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

The demo dashboard and submission widget run on simulated client-side data; wire them to a real backend by replacing the handlers in `assets/js/*.js` with calls to your REST API.
