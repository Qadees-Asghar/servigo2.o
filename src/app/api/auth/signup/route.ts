import { NextRequest } from "next/server";
import { sql, ROLE } from "@/lib/db";
import { hashPassword, isAllowlistedAdminEmail, startSession, type DbUser } from "@/lib/auth";
import { signupSchema } from "@/lib/validation";
import { handle, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const input = signupSchema.parse(await req.json());

    // Public signup can never mint an Admin. Even an allowlisted address has
    // to go through /admin/setup with the setup token.
    if (isAllowlistedAdminEmail(input.email)) {
      return fail(
        "This email is reserved for administrator setup. Use the admin setup page.",
        403
      );
    }

    const roleId = input.role === "provider" ? ROLE.PROVIDER : ROLE.CUSTOMER;
    const passwordHash = await hashPassword(input.password);

    const user = await sql.begin(async (tx) => {
      const [{ next_user_id: userId }] = await tx<{ next_user_id: string }[]>`
        select next_user_id()
      `;

      const [created] = await tx<DbUser[]>`
        insert into users (user_id, full_name, email, phone, cnic, password_hash, role_id)
        values (${userId}, ${input.fullName}, ${input.email}, ${input.phone},
                ${input.cnic}, ${passwordHash}, ${roleId})
        returning *
      `;

      if (roleId === ROLE.PROVIDER) {
        await tx`
          insert into service_providers (user_id, category_id, description, is_approved)
          values (${userId}, ${input.categoryId!}, ${input.description ?? null}, false)
        `;
        await tx`
          insert into notifications (user_id, message)
          values (${userId}, 'Welcome to SERVIGO. Your provider account is pending admin approval.')
        `;
      } else {
        await tx`
          insert into notifications (user_id, message)
          values (${userId}, 'Welcome to SERVIGO. Browse services and book your first appointment.')
        `;
      }

      return created;
    });

    await startSession(user);

    return ok({
      userId: user.user_id,
      fullName: user.full_name,
      roleId: user.role_id,
      redirect: roleId === ROLE.PROVIDER ? "/dashboard/provider" : "/dashboard/customer",
    }, 201);
  });
}
