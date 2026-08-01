import { NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, fail, unauthorized, notFound } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({ isApproved: z.boolean() });

/** Approve or revoke a service provider. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireAdmin();
    if (!session) return unauthorized();

    const providerId = Number((await ctx.params).id);
    if (!providerId) return fail("Invalid provider id.", 400);

    const { isApproved } = bodySchema.parse(await req.json());

    const [updated] = await sql<{ user_id: string }[]>`
      update service_providers
         set is_approved = ${isApproved}
       where provider_id = ${providerId}
       returning user_id
    `;
    if (!updated) return notFound("Provider");

    await sql`
      insert into notifications (user_id, message)
      values (${updated.user_id}, ${
        isApproved
          ? "Your provider account has been approved. You can now publish services and time slots."
          : "Your provider approval has been revoked. Contact support for details."
      })
    `;

    await sql`
      insert into audit_logs (table_name, action, record_id, performed_by, details)
      values ('service_providers', ${isApproved ? "APPROVE" : "REVOKE"},
              ${String(providerId)}, ${session.userId}, ${"by " + session.email})
    `;

    return ok({ providerId, isApproved });
  });
}
