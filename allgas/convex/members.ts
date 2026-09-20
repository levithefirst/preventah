import { mutation, query, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { sanitizeConditionIds, MAX_SELECTIONS } from './lib/conditions';
import { getDailyPlan } from './lib/plans';
import { withTiers } from './lib/tiers';
import { dayIndexOf, dayKeyOf, isValidTimezone } from './lib/day';
import { conditionName, getCondition } from './lib/conditionIndex';
import { applyRewrite } from './lib/rewrite';

/**
 * A member's own state: consent, selections, and what today asks of them.
 *
 * The consent gate is real. `conditionIds` stays empty and `today` returns
 * `needsConsent` until the member accepts, because a list of conditions
 * that run in someone's family is the most sensitive thing this app holds
 * and it should not be collected before anyone has said yes.
 */

const CONSENT_VERSION = 1;

export const CONSENT_COPY = [
  'Preventah stores the conditions you pick so it can show you general prevention guidance.',
  'Everyone in your household can see that you checked in, and how many conditions you track. They cannot see which ones.',
  'This is general lifestyle guidance from public-health sources. It is not medical advice, not a diagnosis, and not a prediction.',
  'A family history raises the value of prevention and of a conversation with a clinician. It does not mean anyone will develop a condition.',
];

export const consentCopy = query({
  args: {},
  returns: v.object({ version: v.number(), lines: v.array(v.string()) }),
  handler: async () => ({ version: CONSENT_VERSION, lines: CONSENT_COPY }),
});

export const consent = mutation({
  args: { memberId: v.id('members'), accepted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return null;
    await ctx.db.patch(args.memberId, {
      consentedAt: args.accepted ? Date.now() : null,
      consentVersion: CONSENT_VERSION,
      // Withdrawing consent drops the selections too, rather than keeping
      // them warm for a re-accept. That is the point of withdrawing.
      conditionIds: args.accepted ? member.conditionIds : [],
    });
    return null;
  },
});

export const setConditions = mutation({
  args: { memberId: v.id('members'), conditionIds: v.array(v.string()) },
  returns: v.object({ accepted: v.array(v.string()), dropped: v.number() }),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return { accepted: [], dropped: 0 };
    if (member.consentedAt === null) return { accepted: [], dropped: args.conditionIds.length };

    // The trust boundary. Anything not a catalog id is dropped here, so a
    // stale or hostile client cannot write free text into the table.
    const accepted = sanitizeConditionIds(args.conditionIds);
    await ctx.db.patch(args.memberId, { conditionIds: accepted });
    return { accepted, dropped: args.conditionIds.length - accepted.length };
  },
});

export const setProfile = mutation({
  args: {
    memberId: v.id('members'),
    email: v.union(v.string(), v.null()),
    timezone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return null;

    const email = args.email?.trim() ?? null;
    const patch: { email: string | null; timezone?: string } = {
      // Shape check only. The real proof an address works is a delivered mail.
      email: email && /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) ? email : null,
    };
    if (args.timezone && isValidTimezone(args.timezone)) patch.timezone = args.timezone;

    await ctx.db.patch(args.memberId, patch);
    return null;
  },
});

const tierOption = v.object({
  tier: v.string(),
  label: v.string(),
  title: v.string(),
  costHint: v.string(),
});

const action = v.object({
  id: v.string(),
  type: v.string(),
  title: v.string(),
  description: v.string(),
  why: v.string(),
  howTo: v.array(v.string()),
  benefit: v.string(),
  target: v.string(),
  safetyNote: v.union(v.string(), v.null()),
  relatedConditions: v.array(v.string()),
  matchedTags: v.array(v.string()),
  sourceName: v.string(),
  sourceUrl: v.string(),
  options: v.array(tierOption),
  doneTier: v.union(v.string(), v.null()),
});

/**
 * Everything one screen needs: who you are, today's three actions with
 * their spend tiers, and which you have already done.
 *
 * The plan itself is resolved synchronously from curated content. No LLM
 * call sits between opening the app and seeing what to do today, which is
 * why this is a query and not an action.
 *
 * Rewritten wording, when today's row has any, is overlaid on top of that
 * catalog plan rather than replacing it. The read path therefore never
 * depends on OpenAI having succeeded, or on it having been called at all:
 * `rewrite: null` simply means today has not been generated yet.
 */
export const today = query({
  args: { memberId: v.id('members') },
  returns: v.union(
    v.null(),
    v.object({
      memberId: v.id('members'),
      householdId: v.id('households'),
      name: v.string(),
      needsConsent: v.boolean(),
      consentVersion: v.number(),
      email: v.union(v.string(), v.null()),
      timezone: v.string(),
      dayKey: v.string(),
      maxSelections: v.number(),
      conditions: v.array(v.object({ id: v.string(), name: v.string(), category: v.string() })),
      isBaseline: v.boolean(),
      actions: v.array(action),
      doneCount: v.number(),
      /** null until today's row exists. Non-null means never call again. */
      rewrite: v.union(v.string(), v.null()),
      model: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return null;

    const dayKey = dayKeyOf();
    const done = await ctx.db
      .query('checkins')
      .withIndex('by_member_day', (q) => q.eq('memberId', args.memberId).eq('dayKey', dayKey))
      .collect();
    const doneByAction = new Map(done.map((row) => [row.actionId, row.tier]));

    const dayIndex = dayIndexOf() - member.startDayIndex;
    const plan = getDailyPlan(member.conditionIds, dayIndex);

    const row = await ctx.db
      .query('dailyPlans')
      .withIndex('by_member_day', (q) => q.eq('memberId', args.memberId).eq('dayKey', dayKey))
      .unique();

    const catalog = [plan.diet, plan.exercise, plan.habit].map(withTiers);
    const resolved =
      row && row.rewrite === 'openai' && row.actions.length > 0
        ? applyRewrite(catalog, row.actions)
        : catalog;

    const actions = resolved.map((item) => ({
      ...item,
      doneTier: doneByAction.get(item.id) ?? null,
    }));

    return {
      memberId: member._id,
      householdId: member.householdId,
      name: member.name,
      needsConsent: member.consentedAt === null || member.consentVersion !== CONSENT_VERSION,
      consentVersion: CONSENT_VERSION,
      email: member.email,
      timezone: member.timezone,
      dayKey,
      maxSelections: MAX_SELECTIONS,
      conditions: member.conditionIds.map((id) => ({
        id,
        name: conditionName(id),
        category: getCondition(id)?.category ?? 'other',
      })),
      isBaseline: plan.isBaseline,
      actions,
      doneCount: done.length,
      rewrite: row ? row.rewrite : null,
      model: row ? row.model : null,
    };
  },
});

/** Used by the crons, which need members without going through the client. */
export const listForMail = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      memberId: v.id('members'),
      householdId: v.id('households'),
      name: v.string(),
      email: v.string(),
      timezone: v.string(),
      conditionIds: v.array(v.string()),
      startDayIndex: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const members = await ctx.db.query('members').collect();
    return members
      .filter((member) => member.consentedAt !== null && member.email !== null)
      .map((member) => ({
        memberId: member._id,
        householdId: member.householdId,
        name: member.name,
        email: member.email as string,
        timezone: member.timezone,
        conditionIds: member.conditionIds,
        startDayIndex: member.startDayIndex,
      }));
  },
});
