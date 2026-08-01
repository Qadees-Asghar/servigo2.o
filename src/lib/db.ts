import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

/**
 * Lazily created Postgres client.
 *
 * The connection is opened on first use, never at module load. This matters
 * because `next build` imports every route module to collect page data. If the
 * client were built at module scope, a missing DATABASE_URL would fail the
 * whole build rather than the single request that actually needs a database.
 *
 * The instance is cached on globalThis so a warm lambda reuses one socket.
 * `max: 1` is deliberate: Supabase's transaction pooler already multiplexes,
 * so one socket per lambda keeps us well under the connection limit.
 */

declare global {
  // eslint-disable-next-line no-var
  var __servigoSql: Sql | undefined;
}

let client: Sql | undefined;

function getClient(): Sql {
  if (client) return client;
  if (globalThis.__servigoSql) {
    client = globalThis.__servigoSql;
    return client;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it in Vercel under Settings > Environment Variables, or copy .env.example to .env.local for local development."
    );
  }

  client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // required for the Supabase transaction pooler
    ssl: connectionString.includes("localhost") ? false : "require",
  });

  globalThis.__servigoSql = client;
  return client;
}

/**
 * Proxy that forwards both tagged-template calls (`sql\`select 1\``) and
 * property access (`sql.begin`, `sql.unsafe`) to the lazily built client.
 */
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getClient() as any)(...args);
  },
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getClient() as any;
    const value = c[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
}) as Sql;

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
