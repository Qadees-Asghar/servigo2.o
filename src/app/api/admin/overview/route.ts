import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireAdmin();
    if (!session) return unauthorized();

    const [stats] = await sql`select * from dashboard_stats()`;
    const summary = await sql`select * from vw_booking_summary order by status_name`;
    const providers = await sql`
      select sp.provider_id, sp.is_approved, sp.average_rating, sp.description,
             u.user_id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
             sc.category_name
        from service_providers sp
        join users u               on sp.user_id = u.user_id
        join service_categories sc on sp.category_id = sc.category_id
       order by sp.is_approved asc, u.created_at desc
       limit 200
    `;
    const users = await sql`
      select u.user_id, u.full_name, u.email, u.phone, u.role_id, u.is_active, u.created_at,
             r.role_name
        from users u
        join roles r on u.role_id = r.role_id
       order by u.created_at desc
       limit 200
    `;
    const reports = await sql`
      select report_id, submitted_by, report_type, target_user_id, subject,
             description, is_resolved, created_at
        from feedback_reports
       order by is_resolved asc, created_at desc
       limit 100
    `;
    const audit = await sql`
      select log_id, table_name, action, record_id, performed_by, logged_at
        from audit_logs
       order by logged_at desc
       limit 50
    `;

    return ok({ stats, summary, providers, users, reports, audit });
  });
}
