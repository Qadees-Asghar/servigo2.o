import postgres from "postgres";

/**
 * Single pooled Postgres client, reused across serverless invocations.
 *
 * On Vercel each lambda is frozen between requests, so we cache the client
 * on globalThis to avoid opening a new connection on every warm request.
 * `max: 1` is deliberate: Supabase's transaction pooler already multiplexes,
 * and one socket per lambda keeps us well under the connection limit.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __servigoSql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  globalThis.__servigoSql ??
  postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required for the Supabase transaction pooler
    ssl: connectionString.includes("localhost") ? false : "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__servigoSql = sql;
}

/** Role ids, mirrored from the `roles` seed data. */
export const ROLE = {
  ADMIN: 1,
  CUSTOMER: 2,
  PROVIDER: 3,
} as const;

/** Booking status ids, mirrored from the `booking_statuses` seed data. */
export const STATUS = {
  PENDING: 1,
  ACCEPTED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
  REJECTED: 5,
} as const;

export type RoleId = (typeof ROLE)[keyof typeof ROLE];
export type StatusId = (typeof STATUS)[keyof typeof STATUS];

export const ROLE_NAME: Record<number, string> = {
  1: "Admin",
  2: "Customer",
  3: "ServiceProvider",
};

export const STATUS_NAME: Record<number, string> = {
  1: "Pending",
  2: "Accepted",
  3: "Completed",
  4: "Cancelled",
  5: "Rejected",
};
