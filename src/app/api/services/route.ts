import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public service catalogue. Only services from approved, active providers
 * are ever returned, which is the web equivalent of the desktop app's
 * ServiceDAL.GetActiveServices().
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const params = req.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim();
    const categoryId = Number(params.get("categoryId")) || null;

    const rows = await sql`
      select s.service_id,
             s.service_name,
             s.description,
             s.price,
             s.duration_minutes,
             sp.provider_id,
             sp.average_rating,
             u.full_name    as provider_name,
             sc.category_id,
             sc.category_name,
             (select count(*) from time_slots ts
               where ts.provider_id = sp.provider_id
                 and ts.is_available
                 and ts.slot_date between current_date and current_date + 7) as open_slots
        from services s
        join service_providers sp on s.provider_id = sp.provider_id
        join users u              on sp.user_id     = u.user_id
        join service_categories sc on sp.category_id = sc.category_id
       where s.is_active
         and sp.is_approved
         and u.is_active
         ${categoryId ? sql`and sc.category_id = ${categoryId}` : sql``}
         ${q ? sql`and (s.service_name ilike ${"%" + q + "%"}
                    or u.full_name ilike ${"%" + q + "%"}
                    or sc.category_name ilike ${"%" + q + "%"})` : sql``}
       order by sp.average_rating desc, s.price asc
       limit 100
    `;

    return ok(rows);
  });
}
