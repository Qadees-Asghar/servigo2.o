"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type Service = {
  service_id: number;
  service_name: string;
  description: string | null;
  price: string;
  duration_minutes: number;
  provider_id: number;
  provider_name: string;
  category_name: string;
  average_rating: string;
  open_slots: number;
};

type Slot = {
  slot_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
};

type Booking = {
  booking_id: number;
  status_id: number;
  status_name: string;
  service_name: string;
  price: string;
  provider_name: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  rating_stars: number | null;
};

type Notification = {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function CustomerDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Service | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBookings = useCallback(async () => {
    const r = await api<Booking[]>("/api/bookings");
    if (r.ok && r.data) setBookings(r.data);
  }, []);

  const loadServices = useCallback(async (q: string) => {
    const r = await api<Service[]>(`/api/services?q=${encodeURIComponent(q)}`);
    if (r.ok && r.data) setServices(r.data);
  }, []);

  const loadAlerts = useCallback(async () => {
    const r = await api<Notification[]>("/api/notifications");
    if (r.ok && r.data) setAlerts(r.data);
  }, []);

  useEffect(() => {
    loadServices("");
    loadBookings();
    loadAlerts();
  }, [loadServices, loadBookings, loadAlerts]);

  // Debounced search so typing does not hammer the database.
  useEffect(() => {
    const id = setTimeout(() => loadServices(query), 300);
    return () => clearTimeout(id);
  }, [query, loadServices]);

  async function openBooking(service: Service) {
    setSelected(service);
    setMessage(null);
    setSlots([]);
    const r = await api<Slot[]>(`/api/slots?providerId=${service.provider_id}`);
    if (r.ok && r.data) setSlots(r.data);
  }

  async function book(slotId: number, notes: string) {
    if (!selected) return;
    setBusy(true);
    const r = await api("/api/bookings", {
      method: "POST",
      json: { slotId, serviceId: selected.service_id, notes },
    });
    setBusy(false);

    if (!r.ok) {
      setMessage({ kind: "error", text: r.message ?? "Booking failed." });
      return;
    }
    setMessage({ kind: "success", text: "Booking requested. The provider will confirm shortly." });
    setSelected(null);
    loadBookings();
    loadAlerts();
    loadServices(query);
  }

  async function cancel(bookingId: number) {
    const r = await api(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      json: { statusId: 4 },
    });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Could not cancel." });
    loadBookings();
    loadAlerts();
  }

  async function rate(bookingId: number, stars: number) {
    const r = await api("/api/ratings", { method: "POST", json: { bookingId, stars } });
    if (!r.ok) setMessage({ kind: "error", text: r.message ?? "Could not save rating." });
    else setMessage({ kind: "success", text: "Thanks for the rating." });
    loadBookings();
  }

  const stats = useMemo(() => {
    const by = (id: number) => bookings.filter((b) => b.status_id === id).length;
    return {
      total: bookings.length,
      upcoming: by(1) + by(2),
      completed: by(3),
      unread: alerts.filter((a) => !a.is_read).length,
    };
  }, [bookings, alerts]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      {message ? <Alert kind={message.kind}>{message.text}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bookings" value={stats.total} />
        <StatCard label="Upcoming" value={stats.upcoming} accent="var(--color-info)" />
        <StatCard label="Completed" value={stats.completed} accent="var(--color-success)" />
        <StatCard label="Unread alerts" value={stats.unread} accent="var(--color-gold)" />
      </div>

      {/* Browse */}
      <div id="browse">
        <Section
          title="Browse services"
          action={
            <input
              className="input max-w-xs"
              placeholder="Search trade, provider or service"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search services"
            />
          }
        >
          {services.length === 0 ? (
            <Empty>No approved services match that search yet.</Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((s) => (
                <article
                  key={s.service_id}
                  className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{s.service_name}</h3>
                      <p className="text-xs text-[var(--color-muted)]">
                        {s.provider_name} · {s.category_name}
                      </p>
                    </div>
                    <span className="badge bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
                      {money(s.price)}
                    </span>
                  </div>

                  {s.description ? (
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--color-muted)]">
                      {s.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>
                      <Stars value={Number(s.average_rating)} /> {Number(s.average_rating).toFixed(1)}
                    </span>
                    <span>{s.duration_minutes} min</span>
                  </div>

                  <button
                    className="btn btn-primary btn-sm mt-4 w-full"
                    onClick={() => openBooking(s)}
                    disabled={s.open_slots === 0}
                  >
                    {s.open_slots === 0 ? "No open slots" : `Book (${s.open_slots} slots)`}
                  </button>
                </article>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Bookings */}
      <div id="bookings">
        <Section title="My bookings">
          {bookings.length === 0 ? (
            <Empty>You have not booked anything yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Service</th>
                    <th>Provider</th>
                    <th>When</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td className="text-[var(--color-muted)]">{b.booking_id}</td>
                      <td className="font-semibold">{b.service_name}</td>
                      <td>{b.provider_name}</td>
                      <td className="whitespace-nowrap">
                        {formatDate(b.slot_date)} · {formatTime(b.start_time)}
                      </td>
                      <td>{money(b.price)}</td>
                      <td>
                        <StatusBadge status={b.status_name} />
                      </td>
                      <td>
                        {b.status_id === 1 || b.status_id === 2 ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => cancel(b.booking_id)}
                          >
                            Cancel
                          </button>
                        ) : b.status_id === 3 && b.rating_stars == null ? (
                          <span className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                title={`Rate ${n} of 5`}
                                onClick={() => rate(b.booking_id, n)}
                                className="text-[var(--color-muted)] transition hover:text-[var(--color-gold)]"
                              >
                                {n}
                              </button>
                            ))}
                          </span>
                        ) : b.rating_stars != null ? (
                          <Stars value={b.rating_stars} />
                        ) : (
                          <span className="text-[var(--color-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Notifications */}
      <div id="alerts">
        <Section
          title="Notifications"
          action={
            <button
              className="btn btn-outline btn-sm"
              onClick={async () => {
                await api("/api/notifications", { method: "PATCH", json: {} });
                loadAlerts();
              }}
            >
              Mark all read
            </button>
          }
        >
          {alerts.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {alerts.map((n) => (
                <li
                  key={n.notification_id}
                  className="flex items-start gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: n.is_read ? "var(--color-line)" : "var(--color-accent)",
                    }}
                    aria-hidden
                  />
                  <span className="flex-1">{n.message}</span>
                  <time className="whitespace-nowrap text-xs text-[var(--color-muted)]">
                    {formatDate(n.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Booking dialog */}
      {selected ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Book ${selected.service_name}`}
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{selected.service_name}</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {selected.provider_name} · {money(selected.price)} · {selected.duration_minutes} min
            </p>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                book(Number(fd.get("slotId")), String(fd.get("notes") ?? ""));
              }}
            >
              <div>
                <label className="label" htmlFor="slotId">
                  Available slots (next 7 days)
                </label>
                {slots.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    This provider has no open slots in the booking window.
                  </p>
                ) : (
                  <select id="slotId" name="slotId" className="input" required>
                    {slots.map((s) => (
                      <option key={s.slot_id} value={s.slot_id}>
                        {formatDate(s.slot_date)} · {formatTime(s.start_time)} to{" "}
                        {formatTime(s.end_time)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="label" htmlFor="notes">
                  Notes for the provider (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  className="input"
                  placeholder="Address, gate code, what needs fixing"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary flex-1"
                  disabled={busy || slots.length === 0}
                >
                  {busy ? "Booking" : "Confirm booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
