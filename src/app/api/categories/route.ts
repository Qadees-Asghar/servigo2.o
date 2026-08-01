import { sql } from "@/lib/db";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";

// force-dynamic keeps this out of the build-time prerender pass. With
// `revalidate` set, Next executes the handler while "collecting page data",
// which means the build would need a live database connection. The category
// list is ten rows, so serving it per request costs nothing.
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const rows = await sql`
      select category_id, category_name
      from service_categories
      order by category_name
    `;
    return ok(rows);
  });
}
