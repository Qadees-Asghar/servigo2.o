import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handle, ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const rows = await sql`
      select notification_id, message, is_read, created_at
        from notifications
       where user_id = ${session.userId}
       order by created_at desc
       limit 50
    `;
    return ok(rows);
  });
}

/** PATCH marks everything, or a single notification, as read. */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as { notificationId?: number };
    const id = Number(body.notificationId) || null;

    await sql`
      update notifications
         set is_read = true
       where user_id = ${session.userId}
         ${id ? sql`and notification_id = ${id}` : sql``}
    `;

    return ok({ updated: true });
  });
}
