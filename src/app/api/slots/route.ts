import { NextRequest } from "next/server";
import { sql, ROLE } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { slotSchema } from "@/lib/validation";
import { handle, ok, fail, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/slots?providerId=1 - open slots inside the 7 day booking window. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const providerId = Number(req.nextUrl.searchParams.get("providerId"));
    if (!providerId) return fail("providerId is required.", 400);

    const rows = await sql`
      select slot_id, slot_date, start_time, end_time
        from time_slots
       where provider_id = ${providerId}
         and is_available
         and slot_date between current_date and current_date + 7
       order by slot_date, start_time
    `;
    return ok(rows);
  });
}

/** POST /api/slots - a provider publishes a new availability window. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireRole(ROLE.PROVIDER);
    if (!session) return unauthorized();

    const input = slotSchema.parse(await req.json());

    const [provider] = await sql<{ provider_id: number; is_approved: boolean }[]>`
      select provider_id, is_approved from service_providers where user_id = ${session.userId}
    `;
    if (!provider) return fail("Provider profile not found.", 404);
    if (!provider.is_approved) {
      return fail("Your provider account is still awaiting admin approval.", 403);
    }

    const [created] = await sql`
      insert into time_slots (provider_id, slot_date, start_time, end_time)
      values (${provider.provider_id}, ${input.slotDate}, ${input.startTime}, ${input.endTime})
      returning slot_id, slot_date, start_time, end_time, is_available
    `;

    return ok(created, 201);
  });
}
