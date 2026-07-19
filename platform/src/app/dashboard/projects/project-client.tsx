"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        host: form.get("host"),
        sitemapUrl: form.get("sitemapUrl") || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else setError((await res.json()).error ?? "Could not create project");
  }

  return (
    <form onSubmit={onSubmit} className="card h-fit">
      <h2 className="mb-4 text-base font-bold">New project</h2>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <label className="label" htmlFor="p-name">Project name</label>
      <input className="input mb-3" id="p-name" name="name" required maxLength={100} placeholder="My blog" />
      <label className="label" htmlFor="p-host">Host</label>
      <input className="input mb-3" id="p-host" name="host" required placeholder="example.com" pattern="[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" />
      <label className="label" htmlFor="p-sitemap">Sitemap URL <span className="font-normal text-slate-400">(optional, enables monitoring)</span></label>
      <input className="input mb-4" id="p-sitemap" name="sitemapUrl" type="url" placeholder="https://example.com/sitemap.xml" />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create Project"}</button>
    </form>
  );
}
