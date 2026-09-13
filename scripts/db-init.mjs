/**
 * Brings the database in DATABASE_URL up to date, in three ordered phases.
 *
 *   1. Apply db/schema.sql. Idempotent DDL only.
 *   2. Sync the conditions table from src/lib/condition-catalog.ts.
 *   3. Migrate condition_selections onto the catalog.
 *
 * The order matters: phase 3 adds a foreign key into conditions, which can
 * only succeed once phase 2 has seeded the rows it points at.
 *
 * Every phase is safe to re-run. Running this against a database that is
 * already current does nothing and says so.
 *
 * Usage:
 *   DATABASE_URL=... node --import ./scripts/register.mjs scripts/db-init.mjs
 *   npm run db:init          (reads .env.local)
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

import { CONDITION_CATALOG } from '../src/lib/condition-catalog.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(url);

/**
 * The one legacy selection key with no catalog equivalent.
 *
 * The other five keys the old six-item checklist could write
 * (type2_diabetes, cancer_family_history, hypertension, metabolic_syndrome,
 * osteoporosis) are all catalog ids already, and a test asserts that. Only
 * 'cardiovascular' needs a home, and coronary artery disease is what that
 * checkbox described.
 */
const LEGACY_KEY_MAP = Object.freeze({
  cardiovascular: 'coronary_artery_disease',
});

async function applySchema() {
  const schema = await readFile(join(repoRoot, 'db', 'schema.sql'), 'utf8');

  // Split on semicolons at end of line so CHECK (...) lists stay intact.
  const statements = schema
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--/.test(s.replace(/\n/g, '')));

  for (const statement of statements) {
    try {
      await sql.query(statement);
    } catch (error) {
      console.error('\nFailed statement:\n', statement, '\n');
      throw error;
    }
  }
  console.log(`1. Schema applied (${statements.length} statements).`);
}

async function syncConditions() {
  const ids = CONDITION_CATALOG.map((entry) => entry.id);
  const names = CONDITION_CATALOG.map((entry) => entry.name);
  const categories = CONDITION_CATALOG.map((entry) => entry.category);

  // One statement, unnested from three parallel arrays. Keeps the round
  // trips at one regardless of how large the catalog grows.
  const upserted = await sql.query(
    `INSERT INTO conditions (id, name, category, retired_at, updated_at)
     SELECT id, name, category, NULL, now()
       FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, name, category)
     ON CONFLICT (id) DO UPDATE
        SET name       = EXCLUDED.name,
            category   = EXCLUDED.category,
            retired_at = NULL,
            updated_at = now()
     RETURNING id`,
    [ids, names, categories],
  );

  // Anything no longer in the catalog is retired, never deleted: an old
  // selection must keep resolving, and the foreign key must keep holding.
  const retired = await sql.query(
    `UPDATE conditions
        SET retired_at = now(), updated_at = now()
      WHERE retired_at IS NULL
        AND id <> ALL($1::text[])
      RETURNING id`,
    [ids],
  );

  console.log(
    `2. Conditions synced: ${upserted.length} current` +
      (retired.length > 0
        ? `, ${retired.length} retired (${retired.map((r) => r.id).join(', ')}).`
        : ', none retired.'),
  );
}

async function migrateConditionSelections() {
  const notes = [];

  // The old six-value CHECK. Postgres names it predictably, but check for
  // any CHECK on the column rather than trusting one generated name.
  const checks = await sql.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conrelid = 'condition_selections'::regclass
        AND contype  = 'c'`,
  );
  for (const { conname } of checks) {
    await sql.query(
      `ALTER TABLE condition_selections DROP CONSTRAINT "${conname}"`,
    );
    notes.push(`dropped CHECK ${conname}`);
  }

  for (const [legacy, replacement] of Object.entries(LEGACY_KEY_MAP)) {
    // A user could in principle hold both the legacy key and its
    // replacement. UNIQUE (user_id, category_key) would reject the update,
    // so drop the redundant legacy row first.
    const dropped = await sql.query(
      `DELETE FROM condition_selections cs
        WHERE cs.category_key = $1
          AND EXISTS (SELECT 1
                        FROM condition_selections other
                       WHERE other.user_id      = cs.user_id
                         AND other.category_key = $2)
        RETURNING cs.id`,
      [legacy, replacement],
    );
    const moved = await sql.query(
      `UPDATE condition_selections
          SET category_key = $2
        WHERE category_key = $1
        RETURNING id`,
      [legacy, replacement],
    );
    if (moved.length > 0 || dropped.length > 0) {
      notes.push(
        `remapped ${moved.length} "${legacy}" -> "${replacement}"` +
          (dropped.length > 0 ? ` (${dropped.length} duplicate removed)` : ''),
      );
    }
  }

  // Refuse to add the foreign key over rows it would orphan. Failing here
  // with the offending keys named beats a bare constraint-violation error.
  const orphans = await sql.query(
    `SELECT DISTINCT cs.category_key
       FROM condition_selections cs
       LEFT JOIN conditions c ON c.id = cs.category_key
      WHERE c.id IS NULL`,
  );
  if (orphans.length > 0) {
    throw new Error(
      'condition_selections holds keys that are not in the catalog: ' +
        orphans.map((row) => row.category_key).join(', ') +
        '. Add them to LEGACY_KEY_MAP or to the catalog, then re-run.',
    );
  }

  const existing = await sql.query(
    `SELECT 1
       FROM pg_constraint
      WHERE conrelid = 'condition_selections'::regclass
        AND contype  = 'f'
        AND conname  = 'condition_selections_condition_fk'`,
  );
  if (existing.length === 0) {
    await sql.query(
      `ALTER TABLE condition_selections
         ADD CONSTRAINT condition_selections_condition_fk
         FOREIGN KEY (category_key) REFERENCES conditions(id) ON UPDATE CASCADE`,
    );
    notes.push('added foreign key to conditions');
  }

  console.log(
    `3. condition_selections: ${notes.length > 0 ? notes.join('; ') : 'already current'}.`,
  );
}

await applySchema();
await syncConditions();
await migrateConditionSelections();

const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM conditions');
console.log(`\nDone. ${count} conditions available for selection.`);
