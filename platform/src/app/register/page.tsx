"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    setBusy(false);
    if (res.ok) router.push("/dashboard");
    else setError((await res.json()).error ?? "Registration failed");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <form onSubmit={onSubmit} className="card w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <h1 className="mb-1 text-center text-xl font-bold">Create your account</h1>
        <p className="mb-6 text-center text-sm text-slate-600">50 free URL credits included</p>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
        <label className="label" htmlFor="name">Full name</label>
        <input className="input mb-4" id="name" name="name" autoComplete="name" required maxLength={100} />
        <label className="label" htmlFor="email">Email</label>
        <input className="input mb-4" id="email" name="email" type="email" autoComplete="email" required />
        <label className="label" htmlFor="password">Password</label>
        <input className="input mb-1" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required aria-describedby="pw-hint" />
        <p id="pw-hint" className="mb-6 text-xs text-slate-500">At least 10 characters.</p>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create Account"}</button>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered? <Link className="font-semibold text-blue-600" href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
