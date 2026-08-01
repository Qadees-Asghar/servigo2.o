import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { feedbackSchema } from "@/lib/validation";
import { handle, ok, unauthorized } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return unauthorized();

    const input = feedbackSchema.parse(await req.json());

    const [created] = await sql`
      insert into feedback_reports (submitted_by, report_type, target_user_id, subject, description)
      values (${session.userId}, ${input.reportType}, ${input.targetUserId ?? null},
              ${input.subject}, ${input.description})
      returning report_id, created_at
    `;

    return ok(created, 201);
  });
}
