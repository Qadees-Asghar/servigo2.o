import { NextRequest } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handle, ok, fail, unauthorized, notFound } from "@/lib/api";

export const runtime = "nodejs";

const bodySchema = z.object({ isResolved: z.boolean() });

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const session = await requireAdmin();
    if (!session) return unauthorized();

    const reportId = Number((await ctx.params).id);
    if (!reportId) return fail("Invalid report id.", 400);

    const { isResolved } = bodySchema.parse(await req.json());

    const [updated] = await sql<{ submitted_by: string }[]>`
      update feedback_reports
         set is_resolved = ${isResolved},
             resolved_at = ${isResolved ? sql`now()` : null}
       where report_id = ${reportId}
       returning submitted_by
    `;
    if (!updated) return notFound("Report");

    if (isResolved) {
      await sql`
        insert into notifications (user_id, message)
        values (${updated.submitted_by},
                ${"Your report #" + reportId + " has been reviewed and resolved."})
      `;
    }

    return ok({ reportId, isResolved });
  });
}
