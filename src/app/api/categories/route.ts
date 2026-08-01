import { sql } from "@/lib/db";
import { handle, ok } from "@/lib/api";

export const runtime = "nodejs";
export const revalidate = 3600;

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
