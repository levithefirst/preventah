import type { PlanTag } from './condition-types';
import { conditionName, getCondition } from './condition-index';
import type { ConditionId } from './conditions';
import { PLAN_CONTENT, type PlanContent, type PlanItemType } from './plan-content';

/**
 * Resolves a daily plan from a set of selected conditions.
 *
 * Design rules, all of which still matter:
 *  - Pure data plus pure functions. No network call, no LLM, no async.
 *    Resolving a plan cannot fail and cannot be slow.
 *  - Output is a pure function of (selected conditions, day index), so the
 *    same inputs always produce the same plan. That is what lets the server
 *    and the client render the same thing.
 *  - Total. Every input produces a plan, including an empty selection, an
 *    unknown condition id, or a nonsense day index.
 *
 * The bridge from conditions to guidance is the tag vocabulary in
 * condition-types.ts. A condition carries tags, a plan item carries tags,
 * and an item is shown when the two intersect. Nothing in the catalog
 * names a plan item and nothing in the content names a condition, which is
 * why the catalog can grow without the content having to.
 */

export const PLAN_TYPES: readonly PlanItemType[] = ['diet', 'exercise', 'habit'];

const BY_TYPE: Record<PlanItemType, readonly PlanContent[]> = {
  diet: PLAN_CONTENT.filter((item) => item.type === 'diet'),
  exercise: PLAN_CONTENT.filter((item) => item.type === 'exercise'),
  habit: PLAN_CONTENT.filter((item) => item.type === 'habit'),
};

/**
 * Shown when a selection produces no match for a type, and when nothing is
 * selected at all.
 *
 * Some conditions legitimately carry no dietary or exercise tag at all
 * (an inherited retinal condition, say), and the honest answer there is
 * general prevention rather than a strained connection. These ids must
 * exist in PLAN_CONTENT; a test asserts it.
 */
const FALLBACK_IDS: Record<PlanItemType, readonly string[]> = {
  diet: ['diet_vegetables', 'diet_fibre_target', 'diet_sugary_drinks', 'diet_cook_one_meal'],
  exercise: ['ex_brisk_walk', 'ex_strength', 'ex_break_sitting', 'ex_daylight_walk'],
  habit: ['habit_sleep_window', 'habit_slow_breathing', 'habit_connect', 'habit_plan_tomorrow'],
};

const FALLBACK: Record<PlanItemType, readonly PlanContent[]> = {
  diet: BY_TYPE.diet.filter((item) => FALLBACK_IDS.diet.includes(item.id)),
  exercise: BY_TYPE.exercise.filter((item) => FALLBACK_IDS.exercise.includes(item.id)),
  habit: BY_TYPE.habit.filter((item) => FALLBACK_IDS.habit.includes(item.id)),
};

export interface PlanItem {
  id: string;
  type: PlanItemType;
  title: string;
  description: string;
  why: string;
  howTo: readonly string[];
  benefit: string;
  target: string;
  safetyNote: string | null;
  /**
   * Names of the user's own selections this item connects to, at most
   * three. Empty when the item came from the general fallback, which the
   * UI renders as "General prevention" rather than inventing a link.
   */
  relatedConditions: string[];
  /** The tags that caused the match, for the detail view. */
  matchedTags: PlanTag[];
  sourceName: string;
  sourceUrl: string;
}

export interface DailyPlan {
  dayIndex: number;
  diet: PlanItem;
  exercise: PlanItem;
  habit: PlanItem;
  /** True when the whole plan came from the fallback set. */
  isBaseline: boolean;
}

function toPlanItem(
  content: PlanContent,
  selected: readonly ConditionId[],
  tagOwners: ReadonlyMap<PlanTag, string[]>,
): PlanItem {
  const matchedTags = content.tags.filter((tag) => tagOwners.has(tag));

  // Preserve the user's selection order, deduplicated, so the same profile
  // always lists the same names in the same sequence.
  const names: string[] = [];
  for (const id of selected) {
    const entry = getCondition(id);
    if (!entry) continue;
    if (entry.planTags.some((tag) => matchedTags.includes(tag))) {
      names.push(conditionName(id));
    }
    if (names.length === 3) break;
  }

  return {
    id: content.id,
    type: content.type,
    title: content.title,
    description: content.description,
    why: content.why,
    howTo: content.howTo,
    benefit: content.benefit,
    target: content.target,
    safetyNote: content.safetyNote ?? null,
    relatedConditions: names,
    matchedTags,
    sourceName: content.sourceName,
    sourceUrl: content.sourceUrl,
  };
}

/**
 * Every item of a type that matches at least one of the user's tags,
 * in content order. Exported because the plan detail view offers
 * "other things that apply to you" alongside today's item.
 */
export function matchingContent(
  type: PlanItemType,
  tags: ReadonlySet<PlanTag>,
): readonly PlanContent[] {
  if (tags.size === 0) return FALLBACK[type];
  const matches = BY_TYPE[type].filter((item) =>
    item.tags.some((tag) => tags.has(tag)),
  );
  return matches.length > 0 ? matches : FALLBACK[type];
}

function safeDayIndex(dayIndex: number): number {
  return Number.isFinite(dayIndex) && dayIndex >= 0 ? Math.floor(dayIndex) : 0;
}

/**
 * Resolves the plan for a set of conditions and a day index.
 * Pure, synchronous, total: every input produces a plan.
 */
export function getDailyPlan(
  selected: readonly ConditionId[],
  dayIndex: number,
): DailyPlan {
  const day = safeDayIndex(dayIndex);

  // Which of the user's selections owns each tag. Doubles as the tag set
  // for matching and as the lookup for naming the connection afterwards.
  const tagOwners = new Map<PlanTag, string[]>();
  for (const id of selected) {
    const entry = getCondition(id);
    if (!entry) continue;
    for (const tag of entry.planTags) {
      const owners = tagOwners.get(tag);
      if (owners) owners.push(id);
      else tagOwners.set(tag, [id]);
    }
  }
  const tags = new Set(tagOwners.keys());

  const pick = (type: PlanItemType, offset: number): PlanItem => {
    const pool = matchingContent(type, tags);
    // pool is never empty: matchingContent falls back to a non-empty set.
    const content = pool[(day + offset) % pool.length];
    return toPlanItem(content, selected, tagOwners);
  };

  const diet = pick('diet', 0);
  const exercise = pick('exercise', 1);
  const habit = pick('habit', 2);

  return {
    dayIndex: day,
    diet,
    exercise,
    habit,
    isBaseline: tags.size === 0,
  };
}

/** Whole days elapsed since `start`, in UTC. Day 0 is the start date. */
export function dayIndexSince(start: Date, now: Date = new Date()): number {
  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  if (!Number.isFinite(startUtc) || !Number.isFinite(nowUtc)) return 0;
  return Math.max(0, Math.floor((nowUtc - startUtc) / 86_400_000));
}

/** Stable day index for users with no active stake, so the plan still rotates. */
export function calendarDayIndex(now: Date = new Date()): number {
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      86_400_000,
  );
}

export type { PlanContent, PlanItemType };
