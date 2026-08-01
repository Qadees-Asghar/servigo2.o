import { NextRequest } from "next/server";
import { z } from "zod";
import { sql, ROLE } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, fail, unauthorized, notFound } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({ isActive: z.boolean() });

/** Activate or deactivate an account. Admins cannot be deactivated here. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireAdmin();
    if (!session) return unauthorized();

    const userId = (await ctx.params).id;
    const { isActive } = bodySchema.parse(await req.json());

    if (userId === session.userId) {
      return fail("You cannot change the status of your own account.", 400);
    }

    const [target] = await sql<{ role_id: number }[]>`
      select role_id from users where user_id = ${userId}
    `;
    if (!target) return notFound("User");
    if (target.role_id === ROLE.ADMIN) {
      return fail("Administrator accounts cannot be modified from here.", 403);
    }

    await sql`update users set is_active = ${isActive} where user_id = ${userId}`;

    await sql`
      insert into notifications (user_id, message)
      values (${userId}, ${
        isActive ? "Your account has been reactivated." : "Your account has been deactivated."
      })
    `;

    await sql`
      insert into audit_logs (table_name, action, record_id, performed_by, details)
      values ('users', ${isActive ? "ACTIVATE" : "DEACTIVATE"}, ${userId},
              ${session.userId}, ${"by " + session.email})
    `;

    return ok({ userId, isActive });
  });
}
