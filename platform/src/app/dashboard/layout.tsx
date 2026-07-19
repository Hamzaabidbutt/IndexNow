import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/ui";
import { LogoutButton } from "./nav-client";

const NAV = [
  ["/dashboard", "Overview"],
  ["/dashboard/projects", "Projects & URLs"],
  ["/dashboard/queue", "Queue & Failures"],
  ["/dashboard/keys", "API Keys"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white p-4 sm:flex">
        <div className="mb-8 px-2"><Logo href="/dashboard" /></div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              {label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link href="/admin" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Admin
            </Link>
          )}
        </nav>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs">
          <p className="font-bold text-blue-900">{user.plan} plan</p>
          <p className="mt-1 text-blue-800 tabular-nums">{user.credits.toLocaleString()} credits left</p>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <p className="text-sm font-semibold text-slate-700">{user.name}</p>
          <LogoutButton />
        </header>
        <main className="mx-auto max-w-6xl p-5">{children}</main>
      </div>
    </div>
  );
}
