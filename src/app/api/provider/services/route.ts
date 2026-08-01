import { NextRequest } from "next/server";
import { sql, ROLE } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { serviceSchema } from "@/lib/validation";
import { handle, ok, fail, unauthorized } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentProvider(userId: string) {
  const [row] = await sql<{ provider_id: number; is_approved: boolean }[]>`
    select provider_id, is_approved from service_providers where user_id = ${userId}
  `;
  return row ?? null;
}

export async function GET() {
  return handle(async () => {
    const session = await requireRole(ROLE.PROVIDER);
    if (!session) return unauthorized();

    const provider = await currentProvider(session.userId);
    if (!provider) return fail("Provider profile not found.", 404);

    const rows = await sql`
      select service_id, service_name, description, price, duration_minutes, is_active
        from services
       where provider_id = ${provider.provider_id}
       order by service_name
    `;
    return ok(rows);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireRole(ROLE.PROVIDER);
    if (!session) return unauthorized();

    const provider = await currentProvider(session.userId);
    if (!provider) return fail("Provider profile not found.", 404);
    if (!provider.is_approved) {
      return fail("Your provider account is still awaiting admin approval.", 403);
    }

    const input = serviceSchema.parse(await req.json());

    const [created] = await sql`
      insert into services (provider_id, service_name, description, price, duration_minutes)
      values (${provider.provider_id}, ${input.serviceName}, ${input.description ?? null},
              ${input.price}, ${input.durationMinutes})
      returning service_id, service_name, description, price, duration_minutes, is_active
    `;

    return ok(created, 201);
  });
}
