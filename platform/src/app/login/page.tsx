"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setBusy(false);
    if (res.ok) router.push(params.get("next") ?? "/dashboard");
    else setError((await res.json()).error ?? "Login failed");
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <h1 className="mb-6 text-center text-xl font-bold">Welcome back</h1>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      <label className="label" htmlFor="email">Email</label>
      <input className="input mb-4" id="email" name="email" type="email" autoComplete="email" required />
      <label className="label" htmlFor="password">Password</label>
      <input className="input mb-6" id="password" name="password" type="password" autoComplete="current-password" required />
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
      <p className="mt-5 text-center text-sm text-slate-600">
        New here? <Link className="font-semibold text-blue-600" href="/register">Create a free account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
