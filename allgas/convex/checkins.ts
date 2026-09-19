import { mutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { dayIndexOf, dayKeyOf } from './lib/day';
import { getDailyPlan } from './lib/plans';
import { isTier } from './lib/tiers';

/**
 * Check-in: the one write the whole product exists to collect.
 *
 * Two things are enforced here rather than trusted from the client. The
 * action id must be one of the three the member was actually offered
 * today, recomputed server-side from the same pure plan function, and one
 * action can only be checked off once a day. Both matter because the
 * household board is a shared scoreboard, and a scoreboard that can be
 * written to freely is not worth watching.
 */

export const check = mutation({
  args: {
    memberId: v.id('members'),
    actionId: v.string(),
    tier: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ ok: v.literal(true), dayKey: v.string(), doneCount: v.number() }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return { ok: false as const, reason: 'Unknown member.' };
    if (member.consentedAt === null) {
      return { ok: false as const, reason: 'Consent is needed before checking in.' };
    }
    if (!isTier(args.tier)) {
      return { ok: false as const, reason: 'Unknown tier.' };
    }

    const dayKey = dayKeyOf();

    // Recompute today's offer rather than believing the client's action id.
    const plan = getDailyPlan(member.conditionIds, dayIndexOf() - member.startDayIndex);
    const offered = [plan.diet, plan.exercise, plan.habit];
    const item = offered.find((candidate) => candidate.id === args.actionId);
    if (!item) {
      return { ok: false as const, reason: 'That action is not on today’s plan.' };
    }

    const existing = await ctx.db
      .query('checkins')
      .withIndex('by_member_action_day', (q) =>
        q.eq('memberId', args.memberId).eq('dayKey', dayKey).eq('actionId', args.actionId),
      )
      .unique();

    if (existing) {
      // Re-checking the same action swaps the tier instead of double-counting.
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        note: args.note?.trim().slice(0, 200) || null,
        at: Date.now(),
      });
    } else {
      await ctx.db.insert('checkins', {
        memberId: args.memberId,
        householdId: member.householdId,
        dayKey,
        actionId: item.id,
        actionType: item.type,
        tier: args.tier,
        note: args.note?.trim().slice(0, 200) || null,
        at: Date.now(),
      });
    }

    const doneCount = (
      await ctx.db
        .query('checkins')
        .withIndex('by_member_day', (q) => q.eq('memberId', args.memberId).eq('dayKey', dayKey))
        .collect()
    ).length;

    return { ok: true as const, dayKey, doneCount };
  },
});

export const undo = mutation({
  args: { memberId: v.id('members'), actionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dayKey = dayKeyOf();
    const existing = await ctx.db
      .query('checkins')
      .withIndex('by_member_action_day', (q) =>
        q.eq('memberId', args.memberId).eq('dayKey', dayKey).eq('actionId', args.actionId),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Who has not checked in yet on a given day. Drives the nudge cron. */
export const missedOn = internalQuery({
  args: { memberId: v.id('members'), dayKey: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('checkins')
      .withIndex('by_member_day', (q) => q.eq('memberId', args.memberId).eq('dayKey', args.dayKey))
      .take(1);
    return rows.length === 0;
  },
});
