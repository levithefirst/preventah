/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/db-init.mjs
 *   npm run db:init          (reads .env.local)
 *
 * The schema is idempotent, so re-running is safe.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const schema = await readFile(join(here, '..', 'db', 'schema.sql'), 'utf8');

// Split on semicolons at end of line so the CHECK (...) lists stay intact.
const statements = schema
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !/^--/.test(s.replace(/\n/g, '')));

const sql = neon(url);

let applied = 0;
for (const statement of statements) {
  try {
    await sql.query(statement);
    applied += 1;
  } catch (error) {
    console.error('\nFailed statement:\n', statement, '\n');
    throw error;
  }
}

console.log(`Schema applied. ${applied} statement(s) executed.`);
