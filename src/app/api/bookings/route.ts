import { NextRequest } from "next/server";
import { sql, ROLE } from "@/lib/db";
import { getSession, requireRole } from "@/lib/auth";
import { bookingSchema } from "@/lib/validation";
import { handle, ok, fail, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/bookings
 * Returns the caller's bookings. A customer sees the bookings they made,
 * a provider sees the bookings against their slots, an admin sees all.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const statusId = Number(req.nextUrl.searchParams.get("statusId")) || null;

    const scope =
      session.roleId === ROLE.CUSTOMER
        ? sql`and b.customer_id = ${session.userId}`
        : session.roleId === ROLE.PROVIDER
          ? sql`and sp.user_id = ${session.userId}`
          : sql``;

    const rows = await sql`
      select b.booking_id,
             b.notes,
             b.booked_at,
             b.updated_at,
             b.status_id,
             bs.status_name,
             s.service_id,
             s.service_name,
             s.price,
             s.duration_minutes,
             ts.slot_id,
             ts.slot_date,
             ts.start_time,
             ts.end_time,
             sp.provider_id,
             pu.full_name as provider_name,
             cu.user_id   as customer_id,
             cu.full_name as customer_name,
             cu.phone     as customer_phone,
             (select r.stars from ratings r where r.booking_id = b.booking_id) as rating_stars
        from bookings b
        join booking_statuses bs on b.status_id = bs.status_id
        join services s          on b.service_id = s.service_id
        join time_slots ts       on b.slot_id   = ts.slot_id
        join service_providers sp on ts.provider_id = sp.provider_id
        join users pu            on sp.user_id  = pu.user_id
        join users cu            on b.customer_id = cu.user_id
       where true
         ${scope}
         ${statusId ? sql`and b.status_id = ${statusId}` : sql``}
       order by ts.slot_date desc, ts.start_time desc
       limit 200
    `;

    return ok(rows);
  });
}

/**
 * POST /api/bookings
 * Delegates to the create_booking() Postgres function, which holds the same
 * transactional rules as the original sp_CreateBooking: availability check,
 * 7 day advance limit, no past slots, no double booking, slot lock and
 * provider notification, all inside one transaction.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireRole(ROLE.CUSTOMER);
    if (!session) return unauthorized();

    const input = bookingSchema.parse(await req.json());

    // The chosen service must belong to the provider who owns the slot.
    const [match] = await sql<{ ok: boolean }[]>`
      select exists (
        select 1
          from services s
          join time_slots ts on ts.provider_id = s.provider_id
         where s.service_id = ${input.serviceId}
           and ts.slot_id   = ${input.slotId}
           and s.is_active
      ) as ok
    `;
    if (!match?.ok) {
      return fail("That service is not offered in the selected time slot.", 400);
    }

    const [row] = await sql<{ create_booking: number }[]>`
      select create_booking(${session.userId}, ${input.slotId}, ${input.serviceId},
                            ${input.notes ?? null})
    `;

    return ok({ bookingId: row.create_booking }, 201);
  });
}
