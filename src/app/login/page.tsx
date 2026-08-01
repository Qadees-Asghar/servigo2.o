"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Logo, api } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const res = await api<{ redirect: string }>("/api/auth/login", {
      method: "POST",
      json: { email: fd.get("email"), password: fd.get("password") },
    });

    if (!res.ok) {
      setError(res.message ?? "Sign in failed.");
      setBusy(false);
      return;
    }

    router.push(params.get("next") || res.data!.redirect);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}

      <div>
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          placeholder="Your password"
          required
        />
      </div>

      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-6 py-12">
      <div className="aurora" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-6 text-2xl font-black">Welcome back</h1>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            Sign in to manage your bookings.
          </p>
        </div>

        <div className="card p-7">
          <Suspense fallback={<p className="text-sm text-[var(--color-muted)]">Loading</p>}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
            New to SERVIGO?{" "}
            <Link href="/signup" className="font-semibold text-[var(--color-accent)]">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
