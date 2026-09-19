/**
 * Types and shared vocabulary for the family-health-condition catalog.
 *
 * Terminology note, which the UI must mirror: these are conditions where a
 * family history is *relevant*, not a list of simple inherited disorders.
 * Most are multifactorial. A family history raises the value of prevention
 * and of a conversation with a clinician; it does not mean anyone will
 * develop the condition.
 */

export const CONDITION_CATEGORIES = [
  'heart',
  'metabolic',
  'cancer',
  'neurological',
  'respiratory',
  'blood',
  'autoimmune',
  'bone',
  'digestive',
  'kidney',
  'vision',
  'mental',
  'other',
] as const;

export type ConditionCategory = (typeof CONDITION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ConditionCategory, string> = {
  heart: 'Heart & circulation',
  metabolic: 'Metabolic',
  cancer: 'Cancer',
  neurological: 'Neurological',
  respiratory: 'Respiratory',
  blood: 'Blood & genetic',
  autoimmune: 'Autoimmune',
  bone: 'Bone & connective tissue',
  digestive: 'Digestive',
  kidney: 'Kidney & urinary',
  vision: 'Eye & vision',
  mental: 'Mental & behavioural',
  other: 'Other',
};

/**
 * How strongly family history features in a condition's risk picture.
 * Used for wording, never for scoring or prediction.
 */
export type FamilyHistoryRelevance = 'strong' | 'moderate' | 'some';

/**
 * The bridge between conditions and prevention guidance.
 *
 * Conditions carry tags; plan items carry the same tags. That is what lets
 * a catalog of 100+ conditions share one curated body of guidance, instead
 * of needing bespoke content per condition. Keep this vocabulary small and
 * stable: every tag must be covered by real plan items.
 */
export const PLAN_TAGS = [
  'activity',
  'weight',
  'diet-quality',
  'diet-salt',
  'diet-sugar',
  'diet-fibre',
  'alcohol',
  'tobacco',
  'sleep',
  'stress',
  'bone-strength',
  'screening',
  'sun-safety',
  'breathing',
  'gut-health',
  'hydration',
  'eye-care',
  'mental-wellbeing',
] as const;

export type PlanTag = (typeof PLAN_TAGS)[number];

export interface ConditionEntry {
  /** Stable key. Persisted, so it must never change once shipped. */
  id: string;
  name: string;
  /** Alternative names and common spellings, for search. */
  aliases: string[];
  category: ConditionCategory;
  familyHistoryRelevance: FamilyHistoryRelevance;
  /** One neutral sentence. Never a diagnosis or a prediction. */
  description: string;
  /** What family history means here, and what it does not mean. */
  riskContext: string;
  planTags: PlanTag[];
  sourceName: string;
  sourceUrl: string;
}
