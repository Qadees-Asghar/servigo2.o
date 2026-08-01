"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Logo, api } from "@/components/ui";

type Category = { category_id: number; category_name: string };

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<"customer" | "provider">(
    params.get("role") === "provider" ? "provider" : "customer"
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Category[]>("/api/categories").then((r) => {
      if (r.ok && r.data) setCategories(r.data);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const res = await api<{ redirect: string }>("/api/auth/signup", {
      method: "POST",
      json: {
        fullName: fd.get("fullName"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        cnic: fd.get("cnic"),
        password: fd.get("password"),
        confirmPassword: fd.get("confirmPassword"),
        role,
        categoryId: role === "provider" ? Number(fd.get("categoryId")) : undefined,
        description: role === "provider" ? fd.get("description") : undefined,
      },
    });

    if (!res.ok) {
      setError(res.message ?? "Sign up failed.");
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}

      <div>
        <span className="label">I am signing up as</span>
        <div className="grid grid-cols-2 gap-2">
          {(["customer", "provider"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`btn ${role === r ? "btn-primary" : "btn-outline"}`}
            >
              {r === "customer" ? "Customer" : "Service provider"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="fullName">
          Full name
        </label>
        <input id="fullName" name="fullName" className="input" placeholder="Ali Raza" required />
        <Err f="fullName" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="input" placeholder="you@example.com" required />
          <Err f="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone (11 digits)
          </label>
          <input id="phone" name="phone" inputMode="numeric" maxLength={11} className="input" placeholder="03001234567" required />
          <Err f="phone" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="cnic">
          CNIC (13 digits, no dashes)
        </label>
        <input id="cnic" name="cnic" inputMode="numeric" maxLength={13} className="input" placeholder="3520112345671" required />
        <Err f="cnic" />
      </div>

      {role === "provider" ? (
        <>
          <div>
            <label className="label" htmlFor="categoryId">
              Trade category
            </label>
            <select id="categoryId" name="categoryId" className="input" required>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.category_name}
                </option>
              ))}
            </select>
            <Err f="categoryId" />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Short description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              className="input"
              placeholder="Ten years of residential wiring experience, available across Lahore."
            />
          </div>
        </>
      ) : null}

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

      <p className="text-xs text-[var(--color-muted)]">
        At least 8 characters, including one letter and one digit.
      </p>

      {role === "provider" ? (
        <Alert kind="info">
          Provider accounts stay in review until an administrator approves them. You
          can sign in straight away, but services and time slots unlock after approval.
        </Alert>
      ) : null}

      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Creating account" : "Create account"}
      </button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-6 py-12">
      <div className="aurora" />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-6 text-2xl font-black">Create your account</h1>
          <p className="mt-1.5 text-sm text-[var(--color-muted)]">
            One account, whether you are booking or providing.
          </p>
        </div>

        <div className="card p-7">
          <Suspense fallback={<p className="text-sm text-[var(--color-muted)]">Loading</p>}>
            <SignupForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-[var(--color-accent)]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
