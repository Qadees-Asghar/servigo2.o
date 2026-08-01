#!/usr/bin/env node
/**
 * Applies every SQL file in supabase/migrations in filename order.
 * Uses DIRECT_URL (port 5432) because DDL does not work well through the
 * transaction pooler.
 *
 *   npm run db:push
 */

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_URL (or DATABASE_URL) before running migrations.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: url.includes("localhost") ? false : "require" });

try {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    process.exit(0);
  }

  for (const file of files) {
    const text = await readFile(join(migrationsDir, file), "utf8");
    process.stdout.write(`Applying ${file} ... `);
    await sql.unsafe(text);
    console.log("done");
  }

  console.log(`\nApplied ${files.length} migration file(s).`);
} catch (err) {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
