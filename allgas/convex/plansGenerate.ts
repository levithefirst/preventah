import { action, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { dayIndexOf, dayKeyOf } from './lib/day';
import { getDailyPlan } from './lib/plans';
import { withTiers } from './lib/tiers';
import type { RewrittenAction } from './lib/rewrite';
import { callOpenAI } from './lib/openai';

/**
 * The rewrite layer.
 *
 * One OpenAI call per member per calendar day, and the day's row is
 * claimed in a transaction before the call goes out, so a double-mounted
 * effect or an impatient button cannot spend twice. Everything the model
 * returns passes convex/lib/rewrite.ts before it is stored, and anything
 * that fails validation, or any failure at all, stores `catalog` and the
 * reason. There are no retries: a failed day is a catalog day.
 *
 * This is a wording layer and nothing more. The catalog and
 * sanitizeConditionIds remain the only path by which a condition is ever
 * associated with a member, and every action keeps its own source.
 */

const storedAction = v.object({
  id: v.string(),
  title: v.string(),
  oneLiner: v.string(),
  tiers: v.array(v.object({ tier: v.string(), title: v.string() })),
});

/** The day's row, or null when today has not been generated yet. */
export const rowFor = internalQuery({
  args: { memberId: v.id('members'), dayKey: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      rewrite: v.string(),
      model: v.union(v.string(), v.null()),
      detail: v.union(v.string(), v.null()),
      actions: v.array(storedAction),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('dailyPlans')
      .withIndex('by_member_day', (q) =>
        q.eq('memberId', args.memberId).eq('dayKey', args.dayKey),
      )
      .unique();
    if (!row) return null;
    return { rewrite: row.rewrite, model: row.model, detail: row.detail, actions: row.actions };
  },
});

/**
 * Claims the day. Returns null when a row already exists, which is what
 * makes the spend cap real rather than advisory: the caller that gets
 * null must not call OpenAI.
 */
export const claim = internalMutation({
  args: { memberId: v.id('members'), dayKey: v.string() },
  returns: v.union(v.id('dailyPlans'), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('dailyPlans')
      .withIndex('by_member_day', (q) =>
        q.eq('memberId', args.memberId).eq('dayKey', args.dayKey),
      )
      .unique();
    if (existing) return null;
    return await ctx.db.insert('dailyPlans', {
      memberId: args.memberId,
      dayKey: args.dayKey,
      rewrite: 'catalog',
      model: null,
      actions: [],
      detail: 'pending',
      updatedAt: Date.now(),
    });
  },
});

export const settle = internalMutation({
  args: {
    rowId: v.id('dailyPlans'),
    rewrite: v.union(v.literal('openai'), v.literal('catalog')),
    model: v.union(v.string(), v.null()),
    actions: v.array(storedAction),
    detail: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.rowId, {
      rewrite: args.rewrite,
      model: args.model,
      actions: args.actions,
      detail: args.detail,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const memberPlanInput = internalQuery({
  args: { memberId: v.id('members') },
  returns: v.union(
    v.null(),
    v.object({ conditionIds: v.array(v.string()), startDayIndex: v.number() }),
  ),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return null;
    return { conditionIds: member.conditionIds, startDayIndex: member.startDayIndex };
  },
});

/**
 * Generates today's wording, once.
 *
 * Idempotent and safe to call on every mount: a row for today short-
 * circuits before any network call, which is also what makes the
 * "Refresh wording" button free.
 */
export const generate = action({
  args: { memberId: v.id('members') },
  returns: v.object({
    rewrite: v.string(),
    model: v.union(v.string(), v.null()),
    detail: v.string(),
    spent: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ rewrite: string; model: string | null; detail: string; spent: boolean }> => {
    const dayKey = dayKeyOf();

    const existing = await ctx.runQuery(internal.plansGenerate.rowFor, {
      memberId: args.memberId,
      dayKey,
    });
    if (existing && existing.detail !== 'pending') {
      return {
        rewrite: existing.rewrite,
        model: existing.model,
        detail: 'already generated today',
        spent: false,
      };
    }

    const member = await ctx.runQuery(internal.plansGenerate.memberPlanInput, {
      memberId: args.memberId,
    });
    if (!member) {
      return { rewrite: 'catalog', model: null, detail: 'unknown member', spent: false };
    }

    const rowId: Id<'dailyPlans'> | null = await ctx.runMutation(internal.plansGenerate.claim, {
      memberId: args.memberId,
      dayKey,
    });
    if (rowId === null) {
      // Another caller claimed it between the read and here.
      return { rewrite: 'catalog', model: null, detail: 'already claimed today', spent: false };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.plansGenerate.settle, {
        rowId,
        rewrite: 'catalog',
        model: null,
        actions: [],
        detail: 'OPENAI_API_KEY is not set on this deployment',
      });
      return {
        rewrite: 'catalog',
        model: null,
        detail: 'OPENAI_API_KEY is not set on this deployment',
        spent: false,
      };
    }

    const plan = getDailyPlan(member.conditionIds, dayIndexOf() - member.startDayIndex);
    const catalog = [plan.diet, plan.exercise, plan.habit].map(withTiers);

    const outcome = await callOpenAI(apiKey, catalog);
    const ok = outcome.actions !== null;

    await ctx.runMutation(internal.plansGenerate.settle, {
      rowId,
      rewrite: ok ? 'openai' : 'catalog',
      model: outcome.model,
      actions: ok ? (outcome.actions as RewrittenAction[]) : [],
      detail: outcome.detail,
    });

    return {
      rewrite: ok ? 'openai' : 'catalog',
      model: outcome.model,
      detail: outcome.detail,
      spent: true,
    };
  },
});
