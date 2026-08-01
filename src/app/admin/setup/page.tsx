"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Logo, api } from "@/components/ui";

/**
 * One-time administrator bootstrap.
 *
 * The desktop app shipped with admin@servigo.com / Admin@123 written into
 * Program.cs. This page replaces that: the operator supplies the setup token
 * from their environment variables and chooses their own password, which is
 * hashed before it touches the database. Once claimed, this page locks itself.
 */
export default function AdminSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<{
    available: boolean;
    claimed: boolean;
    configured: boolean;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ available: boolean; claimed: boolean; configured: boolean }>(
      "/api/admin/setup"
    ).then((r) => {
      if (r.ok && r.data) setState(r.data);
      else setState({ available: false, claimed: false, configured: false });
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const res = await api<{ redirect: string }>("/api/admin/setup", {
      method: "POST",
      json: Object.fromEntries(fd.entries()),
    });

    if (!res.ok) {
      setError(res.message ?? "Setup failed.");
      setErrors(res.errors ?? {});
      setBusy(false);
      return;
    }

    router.push(res.data!.redirect);
    router.refresh();
  }

  const Err = ({ f }: { f: string }) =>
    errors[f] ? <p className="err">{errors[f]}</p> : null;

  return (
    <div className="relative grid min-h-dvh place-items-center px-6 py-12">
      <div className="aurora" />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-6 text-2xl font-black">Administrator setup</h1>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            Runs once, then permanently locks itself.
          </p>
        </div>

        <div className="card p-7">
          {state === null ? (
            <p className="text-sm text-[var(--color-muted)]">Checking setup state</p>
          ) : state.claimed ? (
            <div className="space-y-4">
              <Alert kind="info">
                An administrator has already been set up. This page is closed.
              </Alert>
              <Link href="/login" className="btn btn-primary w-full">
                Go to sign in
              </Link>
            </div>
          ) : !state.configured ? (
            <div className="space-y-4">
              <Alert>
                Setup is not configured. Set ADMIN_EMAILS and ADMIN_SETUP_TOKEN in your
                environment variables, then redeploy.
              </Alert>
              <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                ADMIN_EMAILS is a comma separated allowlist of addresses permitted to
                hold the admin role. ADMIN_SETUP_TOKEN is a random secret you generate
                with <code>openssl rand -hex 32</code>. Both live only in your Vercel
                environment, never in the repository.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {error ? <Alert>{error}</Alert> : null}

              <div>
                <label className="label" htmlFor="setupToken">
                  Setup token
                </label>
                <input
                  id="setupToken"
                  name="setupToken"
                  type="password"
                  className="input"
                  placeholder="Value of ADMIN_SETUP_TOKEN"
                  required
                />
                <Err f="setupToken" />
              </div>

              <div>
                <label className="label" htmlFor="fullName">
                  Full name
                </label>
                <input id="fullName" name="fullName" className="input" required />
                <Err f="fullName" />
              </div>

              <div>
                <label className="label" htmlFor="email">
                  Email (must be on the allowlist)
                </label>
                <input id="email" name="email" type="email" className="input" required />
                <Err f="email" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="phone">
                    Phone
                  </label>
                  <input id="phone" name="phone" inputMode="numeric" maxLength={11} className="input" required />
                  <Err f="phone" />
                </div>
                <div>
                  <label className="label" htmlFor="cnic">
                    CNIC
                  </label>
                  <input id="cnic" name="cnic" inputMode="numeric" maxLength={13} className="input" required />
                  <Err f="cnic" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="password">
                    Password
                  </label>
                  <input id="password" name="password" type="password" className="input" autoComplete="new-password" required />
                  <Err f="password" />
                </div>
                <div>
                  <label className="label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
                  <Err f="confirmPassword" />
                </div>
              </div>

              <Alert kind="info">
                After this succeeds, delete ADMIN_SETUP_TOKEN from your environment
                variables. It cannot be reused, but removing it keeps the surface small.
              </Alert>

              <button className="btn btn-primary w-full" disabled={busy}>
                {busy ? "Creating administrator" : "Claim administrator account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
