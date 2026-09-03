#!/usr/bin/env node
/**
 * Applies db/seed-index.sql. `pnpm seed:index`. Idempotent.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example.');
  process.exit(1);
}

const require = createRequire(fileURLToPath(new URL('../apps/scanner/package.json', import.meta.url)));
const postgres = require('postgres');
const seed = readFileSync(fileURLToPath(new URL('../db/seed-index.sql', import.meta.url)), 'utf8');
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql.unsafe(seed);
  const [{ count }] = await sql`select count(*)::int as count from sites where segment is not null`;
  console.log(`Seeded. ${count} sites carry a segment. The nightly cron will scan them.`);
} finally {
  await sql.end();
}
