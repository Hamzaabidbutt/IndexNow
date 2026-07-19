"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function KeyManager({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createKey(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const name = new FormData(e.currentTarget).get("name");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setNewKey(data.key);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } else alert(data.error);
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Integrations using it will stop working within a minute.")) return;
    await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card overflow-x-auto">
        <h2 className="mb-4 text-base font-bold">Your keys</h2>
        {newKey && (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
            <p className="text-sm font-bold text-emerald-800">Copy this key now — it will not be shown again:</p>
            <code className="mt-1 block break-all font-mono text-xs text-emerald-900">{newKey}</code>
          </div>
        )}
        {keys.length === 0 ? (
          <p className="text-sm text-slate-500">No keys yet.</p>
        ) : (
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Key</th>
                <th className="pb-2 pr-3">Last used</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-medium">{k.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{k.prefix}…</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {k.revokedAt ? "Revoked" : k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                  </td>
                  <td className="py-2 text-right">
                    {!k.revokedAt && (
                      <button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => revoke(k.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <form onSubmit={createKey} className="card h-fit">
        <h2 className="mb-4 text-base font-bold">Create key</h2>
        <label className="label" htmlFor="key-name">Key name</label>
        <input className="input mb-4" id="key-name" name="name" required maxLength={60} placeholder="Production" />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create API Key"}</button>
      </form>
    </div>
  );
}
