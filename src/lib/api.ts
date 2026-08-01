import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { fieldErrors } from "./validation";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, errors }, { status });
}

export const unauthorized = () => fail("You must be signed in.", 401);
export const forbidden = () => fail("You do not have access to this resource.", 403);
export const notFound = (what = "Resource") => fail(`${what} not found.`, 404);

/**
 * Wraps a route handler so that validation errors, database errors and
 * unexpected throws all produce a consistent JSON envelope. Postgres
 * `raise exception` messages from our own functions are surfaced to the
 * user, everything else is masked.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return fail("Please fix the highlighted fields.", 422, fieldErrors(err));
    }

    const pg = err as { code?: string; message?: string; constraint_name?: string };

    // Unique violations mapped to friendly, field-level messages.
    if (pg.code === "23505") {
      const c = pg.constraint_name ?? "";
      if (c.includes("email")) return fail("That email is already registered.", 409, { email: "Already registered." });
      if (c.includes("phone")) return fail("That phone number is already registered.", 409, { phone: "Already registered." });
      if (c.includes("cnic")) return fail("That CNIC is already registered.", 409, { cnic: "Already registered." });
      if (c.includes("provider_date_start")) return fail("You already have a slot at that time.", 409);
      if (c.includes("booking_id")) return fail("This booking has already been rated.", 409);
      return fail("That record already exists.", 409);
    }

    // Check-constraint and raise-exception messages from our own plpgsql.
    if (pg.code === "P0001" && pg.message) {
      return fail(pg.message, 400);
    }
    if (pg.code === "23514") {
      return fail("One of the values is out of the allowed range.", 400);
    }

    console.error("[servigo] unhandled error", err);
    return fail("Something went wrong. Please try again.", 500);
  }
}
