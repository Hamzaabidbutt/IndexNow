"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitUrlsForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const urls = String(form.get("urls") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const res = await fetch(`/api/projects/${projectId}/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, priority: form.get("priority") }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `${data.accepted} accepted (${data.duplicates} duplicates, ${data.invalid} invalid) — queued for diagnostics & engine submission.` });
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error ?? "Submission failed" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h2 className="mb-4 text-base font-bold">Submit URLs</h2>
      {msg && (
        <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <label className="label" htmlFor="urls">URLs — one per line, any domain (max 10,000)</label>
      <textarea className="input mb-3 min-h-[120px] font-mono text-xs" id="urls" name="urls" required spellCheck={false}
        placeholder={"https://example.com/new-page\nhttps://another-site.com/article"} />
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="priority">Priority</label>
          <select className="input" id="priority" name="priority" defaultValue="NORMAL">
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "Queueing…" : "Queue for Indexing"}</button>
      </div>
    </form>
  );
}

type VerifyOptions = {
  file: { path: string; content: string };
  dns: { record: string; name: string; value: string };
  indexnow: { path: string; content: string; note: string };
};

export function VerifyPanel({ projectId, verified, method }: { projectId: string; verified: boolean; method: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<VerifyOptions | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (verified) return;
    fetch(`/api/projects/${projectId}/verify`)
      .then((r) => r.json())
      .then((d) => setOptions(d.options))
      .catch(() => {});
  }, [projectId, verified]);

  async function runCheck() {
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/verify`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setResult(data.detail);
    if (data.verified) router.refresh();
  }

  if (verified) {
    return (
      <aside className="card h-fit">
        <h2 className="mb-2 text-base font-bold">Domain verified</h2>
        <p className="text-sm text-slate-600">
          Verified via <b>{method}</b>. Engine submissions (IndexNow{`, `}Google when configured) are active for this host.
        </p>
      </aside>
    );
  }

  return (
    <aside className="card h-fit space-y-4">
      <div>
        <h2 className="text-base font-bold">Verify ownership</h2>
        <p className="mt-1 text-sm text-slate-600">
          Unverified domains still get full crawl diagnostics. Verifying unlocks engine submission. Pick any method:
        </p>
      </div>
      {options && (
        <>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Option 1 — IndexNow key file (recommended)</p>
            <p className="mt-1 break-all rounded-lg bg-slate-100 p-2 font-mono text-xs">{options.indexnow.path}</p>
            <p className="mt-1 text-xs text-slate-500">File content: <code className="font-mono">{options.indexnow.content}</code>. {options.indexnow.note}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Option 2 — Hosted file</p>
            <p className="mt-1 break-all rounded-lg bg-slate-100 p-2 font-mono text-xs">{options.file.path}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Option 3 — DNS TXT record</p>
            <p className="mt-1 break-all rounded-lg bg-slate-100 p-2 font-mono text-xs">{options.dns.value}</p>
          </div>
        </>
      )}
      {result && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{result}</p>}
      <button className="btn-primary w-full" onClick={runCheck} disabled={busy}>
        {busy ? "Checking…" : "Run Verification Check"}
      </button>
    </aside>
  );
}
