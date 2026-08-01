import { NextRequest } from "next/server";
import { sql, ROLE, STATUS } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { ratingSchema } from "@/lib/validation";
import { handle, ok, fail, unauthorized, forbidden } from "@/lib/api";

export const runtime = "nodejs";

/**
 * A customer may rate a booking only if they own it and it is Completed.
 * The unique constraint on ratings.booking_id blocks duplicates, and the
 * ratings_refresh_avg trigger recalculates the provider average.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireRole(ROLE.CUSTOMER);
    if (!session) return unauthorized();

    const input = ratingSchema.parse(await req.json());

    const [booking] = await sql<
      { customer_id: string; status_id: number; provider_id: number }[]
    >`
      select b.customer_id, b.status_id, ts.provider_id
        from bookings b
        join time_slots ts on b.slot_id = ts.slot_id
       where b.booking_id = ${input.bookingId}
    `;

    if (!booking) return fail("Booking not found.", 404);
    if (booking.customer_id !== session.userId) return forbidden();
    if (booking.status_id !== STATUS.COMPLETED) {
      return fail("You can only rate a completed booking.", 409);
    }

    const [created] = await sql`
      insert into ratings (booking_id, provider_id, customer_id, stars, comment)
      values (${input.bookingId}, ${booking.provider_id}, ${session.userId},
              ${input.stars}, ${input.comment ?? null})
      returning rating_id, stars, comment, created_at
    `;

    return ok(created, 201);
  });
}
