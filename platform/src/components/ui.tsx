import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-md shadow-blue-600/30">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
          <path d="M36 10 18 36h11l-3 18 20-27H34l2-17z" fill="#fff" />
        </svg>
      </span>
      IndexJet
    </Link>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    QUEUED: { cls: "pill-amber", label: "Queued" },
    PROCESSING: { cls: "pill-blue", label: "Processing" },
    SUBMITTED: { cls: "pill-green", label: "Submitted" },
    DISCOVERED: { cls: "pill-blue", label: "Analyzed" },
    FAILED: { cls: "pill-red", label: "Failed" },
    CANCELLED: { cls: "pill-gray", label: "Cancelled" },
  };
  const { cls, label } = map[status] ?? { cls: "pill-gray", label: status };
  return <span className={cls}>{label}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="pill-gray">—</span>;
  const cls = score >= 80 ? "pill-green" : score >= 50 ? "pill-amber" : "pill-red";
  return <span className={cls}>{score}/100</span>;
}
