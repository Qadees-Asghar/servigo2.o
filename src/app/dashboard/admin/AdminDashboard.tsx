"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Empty,
  Section,
  StatCard,
  Stars,
  api,
  formatDate,
} from "@/components/ui";

type Overview = {
  stats: {
    total_customers: string;
    total_providers: string;
    pending_approvals: string;
    total_bookings: string;
    pending_bookings: string;
    completed_bookings: string;
  };
  summary: Array<{ status_name: string; total_bookings: string }>;
  providers: Array<{
    provider_id: number;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    category_name: string;
    description: string | null;
    is_approved: boolean;
    is_active: boolean;
    average_rating: string;
    created_at: string;
  }>;
  users: Array<{
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    role_id: number;
    role_name: string;
    is_active: boolean;
    created_at: string;
  }>;
  reports: Array<{
    report_id: number;
    submitted_by: string;
    report_type: string;
    subject: string;
    description: string;
    is_resolved: boolean;
    created_at: string;
  }>;
  audit: Array<{
    log_id: number;
    table_name: string;
    action: string;
    record_id: string | null;
    performed_by: string | null;
    logged_at: string;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "var(--color-gold)",
  Accepted: "var(--color-info)",
  Completed: "var(--color-success)",
  Cancelled: "var(--color-danger)",
  Rejected: "var(--color-danger)",
};

export default function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<Overview>("/api/admin/overview");
    if (r.ok && r.data) setData(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(providerId: number, isApproved: boolean) {
    const r = await api(`/api/admin/providers/${providerId}`, {
      method: "PATCH",
      json: { isApproved },
    });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Update failed." });
    else setMessage({ kind: "success", text: isApproved ? "Provider approved." : "Approval revoked." });
    load();
  }

  async function setActive(userId: string, isActive: boolean) {
    const r = await api(`/api/admin/users/${userId}`, {
      method: "PATCH",
      json: { isActive },
    });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Update failed." });
    load();
  }

  async function resolve(reportId: number) {
    const r = await api(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      json: { isResolved: true },
    });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Update failed." });
    load();
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12">
        <p className="text-sm text-[var(--color-muted)]">Loading control panel</p>
      </main>
    );
  }

  const maxSummary = Math.max(
    1,
    ...data.summary.map((s) => Number(s.total_bookings))
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      {message ? <Alert kind={message.kind}>{message.text}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Customers" value={data.stats.total_customers} />
        <StatCard label="Providers" value={data.stats.total_providers} accent="var(--color-info)" />
        <StatCard
          label="Awaiting approval"
          value={data.stats.pending_approvals}
          accent="var(--color-gold)"
        />
        <StatCard label="Total bookings" value={data.stats.total_bookings} />
        <StatCard
          label="Pending bookings"
          value={data.stats.pending_bookings}
          accent="var(--color-gold)"
        />
        <StatCard
          label="Completed"
          value={data.stats.completed_bookings}
          accent="var(--color-success)"
        />
      </div>

      {/* Booking mix, rendered as a plain CSS bar chart so there is no
          charting dependency to ship to the browser. */}
      <Section title="Booking mix">
        {data.summary.length === 0 ? (
          <Empty>No bookings recorded yet.</Empty>
        ) : (
          <ul className="space-y-3">
            {data.summary.map((s) => {
              const n = Number(s.total_bookings);
              return (
                <li key={s.status_name} className="flex items-center gap-4">
                  <span className="w-24 shrink-0 text-sm text-[var(--color-muted)]">
                    {s.status_name}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(n / maxSummary) * 100}%`,
                        background: STATUS_COLOR[s.status_name] ?? "var(--color-accent)",
                      }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-sm font-bold">{n}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Providers */}
      <div id="providers">
        <Section title="Provider verification">
          {data.providers.length === 0 ? (
            <Empty>No providers registered.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Trade</th>
                    <th>Contact</th>
                    <th>Rating</th>
                    <th>Joined</th>
                    <th>State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.providers.map((p) => (
                    <tr key={p.provider_id}>
                      <td>
                        <p className="font-semibold">{p.full_name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{p.user_id}</p>
                      </td>
                      <td>{p.category_name}</td>
                      <td className="text-[var(--color-muted)]">
                        <p>{p.email}</p>
                        <p className="text-xs">{p.phone}</p>
                      </td>
                      <td>
                        <Stars value={Number(p.average_rating)} />
                      </td>
                      <td className="whitespace-nowrap text-[var(--color-muted)]">
                        {formatDate(p.created_at)}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={
                            p.is_approved
                              ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                              : { background: "var(--color-gold-dim)", color: "var(--color-gold)" }
                          }
                        >
                          {p.is_approved ? "Approved" : "In review"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${p.is_approved ? "btn-outline" : "btn-success"}`}
                          onClick={() => approve(p.provider_id, !p.is_approved)}
                        >
                          {p.is_approved ? "Revoke" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Users */}
      <div id="users">
        <Section title="User accounts">
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.user_id}>
                    <td className="text-[var(--color-muted)]">{u.user_id}</td>
                    <td className="font-semibold">{u.full_name}</td>
                    <td className="text-[var(--color-muted)]">{u.email}</td>
                    <td>{u.role_name}</td>
                    <td className="whitespace-nowrap text-[var(--color-muted)]">
                      {formatDate(u.created_at)}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={
                          u.is_active
                            ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                            : { background: "var(--color-danger-dim)", color: "var(--color-danger)" }
                        }
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      {u.role_id === 1 ? (
                        <span className="text-xs text-[var(--color-muted)]">Protected</span>
                      ) : (
                        <button
                          className={`btn btn-sm ${u.is_active ? "btn-danger" : "btn-success"}`}
                          onClick={() => setActive(u.user_id, !u.is_active)}
                        >
                          {u.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reports */}
        <div id="reports">
          <Section title="Complaints and feedback">
            {data.reports.length === 0 ? (
              <Empty>Nothing reported.</Empty>
            ) : (
              <ul className="space-y-2">
                {data.reports.map((r) => (
                  <li
                    key={r.report_id}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{r.subject}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {r.report_type} · {r.submitted_by} · {formatDate(r.created_at)}
                        </p>
                      </div>
                      {r.is_resolved ? (
                        <span className="badge bg-[var(--color-success-dim)] text-[var(--color-success)]">
                          Resolved
                        </span>
                      ) : (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => resolve(r.report_id)}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">{r.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Audit */}
        <div id="audit">
          <Section title="System activity">
            {data.audit.length === 0 ? (
              <Empty>No activity logged.</Empty>
            ) : (
              <ul className="space-y-1.5 font-mono text-xs">
                {data.audit.map((a) => (
                  <li
                    key={a.log_id}
                    className="flex items-center gap-3 rounded border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2"
                  >
                    <span className="w-32 shrink-0 text-[var(--color-accent)]">
                      {a.action}
                    </span>
                    <span className="flex-1 truncate text-[var(--color-muted)]">
                      {a.table_name} #{a.record_id ?? "-"}
                      {a.performed_by ? ` by ${a.performed_by}` : ""}
                    </span>
                    <time className="shrink-0 text-[var(--color-muted)]">
                      {new Date(a.logged_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
