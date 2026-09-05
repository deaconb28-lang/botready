#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql in name order to DATABASE_URL, once each.
 *
 * `pnpm db:migrate`. A `schema_migrations` table records what has run, so
 * re-running is safe. schema.sql stays the source of truth for a fresh
 * database; a migration is the delta for one that already exists.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

const require = createRequire(fileURLToPath(new URL('../apps/scanner/package.json', import.meta.url)));
const postgres = require('postgres');
const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql.unsafe('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  // Everything in `public` is served by PostgREST to anyone holding the anon
  // key, and this table was the one thing in the schema without RLS. Enabled
  // with no policy, which denies every role; the service role bypasses RLS, so
  // this runner is unaffected.
  await sql.unsafe('alter table schema_migrations enable row level security');
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    await sql.unsafe(readFileSync(dir + file, 'utf8'));
    await sql`insert into schema_migrations (name) values (${file})`;
    console.log(`applied ${file}`);
    ran += 1;
  }
  console.log(ran === 0 ? 'Nothing to apply.' : `${ran} migration${ran === 1 ? '' : 's'} applied.`);
} catch (err) {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
} finally {
  await sql.end();
}
