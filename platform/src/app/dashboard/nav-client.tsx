"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-secondary !py-1.5 text-xs"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
      }}
    >
      Log out
    </button>
  );
}

/** Live event feed — SSE stream of worker events, refreshes data on activity. */
export function LiveFeed() {
  const router = useRouter();
  const [events, setEvents] = useState<{ type: string; at: number; [k: string]: unknown }[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ping" || data.type === "connected") return;
        setEvents((prev) => [data, ...prev].slice(0, 8));
        router.refresh();
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => es.close();
  }, [router]);

  if (!events.length) {
    return <p className="text-sm text-slate-500">Waiting for activity — events appear here in real time.</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {events.map((ev, i) => (
        <li key={`${ev.at}-${i}`} className="flex items-center gap-2">
          <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-xs text-slate-500">{new Date(ev.at).toLocaleTimeString()}</span>
          <span className="text-slate-700">
            {ev.type === "batch.processing" && `Processing batch of ${ev.count as number} URL(s)…`}
            {ev.type === "batch.done" && `Batch finished — ${ev.ok as number} submitted, ${ev.failed as number} failed`}
            {ev.type === "crawl.done" && `Crawl analysis complete (score ${ev.score as number}/100)`}
          </span>
        </li>
      ))}
    </ul>
  );
}
