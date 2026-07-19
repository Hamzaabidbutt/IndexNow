"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminRetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-primary !py-1.5 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/admin/retry?scope=all", { method: "POST" });
        const data = await res.json();
        setBusy(false);
        alert(res.ok ? `${data.requeued} URL(s) re-queued platform-wide` : data.error);
        router.refresh();
      }}
    >
      {busy ? "Working…" : "Retry All Failed (global)"}
    </button>
  );
}
