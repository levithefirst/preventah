import type { TieredAction } from './tiers';

/**
 * The rewrite layer's rules, kept pure so they can be tested without a
 * deployment or a key.
 *
 * What OpenAI is allowed to do here is narrow on purpose: it may reword a
 * title, the one-line how, and the three tier titles. It may not touch an
 * id, a type, a source, a how-to list, a safety note or a cost, because
 * those are the parts a reader might act on. Nothing it returns can
 * become the only copy of anything: if validation rejects the response,
 * the catalog plan renders unchanged.
 *
 * "Invent" is defined precisely rather than by vibes. A clinical term is
 * a violation only when it is absent from the catalog text the model was
 * rewriting, so keeping a word the catalog already used is fine and
 * introducing one is not.
 */

export const REWRITE_SOURCES = ['openai', 'catalog'] as const;
export type RewriteSource = (typeof REWRITE_SOURCES)[number];

export const MAX_TITLE = 160;
export const MAX_ONE_LINER = 300;

/** What the model is shown. Never the catalog, never a condition list. */
export interface RewritePayloadAction {
  id: string;
  type: string;
  title: string;
  how: string;
  sourceName: string;
  tiers: { tier: string; title: string }[];
}

export interface RewrittenAction {
  id: string;
  title: string;
  oneLiner: string;
  tiers: { tier: string; title: string }[];
}

/**
 * The prompt payload: three actions, one line of how each, and the source
 * names so the model knows the copy is sourced. Deliberately small; the
 * 117-entry catalog never leaves the deployment.
 */
export function buildPayload(actions: TieredAction[]): RewritePayloadAction[] {
  return actions.map((action) => ({
    id: action.id,
    type: action.type,
    title: action.title,
    how: action.howTo[0] ?? action.description,
    sourceName: action.sourceName,
    tiers: action.options.map((option) => ({ tier: option.tier, title: option.title })),
  }));
}

/**
 * Phrases that are never acceptable, whatever the catalog said. These are
 * diagnosis and prediction, which this product does not do anywhere.
 */
const ALWAYS_BANNED: RegExp[] = [
  /\byou (?:have|has|are diagnosed|suffer from)\b/i,
  /\byou(?:'| a)?re (?:at (?:high |increased |elevated )?risk|likely to develop)\b/i,
  /\byou will (?:develop|get|have)\b/i,
  /\bthis will (?:prevent|cure|treat|reverse)\b/i,
  /\b(?:cures?|cured|curing|treats?|treated|treating)\b/i,
  /\bdiagnos(?:e|ed|is|tic)\b/i,
];

/**
 * Clinical vocabulary. A match counts only when the same text is absent
 * from the catalog copy for that action, which is what makes it invented
 * rather than preserved.
 */
const CLINICAL: RegExp[] = [
  // Doses and units.
  /\b\d+\s*(?:mg|mcg|µg|g|ml|iu|units?)\b/i,
  /\b(?:dose|dosage|dosing|prescription|prescribe[ds]?|tablet|capsule|injection|infusion)\b/i,
  // Drug classes and common names.
  /\b(?:statin|metformin|insulin|aspirin|ibuprofen|paracetamol|acetaminophen|warfarin|beta[- ]?blocker|ace[- ]?inhibitor|antibiotic|steroid|chemotherapy)\w*\b/i,
  // Supplements framed as treatment.
  /\b(?:supplement|vitamin [a-k]\d?|omega[- ]?3|fish oil|probiotic|creatine|collagen)\b/i,
  // Labs, imaging and numeric targets.
  /\b(?:hba1c|a1c|ldl|hdl|triglyceride|biopsy|mri|ct scan|x[- ]?ray|blood test|lab (?:test|result)|panel)\b/i,
  /\b\d+\s*\/\s*\d+\s*(?:mmhg)?\b/i,
];

const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ');
}

export interface Violation {
  actionId: string;
  field: string;
  reason: string;
}

/**
 * Every catalog string the model saw or could faithfully echo, as one
 * normalised haystack per action.
 */
function corpusFor(action: TieredAction): string {
  return normalize(
    [
      action.title,
      action.description,
      action.why,
      action.benefit,
      action.target,
      action.safetyNote ?? '',
      ...action.howTo,
      ...action.options.map((option) => `${option.title} ${option.costHint}`),
    ].join(' '),
  );
}

function checkString(
  value: string,
  corpus: string,
  allowedUrls: Set<string>,
  actionId: string,
  field: string,
): Violation | null {
  for (const pattern of ALWAYS_BANNED) {
    if (pattern.test(value)) {
      return { actionId, field, reason: `diagnosis or prediction wording: ${pattern.source}` };
    }
  }

  const normalized = normalize(value);
  for (const pattern of CLINICAL) {
    const found = normalized.match(pattern);
    // Preserved from the catalog is fine. Introduced is not.
    if (found && !corpus.includes(normalize(found[0]))) {
      return { actionId, field, reason: `introduced clinical term: ${found[0]}` };
    }
  }

  for (const url of value.match(URL_LIKE) ?? []) {
    if (!allowedUrls.has(url.replace(/[.,;)]+$/, ''))) {
      return { actionId, field, reason: `introduced a URL: ${url}` };
    }
  }

  return null;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  actions: RewrittenAction[];
}

/**
 * Validates a parsed model response against the catalog plan it was asked
 * to rewrite. Total: any malformed input is a rejection, never a throw.
 */
export function validateRewrite(parsed: unknown, catalog: TieredAction[]): ValidationResult {
  const reject = (reason: string): ValidationResult => ({
    ok: false,
    violations: [{ actionId: '*', field: '*', reason }],
    actions: [],
  });

  const root = parsed as { actions?: unknown } | null;
  if (!root || typeof root !== 'object' || !Array.isArray(root.actions)) {
    return reject('response has no actions array');
  }
  if (root.actions.length !== catalog.length) {
    return reject(`expected ${catalog.length} actions, got ${root.actions.length}`);
  }

  const byId = new Map(catalog.map((action) => [action.id, action]));
  const allowedUrls = new Set(catalog.map((action) => action.sourceUrl));
  const violations: Violation[] = [];
  const actions: RewrittenAction[] = [];
  const seen = new Set<string>();

  for (const raw of root.actions) {
    const item = raw as {
      id?: unknown;
      title?: unknown;
      oneLiner?: unknown;
      tiers?: unknown;
    };

    if (typeof item.id !== 'string' || !byId.has(item.id)) {
      return reject(`unknown action id: ${String(item.id)}`);
    }
    if (seen.has(item.id)) return reject(`duplicate action id: ${item.id}`);
    seen.add(item.id);

    const source = byId.get(item.id) as TieredAction;
    const corpus = corpusFor(source);

    if (typeof item.title !== 'string' || item.title.trim().length === 0) {
      return reject(`action ${item.id} has no title`);
    }
    if (typeof item.oneLiner !== 'string' || item.oneLiner.trim().length === 0) {
      return reject(`action ${item.id} has no oneLiner`);
    }
    if (item.title.length > MAX_TITLE || item.oneLiner.length > MAX_ONE_LINER) {
      return reject(`action ${item.id} exceeds the length budget`);
    }
    if (!Array.isArray(item.tiers) || item.tiers.length !== source.options.length) {
      return reject(`action ${item.id} does not have ${source.options.length} tiers`);
    }

    const titleViolation = checkString(item.title, corpus, allowedUrls, item.id, 'title');
    if (titleViolation) violations.push(titleViolation);
    const oneLinerViolation = checkString(item.oneLiner, corpus, allowedUrls, item.id, 'oneLiner');
    if (oneLinerViolation) violations.push(oneLinerViolation);

    const tiers: { tier: string; title: string }[] = [];
    for (let i = 0; i < source.options.length; i += 1) {
      const option = source.options[i];
      const incoming = item.tiers[i] as { tier?: unknown; title?: unknown };
      // Tier order is fixed by the catalog, so a reordered response is a
      // rejection rather than something to sort out.
      if (incoming?.tier !== option.tier) {
        return reject(`action ${item.id} tier ${i} is not ${option.tier}`);
      }
      if (typeof incoming.title !== 'string' || incoming.title.trim().length === 0) {
        return reject(`action ${item.id} tier ${option.tier} has no title`);
      }
      if (incoming.title.length > MAX_TITLE) {
        return reject(`action ${item.id} tier ${option.tier} exceeds the length budget`);
      }
      const tierViolation = checkString(
        incoming.title,
        corpus,
        allowedUrls,
        item.id,
        `tier:${option.tier}`,
      );
      if (tierViolation) violations.push(tierViolation);
      tiers.push({ tier: option.tier, title: incoming.title.trim() });
    }

    actions.push({
      id: item.id,
      title: item.title.trim(),
      oneLiner: item.oneLiner.trim(),
      tiers,
    });
  }

  return { ok: violations.length === 0, violations, actions };
}

/**
 * Overlays validated rewrites onto the catalog plan.
 *
 * Only four strings per action move. Ids, types, how-to lists, safety
 * notes, costs, sources and tier identities are taken from the catalog
 * every time, so a rewrite cannot quietly drop a citation or a warning.
 */
export function applyRewrite(
  catalog: TieredAction[],
  rewritten: RewrittenAction[],
): TieredAction[] {
  const byId = new Map(rewritten.map((action) => [action.id, action]));
  return catalog.map((action) => {
    const replacement = byId.get(action.id);
    if (!replacement) return action;
    const tierTitles = new Map(replacement.tiers.map((tier) => [tier.tier, tier.title]));
    return {
      ...action,
      title: replacement.title,
      description: replacement.oneLiner,
      options: action.options.map((option) => ({
        ...option,
        title: tierTitles.get(option.tier) ?? option.title,
      })),
    };
  });
}
