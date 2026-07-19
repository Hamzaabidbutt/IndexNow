import Link from "next/link";
import { Logo } from "@/components/ui";

const FEATURES = [
  ["Any URL, any domain", "Submit unlimited URLs and whole domains. Every URL gets full crawlability diagnostics — no ownership needed for analysis."],
  ["Real engine submission", "IndexNow pushes verified domains to Bing, Yandex, Seznam and Naver in seconds; Google Indexing API supported for eligible content."],
  ["Queue-driven engine", "Priority queues, parallel workers, exponential-backoff retries and full job history on Redis + BullMQ."],
  ["Crawlability score", "robots.txt, canonical, meta robots, redirects, structured data, caching headers — scored 0–100 with concrete fixes."],
  ["Discovery artifacts", "Auto-generated XML sitemaps, RSS feeds and internal link hubs, always in sync with your URL set."],
  ["Realtime dashboard", "Live status streams over Server-Sent Events: watch URLs move from queued to submitted as it happens."],
] as const;

export default function Landing() {
  return (
    <main>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary">Log in</Link>
            <Link href="/register" className="btn-primary">Start Free</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <p className="mx-auto mb-5 w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
          Standards-compliant indexing infrastructure
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold tracking-tight" style={{ textWrap: "balance" }}>
          Every legitimate path from <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">published to discovered</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Submit any URL on any domain. IndexJet runs full crawlability diagnostics, generates discovery artifacts, and
          submits through official engine protocols — with a real queue engine underneath. No link schemes, ever.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-8 py-3 text-base">Create Free Account</Link>
          <Link href="/login" className="btn-secondary px-8 py-3 text-base">Log in</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="card">
              <h2 className="mb-2 text-base font-bold">{title}</h2>
              <p className="text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-slate-500">
          Honest by design: submission accelerates <em>discovery and crawling</em>. Whether a page enters the index is
          always the search engine&apos;s decision.
        </p>
      </section>
    </main>
  );
}
