import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Edge middleware. Verifies the session JWT signature before any dashboard
 * page renders, so an unauthenticated request never reaches the database.
 * Fine-grained ownership checks still happen in the route handlers.
 */

const ROLE_HOME: Record<number, string> = {
  1: "/dashboard/admin",
  2: "/dashboard/customer",
  3: "/dashboard/provider",
};

const AREA_ROLE: Array<[string, number]> = [
  ["/dashboard/admin", 1],
  ["/dashboard/customer", 2],
  ["/dashboard/provider", 3],
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  // Signed-in users should not sit on the auth pages.
  if (session && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.roleId] ?? "/", req.url));
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const area = AREA_ROLE.find(([prefix]) => pathname.startsWith(prefix));
  if (area && session.roleId !== area[1]) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.roleId] ?? "/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
