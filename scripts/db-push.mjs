#!/usr/bin/env node
/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * `pnpm db:push`. The schema file is the source of truth and is written to be
 * applied once to an empty database; it is not a migration tool. For a change
 * to a live database, write the ALTER by hand, apply it, and update schema.sql
 * to match, in that order, so the file always describes what is deployed.
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

const schema = readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql.unsafe(schema);
  console.log('db/schema.sql applied.');
} catch (err) {
  console.error(`Failed: ${err.message}`);
  console.error('If the tables already exist, this file is not a migration; see the note at the top of scripts/db-push.mjs.');
  process.exit(1);
} finally {
  await sql.end();
}
