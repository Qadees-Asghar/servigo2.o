import Link from "next/link";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Electrician",
  "Plumber",
  "Mechanic",
  "Laundry",
  "Painter",
  "Carpenter",
  "Cleaner",
  "AC Repair",
  "Mason",
  "Gardener",
];

const STEPS = [
  {
    n: "01",
    t: "Find a provider",
    d: "Search by trade or name. Every provider on the list has been verified by an administrator before they can take a booking.",
  },
  {
    n: "02",
    t: "Pick a slot",
    d: "Providers publish their real availability. Slots open up to seven days ahead and lock the moment you book, so nobody double-books you.",
  },
  {
    n: "03",
    t: "Track and rate",
    d: "Watch the booking move from pending to accepted to completed, then leave a rating that feeds the provider's public score.",
  },
];

export default async function Home() {
  const session = await getSession();
  const home =
    session?.roleId === 1
      ? "/dashboard/admin"
      : session?.roleId === 3
        ? "/dashboard/provider"
        : "/dashboard/customer";

  return (
    <div className="relative">
      <div className="aurora" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href={home} className="btn btn-primary btn-sm">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline btn-sm">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-12 md:pt-20">
          <p className="badge bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
            Version 2.0
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">
            Book a trusted local pro
            <br />
            <span className="text-[var(--color-accent)]">without the phone tag.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">
            SERVIGO puts verified electricians, plumbers, mechanics and eight other
            trades on one booking calendar. Pick a real time slot, get a confirmation,
            and keep every appointment in one history.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={session ? home : "/signup"} className="btn btn-primary">
              {session ? "Open dashboard" : "Get started free"}
            </Link>
            <Link href="/signup?role=provider" className="btn btn-outline">
              Join as a service provider
            </Link>
          </div>

          <ul className="mt-14 flex flex-wrap gap-2" aria-label="Service categories">
            {CATEGORIES.map((c) => (
              <li
                key={c}
                className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm text-[var(--color-muted)]"
              >
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]/40">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-16 md:grid-cols-3">
            {STEPS.map((s) => (
              <article key={s.n} className="card p-6">
                <span className="text-sm font-black text-[var(--color-accent)]">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {s.d}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-16 md:grid-cols-3">
          <article className="card p-6">
            <h3 className="text-lg font-bold">For customers</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Browse the catalogue, book in a couple of taps, cancel if plans change,
              and rate the job when it is done. Notifications keep you posted at every
              status change.
            </p>
          </article>
          <article className="card p-6">
            <h3 className="text-lg font-bold">For providers</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Publish your services and your real availability. Accept or decline
              requests, mark jobs complete, and watch your average rating and completed
              earnings build up.
            </p>
          </article>
          <article className="card p-6">
            <h3 className="text-lg font-bold">For administrators</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Approve providers before they can trade, activate or suspend accounts,
              resolve complaints, and read a full audit trail of every change the
              system has made.
            </p>
          </article>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-line)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-[var(--color-muted)]">
          <Logo size="sm" />
          <p>SERVIGO 2.0 - service booking and management platform.</p>
        </div>
      </footer>
    </div>
  );
}
