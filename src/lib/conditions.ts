/**
 * The fixed hereditary risk checklist.
 *
 * This list is the ONLY way a user can describe their family history.
 * There is no free-text input anywhere in the app, by design: it keeps the
 * stored data to a small, known, non-identifying set and keeps the app well
 * clear of collecting clinical detail it has no business holding.
 */

export const CONDITION_KEYS = [
  'cardiovascular',
  'type2_diabetes',
  'cancer_family_history',
  'hypertension',
  'metabolic_syndrome',
  'osteoporosis',
] as const;

export type ConditionKey = (typeof CONDITION_KEYS)[number];

export interface ConditionCategory {
  key: ConditionKey;
  label: string;
  /** Shown under the label so the user knows exactly what they are selecting. */
  description: string;
}

export const CONDITIONS: readonly ConditionCategory[] = [
  {
    key: 'cardiovascular',
    label: 'Cardiovascular disease',
    description:
      'Heart disease or stroke in a parent, sibling or grandparent.',
  },
  {
    key: 'type2_diabetes',
    label: 'Type 2 diabetes',
    description: 'Type 2 diabetes in a close blood relative.',
  },
  {
    key: 'cancer_family_history',
    label: 'Cancer (family history)',
    description:
      'A family history flag only. Preventah never asks which cancer, which relative, or any clinical detail.',
  },
  {
    key: 'hypertension',
    label: 'High blood pressure',
    description: 'Hypertension in a close blood relative.',
  },
  {
    key: 'metabolic_syndrome',
    label: 'Obesity / metabolic syndrome',
    description:
      'A family pattern of obesity, high cholesterol or metabolic syndrome.',
  },
  {
    key: 'osteoporosis',
    label: 'Osteoporosis',
    description: 'Osteoporosis or low-trauma fractures in a close relative.',
  },
];

const KEY_SET: ReadonlySet<string> = new Set(CONDITION_KEYS);

/** Type guard used at every trust boundary before a key touches the database. */
export function isConditionKey(value: unknown): value is ConditionKey {
  return typeof value === 'string' && KEY_SET.has(value);
}

/**
 * Filters arbitrary input down to valid, unique keys in canonical order.
 * Anything unrecognised is dropped rather than raising, so a stale client
 * can never wedge the flow.
 */
export function sanitizeConditionKeys(input: unknown): ConditionKey[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<ConditionKey>();
  for (const item of input) {
    if (isConditionKey(item)) seen.add(item);
  }
  return CONDITION_KEYS.filter((key) => seen.has(key));
}

export function labelFor(key: ConditionKey): string {
  return CONDITIONS.find((c) => c.key === key)?.label ?? key;
}
