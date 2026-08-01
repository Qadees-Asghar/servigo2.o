import { sql, ROLE } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { handle, ok, fail, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireRole(ROLE.PROVIDER);
    if (!session) return unauthorized();

    const [provider] = await sql<
      {
        provider_id: number;
        is_approved: boolean;
        average_rating: string;
        category_name: string;
        description: string | null;
      }[]
    >`
      select sp.provider_id, sp.is_approved, sp.average_rating, sp.description,
             sc.category_name
        from service_providers sp
        join service_categories sc on sp.category_id = sc.category_id
       where sp.user_id = ${session.userId}
    `;
    if (!provider) return fail("Provider profile not found.", 404);

    const [stats] = await sql<
      {
        total_bookings: number;
        pending: number;
        accepted: number;
        completed: number;
        open_slots: number;
        earnings: string;
      }[]
    >`
      select
        (select count(*) from bookings b join time_slots t on b.slot_id = t.slot_id
          where t.provider_id = ${provider.provider_id})::int as total_bookings,
        (select count(*) from bookings b join time_slots t on b.slot_id = t.slot_id
          where t.provider_id = ${provider.provider_id} and b.status_id = 1)::int as pending,
        (select count(*) from bookings b join time_slots t on b.slot_id = t.slot_id
          where t.provider_id = ${provider.provider_id} and b.status_id = 2)::int as accepted,
        provider_completed_count(${provider.provider_id}) as completed,
        (select count(*) from time_slots
          where provider_id = ${provider.provider_id} and is_available
            and slot_date >= current_date)::int as open_slots,
        (select coalesce(sum(s.price), 0) from bookings b
           join services s on b.service_id = s.service_id
           join time_slots t on b.slot_id = t.slot_id
          where t.provider_id = ${provider.provider_id} and b.status_id = 3) as earnings
    `;

    const slots = await sql`
      select slot_id, slot_date, start_time, end_time, is_available
        from time_slots
       where provider_id = ${provider.provider_id}
         and slot_date >= current_date
       order by slot_date, start_time
       limit 60
    `;

    return ok({ provider, stats, slots });
  });
}
