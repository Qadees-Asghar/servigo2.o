import { NextRequest } from "next/server";
import { ROLE } from "@/lib/db";
import { authenticate, startSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { handle, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

const HOME: Record<number, string> = {
  [ROLE.ADMIN]: "/dashboard/admin",
  [ROLE.CUSTOMER]: "/dashboard/customer",
  [ROLE.PROVIDER]: "/dashboard/provider",
};

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password } = loginSchema.parse(await req.json());

    const result = await authenticate(email, password);
    if (!result.ok) return fail(result.reason, 401);

    await startSession(result.user);

    return ok({
      userId: result.user.user_id,
      fullName: result.user.full_name,
      roleId: result.user.role_id,
      redirect: HOME[result.user.role_id] ?? "/",
    });
  });
}
