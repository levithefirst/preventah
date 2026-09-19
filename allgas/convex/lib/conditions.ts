import { CONDITION_CATALOG } from './conditionCatalog';
import { conditionName, isConditionId } from './conditionIndex';

/**
 * The trust boundary for condition selections.
 *
 * Everything a user can tell Preventah about their family health comes
 * through here, and every value is an id from ./conditionCatalog.ts.
 * There is no free-text input anywhere in the app, and the database backs
 * that up with a foreign key, so this module is the first of two gates
 * rather than the only one.
 */

/**
 * A condition id. Deliberately `string` rather than a 117-member literal
 * union: every value that reaches this module arrives from an HTTP body or
 * a database row, so it has to be validated at runtime regardless, and a
 * union that large makes every downstream type error unreadable.
 */
export type ConditionId = string;

/**
 * Keys the pre-catalog six-item checklist could write, and where each one
 * goes now.
 *
 * Five of the six (type2_diabetes, cancer_family_history, hypertension,
 * metabolic_syndrome, osteoporosis) are catalog ids already and need no
 * entry here; a test asserts they still are. Only 'cardiovascular' moved,
 * to the condition that checkbox actually described.
 *
 * scripts/db-init.mjs applies the same mapping to stored rows. This copy
 * exists so a client still running the old bundle mid-deploy is upgraded
 * rather than rejected.
 */
export const LEGACY_KEY_MAP: Readonly<Record<string, ConditionId>> =
  Object.freeze({
    cardiovascular: 'coronary_artery_disease',
  });

/**
 * How many conditions one person may track at once.
 *
 * A cap has to exist somewhere: the daily plan blends guidance across
 * selections, and past a certain number the plan stops being a plan and
 * becomes a list of everything. Fifteen is comfortably more than anyone
 * has reported in testing while keeping the state payload small.
 */
export const MAX_SELECTIONS = 15;

export function upgradeLegacyKey(key: string): string {
  return LEGACY_KEY_MAP[key] ?? key;
}

export { isConditionId };

/**
 * Filters arbitrary input down to valid, unique ids in catalog order.
 *
 * Total by construction. Anything unrecognised is dropped rather than
 * raising, so a stale or hostile client can never wedge the flow or store
 * something the catalog does not contain. Excess selections beyond
 * MAX_SELECTIONS are dropped from the end of catalog order.
 */
export function sanitizeConditionIds(input: unknown): ConditionId[] {
  if (!Array.isArray(input)) return [];

  const wanted = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const id = upgradeLegacyKey(item);
    if (isConditionId(id)) wanted.add(id);
  }

  // Catalog order, not the order the client happened to send, so the same
  // set of selections always produces the same plan.
  const ordered: ConditionId[] = [];
  for (const entry of CONDITION_CATALOG) {
    if (wanted.has(entry.id)) ordered.push(entry.id);
    if (ordered.length === MAX_SELECTIONS) break;
  }
  return ordered;
}

/** Display name for an id, falling back to the id itself. Never throws. */
export function labelFor(id: ConditionId): string {
  return conditionName(id);
}
