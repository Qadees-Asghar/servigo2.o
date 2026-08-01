import { NextRequest } from "next/server";
import { sql, ROLE } from "@/lib/db";
import {
  adminBootstrapClaimed,
  adminEmailAllowlist,
  hashPassword,
  isAllowlistedAdminEmail,
  isValidSetupToken,
  startSession,
  type DbUser,
} from "@/lib/auth";
import { adminSetupSchema } from "@/lib/validation";
import { handle, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET  -> tells the setup page whether bootstrapping is still possible.
 * POST -> claims the single admin account.
 *
 * Every one of these must hold, or the request is refused:
 *   1. ADMIN_SETUP_TOKEN is configured and matches (constant-time compare)
 *   2. the submitted email is on the ADMIN_EMAILS allowlist
 *   3. no admin has been bootstrapped yet (admin_bootstrap is empty)
 *   4. no Admin row already exists in users
 *
 * The password never appears in source, in the repo, or in the database
 * in plaintext. It is chosen here and stored as a bcrypt hash.
 */

export async function GET() {
  return handle(async () => {
    const hasEmails = adminEmailAllowlist().length > 0;
    const hasToken = (process.env.ADMIN_SETUP_TOKEN ?? "").length >= 16;
    const configured = hasEmails && hasToken;

    // Report the database separately from the config. Without this split, a
    // bad DATABASE_URL looks identical to a missing ADMIN_EMAILS, which sends
    // you round in circles fixing the wrong thing.
    let claimed = false;
    let dbOk = true;
    let dbError: string | null = null;

    try {
      claimed = await adminBootstrapClaimed();
    } catch (err) {
      dbOk = false;
      dbError =
        err instanceof Error ? err.message : "Could not reach the database.";
    }

    return ok({
      available: dbOk && configured && !claimed,
      claimed,
      configured,
      hasEmails,
      hasToken,
      dbOk,
      dbError,
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const input = adminSetupSchema.parse(await req.json());

    if (!isValidSetupToken(input.setupToken)) {
      return fail("Invalid setup token.", 403);
    }
    if (!isAllowlistedAdminEmail(input.email)) {
      return fail("This email is not on the administrator allowlist.", 403);
    }
    if (await adminBootstrapClaimed()) {
      return fail("An administrator has already been set up.", 409);
    }

    const passwordHash = await hashPassword(input.password);

    const admin = await sql.begin(async (tx) => {
      // Lock against a concurrent second claim.
      const [{ count }] = await tx<{ count: number }[]>`
        select count(*)::int as count from users where role_id = ${ROLE.ADMIN}
      `;
      if (count > 0) {
        throw Object.assign(new Error("An administrator already exists."), {
          code: "P0001",
        });
      }

      const [{ next_user_id: userId }] = await tx<{ next_user_id: string }[]>`
        select next_user_id()
      `;

      const [created] = await tx<DbUser[]>`
        insert into users (user_id, full_name, email, phone, cnic, password_hash, role_id)
        values (${userId}, ${input.fullName}, ${input.email}, ${input.phone},
                ${input.cnic}, ${passwordHash}, ${ROLE.ADMIN})
        returning *
      `;

      await tx`
        insert into admin_bootstrap (id, claimed_by) values (1, ${userId})
      `;

      await tx`
        insert into audit_logs (table_name, action, record_id, performed_by, details)
        values ('users', 'ADMIN_BOOTSTRAP', ${userId}, ${userId},
                'Administrator account claimed via setup token')
      `;

      return created;
    });

    await startSession(admin);

    return ok(
      {
        userId: admin.user_id,
        redirect: "/dashboard/admin",
        reminder:
          "Remove ADMIN_SETUP_TOKEN from your environment variables now. It is no longer needed.",
      },
      201
    );
  });
}
