import {
  CATEGORY_LABELS,
  CONDITION_CATEGORIES,
  type ConditionCategory,
  type ConditionEntry,
  type PlanTag,
} from './condition-types';
import { CONDITION_CATALOG } from './condition-catalog';

/**
 * Lookup and search over the condition catalog.
 *
 * Everything here is pure, synchronous and precomputed at module load. The
 * catalog is a fixed ~120 entries, so searching it is a linear scan over
 * strings that were normalised once. There is deliberately no network call
 * per keystroke and no fuzzy-matching library: search has to stay instant
 * inside a WebView on a mid-range phone, and it has to return the same
 * results for the same query every time.
 */

/** Lowercase, strip accents, reduce anything non-alphanumeric to a space. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface IndexedCondition {
  entry: ConditionEntry;
  /** Normalised name, used for the strongest match tiers. */
  name: string;
  /** Normalised name plus every alias, each as its own string. */
  terms: string[];
}

const INDEX: readonly IndexedCondition[] = CONDITION_CATALOG.map((entry) => {
  const name = normalize(entry.name);
  const terms = [name, ...entry.aliases.map(normalize)].filter(
    (term) => term.length > 0,
  );
  return { entry, name, terms };
});

const BY_ID: ReadonlyMap<string, ConditionEntry> = new Map(
  CONDITION_CATALOG.map((entry) => [entry.id, entry]),
);

export const CONDITION_COUNT = CONDITION_CATALOG.length;

export function getCondition(id: string): ConditionEntry | undefined {
  return BY_ID.get(id);
}

/** Type guard for every trust boundary where an id arrives from outside. */
export function isConditionId(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value);
}

export function conditionName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

/**
 * Conditions in a category, in catalog order.
 *
 * Catalog order is curated (most commonly recognised first within each
 * category), so it is kept rather than sorted alphabetically.
 */
export function conditionsInCategory(
  category: ConditionCategory,
): ConditionEntry[] {
  return CONDITION_CATALOG.filter((entry) => entry.category === category);
}

export interface CategorySummary {
  category: ConditionCategory;
  label: string;
  count: number;
}

/** Categories that actually have entries, for rendering filter chips. */
export const CATEGORY_SUMMARIES: readonly CategorySummary[] =
  CONDITION_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    count: CONDITION_CATALOG.filter((entry) => entry.category === category)
      .length,
  })).filter((summary) => summary.count > 0);

/**
 * Match tiers, best first. A lower number sorts earlier.
 *
 * The tiers exist so that typing "hyp" puts "High blood pressure" (whose
 * alias "hypertension" starts with it) above "Hereditary spherocytosis"
 * (which only contains it mid-word).
 */
const TIER_EXACT_NAME = 0;
const TIER_NAME_PREFIX = 1;
const TIER_EXACT_ALIAS = 2;
const TIER_ALIAS_PREFIX = 3;
const TIER_WORD_PREFIX = 4;
const TIER_SUBSTRING = 5;
const TIER_NONE = 99;

function startsWithWord(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    if (at === 0 || haystack[at - 1] === ' ') return true;
    from = at + 1;
  }
}

function tierFor(indexed: IndexedCondition, query: string): number {
  if (indexed.name === query) return TIER_EXACT_NAME;
  if (indexed.name.startsWith(query)) return TIER_NAME_PREFIX;

  let best = TIER_NONE;
  for (let i = 0; i < indexed.terms.length; i += 1) {
    const term = indexed.terms[i];
    const isAlias = i > 0;
    if (isAlias && term === query) {
      best = Math.min(best, TIER_EXACT_ALIAS);
      continue;
    }
    if (isAlias && term.startsWith(query)) {
      best = Math.min(best, TIER_ALIAS_PREFIX);
      continue;
    }
    if (startsWithWord(term, query)) {
      best = Math.min(best, TIER_WORD_PREFIX);
      continue;
    }
    if (term.includes(query)) {
      best = Math.min(best, TIER_SUBSTRING);
    }
  }
  return best;
}

export interface SearchOptions {
  /** Restrict to one category. Omit or pass null for all categories. */
  category?: ConditionCategory | null;
  /** Hard cap on results. Defaults to the whole catalog. */
  limit?: number;
}

/**
 * Search the catalog.
 *
 * An empty query is not an error: it returns the category (or the whole
 * catalog) in curated order, which is what the picker shows before anyone
 * types. Multi-word queries require every word to match somewhere, so
 * "blood pressure" narrows rather than widens.
 */
export function searchConditions(
  query: string,
  options: SearchOptions = {},
): ConditionEntry[] {
  const { category = null, limit } = options;
  const pool = category
    ? INDEX.filter((indexed) => indexed.entry.category === category)
    : INDEX;

  const normalized = normalize(query);
  if (normalized.length === 0) {
    const all = pool.map((indexed) => indexed.entry);
    return typeof limit === 'number' ? all.slice(0, limit) : all;
  }

  const words = normalized.split(' ');
  const scored: Array<{ entry: ConditionEntry; tier: number; order: number }> =
    [];

  for (let order = 0; order < pool.length; order += 1) {
    const indexed = pool[order];
    let worst = 0;
    for (const word of words) {
      const tier = tierFor(indexed, word);
      if (tier === TIER_NONE) {
        worst = TIER_NONE;
        break;
      }
      worst = Math.max(worst, tier);
    }
    if (worst !== TIER_NONE) {
      scored.push({ entry: indexed.entry, tier: worst, order });
    }
  }

  // Tier first, then catalog order. Catalog order is a stable integer, so
  // the same query always yields the same list in the same sequence.
  scored.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.order - b.order));

  const results = scored.map((item) => item.entry);
  return typeof limit === 'number' ? results.slice(0, limit) : results;
}

/**
 * The union of plan tags across a set of selected conditions.
 *
 * Returned in PLAN_TAGS order via the catalog's own ordering of each
 * entry's tags, deduplicated. This is the only bridge between what a user
 * selected and which guidance they see.
 */
export function planTagsFor(conditionIds: readonly string[]): PlanTag[] {
  const seen = new Set<PlanTag>();
  for (const id of conditionIds) {
    const entry = BY_ID.get(id);
    if (!entry) continue;
    for (const tag of entry.planTags) seen.add(tag);
  }
  return [...seen];
}
