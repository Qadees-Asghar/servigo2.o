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
  type SetupState = {
    available: boolean;
    claimed: boolean;
    configured: boolean;
    hasEmails: boolean;
    hasToken: boolean;
    dbOk: boolean;
    dbError: string | null;
  };

  const [state, setState] = useState<SetupState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SetupState>("/api/admin/setup").then((r) => {
      if (r.ok && r.data) setState(r.data);
      else
        setState({
          available: false,
          claimed: false,
          configured: false,
          hasEmails: false,
          hasToken: false,
          dbOk: false,
          dbError: r.message ?? "Could not reach the server.",
        });
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
          ) : !state.available ? (
            <div className="space-y-4">
              <Alert>Setup cannot run yet. See the checks below.</Alert>

              <ul className="space-y-2 text-sm">
                {[
                  {
                    ok: state.dbOk,
                    label: "Database reachable",
                    hint: "Check DATABASE_URL. Use the pooler string on port 6543 and make sure the password is correct.",
                  },
                  {
                    ok: state.hasEmails,
                    label: "ADMIN_EMAILS is set",
                    hint: "Comma separated allowlist of addresses permitted to hold the admin role.",
                  },
                  {
                    ok: state.hasToken,
                    label: "ADMIN_SETUP_TOKEN is set (16+ characters)",
                    hint: "A random secret you generate. Delete it once setup is done.",
                  },
                ].map((c) => (
                  <li
                    key={c.label}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <span
                        style={{
                          color: c.ok
                            ? "var(--color-success)"
                            : "var(--color-danger)",
                        }}
                      >
                        {c.ok ? "PASS" : "FAIL"}
                      </span>
                      {c.label}
                    </p>
                    {!c.ok ? (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{c.hint}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {state.dbError ? (
                <p className="rounded-lg bg-[var(--color-danger-dim)] px-3.5 py-2.5 font-mono text-xs text-[var(--color-danger)]">
                  {state.dbError}
                </p>
              ) : null}

              <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                All values live only in your Vercel environment, never in the
                repository. Environment changes need a redeploy before they take
                effect.
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
