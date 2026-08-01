"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Empty,
  Section,
  StatCard,
  StatusBadge,
  Stars,
  api,
  formatDate,
  formatTime,
  money,
} from "@/components/ui";

type Overview = {
  provider: {
    provider_id: number;
    is_approved: boolean;
    average_rating: string;
    category_name: string;
    description: string | null;
  };
  stats: {
    total_bookings: number;
    pending: number;
    accepted: number;
    completed: number;
    open_slots: number;
    earnings: string;
  };
  slots: Array<{
    slot_id: number;
    slot_date: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
};

type Service = {
  service_id: number;
  service_name: string;
  description: string | null;
  price: string;
  duration_minutes: number;
  is_active: boolean;
};

type Booking = {
  booking_id: number;
  status_id: number;
  status_name: string;
  service_name: string;
  price: string;
  customer_name: string;
  customer_phone: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

export default function ProviderDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [o, s, b] = await Promise.all([
      api<Overview>("/api/provider/overview"),
      api<Service[]>("/api/provider/services"),
      api<Booking[]>("/api/bookings"),
    ]);
    if (o.ok && o.data) setOverview(o.data);
    if (s.ok && s.data) setServices(s.data);
    if (b.ok && b.data) setBookings(b.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(bookingId: number, statusId: number) {
    const r = await api(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      json: { statusId },
    });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Update failed." });
    load();
  }

  async function addService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const r = await api("/api/provider/services", {
      method: "POST",
      json: {
        serviceName: fd.get("serviceName"),
        description: fd.get("description"),
        price: fd.get("price"),
        durationMinutes: fd.get("durationMinutes"),
      },
    });
    if (!r.ok) {
      setMessage({ kind: "error", text: r.message ?? "Could not add the service." });
      return;
    }
    form.reset();
    setMessage({ kind: "success", text: "Service published." });
    load();
  }

  async function addSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const r = await api("/api/slots", {
      method: "POST",
      json: {
        slotDate: fd.get("slotDate"),
        startTime: fd.get("startTime"),
        endTime: fd.get("endTime"),
      },
    });
    if (!r.ok) {
      setMessage({ kind: "error", text: r.message ?? "Could not add the slot." });
      return;
    }
    form.reset();
    setMessage({ kind: "success", text: "Availability added." });
    load();
  }

  if (!overview) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12">
        <p className="text-sm text-[var(--color-muted)]">Loading your workspace</p>
      </main>
    );
  }

  const { provider, stats, slots } = overview;
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      {message ? <Alert kind={message.kind}>{message.text}</Alert> : null}

      {!provider.is_approved ? (
        <Alert kind="info">
          Your provider account is awaiting administrator approval. You can look
          around, but publishing services and availability unlocks once approved.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pending requests" value={stats.pending} accent="var(--color-gold)" />
        <StatCard label="Accepted" value={stats.accepted} accent="var(--color-info)" />
        <StatCard label="Completed" value={stats.completed} accent="var(--color-success)" />
        <StatCard label="Open slots" value={stats.open_slots} />
        <StatCard
          label="Completed earnings"
          value={money(stats.earnings)}
          accent="var(--color-gold)"
          hint={`${provider.category_name} · ${Number(provider.average_rating).toFixed(2)} avg`}
        />
      </div>

      {/* Requests */}
      <div id="requests">
        <Section title="Booking requests">
          {bookings.length === 0 ? (
            <Empty>No bookings against your slots yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>When</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td className="text-[var(--color-muted)]">{b.booking_id}</td>
                      <td>
                        <p className="font-semibold">{b.customer_name}</p>
                        <p className="text-xs text-[var(--color-muted)]">{b.customer_phone}</p>
                      </td>
                      <td>
                        {b.service_name}
                        <span className="block text-xs text-[var(--color-muted)]">
                          {money(b.price)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(b.slot_date)} · {formatTime(b.start_time)}
                      </td>
                      <td className="max-w-[16rem] text-[var(--color-muted)]">
                        {b.notes || "-"}
                      </td>
                      <td>
                        <StatusBadge status={b.status_name} />
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          {b.status_id === 1 ? (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => setStatus(b.booking_id, 2)}
                              >
                                Accept
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => setStatus(b.booking_id, 5)}
                              >
                                Reject
                              </button>
                            </>
                          ) : b.status_id === 2 ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setStatus(b.booking_id, 3)}
                            >
                              Mark complete
                            </button>
                          ) : (
                            <span className="text-[var(--color-muted)]">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Services */}
        <div id="services">
          <Section title="My services">
            <form onSubmit={addService} className="space-y-3">
              <input
                name="serviceName"
                className="input"
                placeholder="Service name, e.g. Ceiling fan installation"
                required
                minLength={3}
              />
              <textarea
                name="description"
                rows={2}
                maxLength={500}
                className="input"
                placeholder="What is included (optional)"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  placeholder="Price (Rs)"
                  required
                />
                <input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  className="input"
                  placeholder="Duration (min)"
                  required
                />
              </div>
              <button className="btn btn-primary w-full" disabled={!provider.is_approved}>
                Publish service
              </button>
            </form>

            <ul className="mt-5 space-y-2">
              {services.length === 0 ? (
                <Empty>No services published yet.</Empty>
              ) : (
                services.map((s) => (
                  <li
                    key={s.service_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-semibold">{s.service_name}</span>
                      <span className="block text-xs text-[var(--color-muted)]">
                        {s.duration_minutes} min
                      </span>
                    </span>
                    <span className="font-bold text-[var(--color-accent)]">
                      {money(s.price)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Section>
        </div>

        {/* Availability */}
        <div id="slots">
          <Section title="Availability (next 7 days)">
            <form onSubmit={addSlot} className="space-y-3">
              <input
                name="slotDate"
                type="date"
                className="input"
                min={today}
                max={maxDate}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input name="startTime" type="time" className="input" required />
                <input name="endTime" type="time" className="input" required />
              </div>
              <button className="btn btn-primary w-full" disabled={!provider.is_approved}>
                Add time slot
              </button>
            </form>

            <ul className="mt-5 space-y-2">
              {slots.length === 0 ? (
                <Empty>No upcoming availability.</Empty>
              ) : (
                slots.map((s) => (
                  <li
                    key={s.slot_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm"
                  >
                    <span>
                      {formatDate(s.slot_date)} · {formatTime(s.start_time)} to{" "}
                      {formatTime(s.end_time)}
                    </span>
                    <span
                      className="badge"
                      style={
                        s.is_available
                          ? { background: "var(--color-success-dim)", color: "var(--color-success)" }
                          : { background: "var(--color-surface)", color: "var(--color-muted)" }
                      }
                    >
                      {s.is_available ? "Open" : "Booked"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Section>
        </div>
      </div>

      <p className="text-center text-sm text-[var(--color-muted)]">
        Current rating <Stars value={Number(provider.average_rating)} />{" "}
        {Number(provider.average_rating).toFixed(2)} across {stats.completed} completed
        jobs.
      </p>
    </main>
  );
}
