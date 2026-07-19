"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-secondary !py-1.5 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/admin/retry", { method: "POST" });
        const data = await res.json();
        setBusy(false);
        alert(res.ok ? `${data.requeued} URL(s) re-queued` : data.error);
        router.refresh();
      }}
    >
      {busy ? "Re-queueing…" : "Retry All Failed"}
    </button>
  );
}
