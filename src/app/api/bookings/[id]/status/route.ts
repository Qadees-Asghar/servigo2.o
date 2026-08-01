import { NextRequest } from "next/server";
import { z } from "zod";
import { sql, ROLE, STATUS } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handle, ok, fail, unauthorized, forbidden, notFound } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({
  statusId: z.coerce.number().int().min(1).max(5),
});

/**
 * Transition rules, enforced server side. The desktop app hid the buttons;
 * hiding a button is not a permission, so the rules live here instead.
 */
const ALLOWED: Record<number, number[]> = {
  [ROLE.CUSTOMER]: [STATUS.CANCELLED],
  [ROLE.PROVIDER]: [STATUS.ACCEPTED, STATUS.REJECTED, STATUS.COMPLETED],
  [ROLE.ADMIN]: [
    STATUS.PENDING,
    STATUS.ACCEPTED,
    STATUS.COMPLETED,
    STATUS.CANCELLED,
    STATUS.REJECTED,
  ],
};

/** A booking can only move forward from these states. */
const VALID_FROM: Record<number, number[]> = {
  [STATUS.ACCEPTED]: [STATUS.PENDING],
  [STATUS.REJECTED]: [STATUS.PENDING],
  [STATUS.COMPLETED]: [STATUS.ACCEPTED],
  [STATUS.CANCELLED]: [STATUS.PENDING, STATUS.ACCEPTED],
  [STATUS.PENDING]: [STATUS.PENDING],
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const bookingId = Number((await ctx.params).id);
    if (!bookingId) return fail("Invalid booking id.", 400);

    const { statusId } = bodySchema.parse(await req.json());

    if (!ALLOWED[session.roleId]?.includes(statusId)) {
      return forbidden();
    }

    const [booking] = await sql<
      { status_id: number; customer_id: string; provider_user_id: string }[]
    >`
      select b.status_id, b.customer_id, pu.user_id as provider_user_id
        from bookings b
        join time_slots ts        on b.slot_id = ts.slot_id
        join service_providers sp on ts.provider_id = sp.provider_id
        join users pu             on sp.user_id = pu.user_id
       where b.booking_id = ${bookingId}
    `;
    if (!booking) return notFound("Booking");

    // Ownership: you can only act on your own bookings unless you are admin.
    if (session.roleId === ROLE.CUSTOMER && booking.customer_id !== session.userId) {
      return forbidden();
    }
    if (session.roleId === ROLE.PROVIDER && booking.provider_user_id !== session.userId) {
      return forbidden();
    }

    if (
      session.roleId !== ROLE.ADMIN &&
      !VALID_FROM[statusId]?.includes(booking.status_id)
    ) {
      return fail("That status change is not allowed from the current state.", 409);
    }

    await sql`select update_booking_status(${bookingId}, ${statusId}, ${session.userId})`;

    return ok({ bookingId, statusId });
  });
}
