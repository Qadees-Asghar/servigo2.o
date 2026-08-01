"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/* ---------------------------------------------------------------- Brand */

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${dim} grid place-items-center rounded-xl bg-[var(--color-accent)] text-white font-black`}
        aria-hidden
      >
        S
      </span>
      <span className={`${text} font-black tracking-tight`}>
        SERVI<span className="text-[var(--color-accent)]">GO</span>
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Cards */

export function StatCard({
  label,
  value,
  accent = "var(--color-accent)",
  hint,
}: {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="card relative overflow-hidden p-5">
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
        aria-hidden
      />
      <p className="text-3xl font-black leading-none" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{label}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--color-muted)] opacity-70">{hint}</p>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm text-[var(--color-muted)]">{children}</p>
  );
}

/* --------------------------------------------------------------- Badges */

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: "var(--color-gold-dim)", fg: "var(--color-gold)" },
  Accepted: { bg: "var(--color-info-dim)", fg: "var(--color-info)" },
  Completed: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
  Cancelled: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
  Rejected: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? {
    bg: "var(--color-surface-2)",
    fg: "var(--color-muted)",
  };
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span
      className="text-[var(--color-gold)]"
      aria-label={`${value} out of 5 stars`}
      title={`${value} / 5`}
    >
      {"*".repeat(Math.round(value)).padEnd(5, "·")}
    </span>
  );
}

/* ---------------------------------------------------------------- Alert */

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const map = {
    error: { bg: "var(--color-danger-dim)", fg: "var(--color-danger)" },
    success: { bg: "var(--color-success-dim)", fg: "var(--color-success)" },
    info: { bg: "var(--color-info-dim)", fg: "var(--color-info)" },
  }[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="rounded-lg px-3.5 py-2.5 text-sm"
      style={{ background: map.bg, color: map.fg }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- Nav bar */

export function TopBar({
  name,
  role,
  links,
}: {
  name: string;
  role: string;
  links: Array<{ href: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3">
        <Link href="/">
          <Logo size="sm" />
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="text-xs text-[var(--color-muted)]">{role}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout} disabled={busy}>
            {busy ? "Signing out" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- Fetcher */

type ApiEnvelope<T> = { ok: boolean; data?: T; message?: string; errors?: Record<string, string> };

export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<ApiEnvelope<T>> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json ? JSON.stringify(json) : rest.body,
  });
  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return { ok: false, message: "Unexpected server response." };
  }
}

export function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${suffix}`;
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function money(n: number | string) {
  return `Rs ${Number(n).toLocaleString()}`;
}
