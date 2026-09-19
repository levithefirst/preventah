import { mutation, query, type QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { makeJoinCode, normalizeJoinCode } from './lib/joincode';
import { dayIndexOf, dayKeyOf, previousDayKey } from './lib/day';

/**
 * Households: the unit the whole product works in.
 *
 * Family history is a household fact, so prevention is treated as a
 * household activity. There is no login: a household has a six-character
 * join code, and a member id lives in the browser. That is the right
 * trade for a kitchen-table app and it keeps the demo honest, but it is
 * not an access control boundary and the UI says so.
 */

const CONSENT_VERSION = 1;

export const create = mutation({
  args: { householdName: v.string(), memberName: v.string() },
  returns: v.object({
    householdId: v.id('households'),
    memberId: v.id('members'),
    joinCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const householdName = args.householdName.trim().slice(0, 60) || 'Our household';
    const memberName = args.memberName.trim().slice(0, 40) || 'Me';
    const now = Date.now();

    // Retry on collision rather than trusting 32^6 blindly.
    let joinCode = makeJoinCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await ctx.db
        .query('households')
        .withIndex('by_join_code', (q) => q.eq('joinCode', joinCode))
        .unique();
      if (!clash) break;
      joinCode = makeJoinCode();
    }

    const householdId = await ctx.db.insert('households', {
      name: householdName,
      joinCode,
      createdAt: now,
    });

    const memberId = await ctx.db.insert('members', {
      householdId,
      name: memberName,
      consentedAt: null,
      consentVersion: CONSENT_VERSION,
      conditionIds: [],
      email: null,
      timezone: 'UTC',
      startDayIndex: dayIndexOf(now),
      createdAt: now,
    });

    return { householdId, memberId, joinCode };
  },
});

export const join = mutation({
  args: { joinCode: v.string(), memberName: v.string() },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      householdId: v.id('households'),
      memberId: v.id('members'),
      householdName: v.string(),
    }),
    v.object({ ok: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const joinCode = normalizeJoinCode(args.joinCode);
    if (joinCode.length !== 6) {
      return { ok: false as const, reason: 'A join code is six characters.' };
    }

    const household = await ctx.db
      .query('households')
      .withIndex('by_join_code', (q) => q.eq('joinCode', joinCode))
      .unique();
    if (!household) {
      return { ok: false as const, reason: 'No household with that code.' };
    }

    const now = Date.now();
    const memberId = await ctx.db.insert('members', {
      householdId: household._id,
      name: args.memberName.trim().slice(0, 40) || 'Me',
      consentedAt: null,
      consentVersion: CONSENT_VERSION,
      conditionIds: [],
      email: null,
      timezone: 'UTC',
      startDayIndex: dayIndexOf(now),
      createdAt: now,
    });

    return {
      ok: true as const,
      householdId: household._id,
      memberId,
      householdName: household.name,
    };
  },
});

const boardMember = v.object({
  memberId: v.id('members'),
  name: v.string(),
  consented: v.boolean(),
  conditionCount: v.number(),
  doneToday: v.number(),
  tiersToday: v.array(v.string()),
  lastCheckinAt: v.union(v.number(), v.null()),
  streak: v.number(),
});

/**
 * The live household board.
 *
 * Subscribed with useQuery, so a check-in on one phone lands on every
 * other phone in the household without a refresh. That reactivity is the
 * whole reason the board is worth having, and it is one query.
 */
export const board = query({
  args: { householdId: v.id('households') },
  returns: v.union(
    v.null(),
    v.object({
      householdName: v.string(),
      joinCode: v.string(),
      dayKey: v.string(),
      members: v.array(boardMember),
      totalDoneToday: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const household = await ctx.db.get(args.householdId);
    if (!household) return null;

    const dayKey = dayKeyOf();
    const members = await ctx.db
      .query('members')
      .withIndex('by_household', (q) => q.eq('householdId', args.householdId))
      .collect();

    const today = await ctx.db
      .query('checkins')
      .withIndex('by_household_day', (q) =>
        q.eq('householdId', args.householdId).eq('dayKey', dayKey),
      )
      .collect();

    const rows = members.map((member) => {
      const mine = today.filter((row) => row.memberId === member._id);
      return {
        memberId: member._id,
        name: member.name,
        consented: member.consentedAt !== null,
        conditionCount: member.conditionIds.length,
        doneToday: mine.length,
        tiersToday: mine.map((row) => row.tier),
        lastCheckinAt: mine.length > 0 ? Math.max(...mine.map((row) => row.at)) : null,
        streak: 0,
      };
    });

    // Streaks need history, so they are counted per member off the
    // member/day index rather than scanning the household.
    for (const row of rows) {
      row.streak = await streakFor(ctx, row.memberId, dayKey);
    }

    return {
      householdName: household.name,
      joinCode: household.joinCode,
      dayKey,
      members: rows,
      totalDoneToday: today.length,
    };
  },
});

/**
 * Consecutive days ending today (or yesterday) with at least one check-in.
 * Capped at 30 days of lookback: a streak is motivation, not an audit.
 */
async function streakFor(
  ctx: QueryCtx,
  memberId: Id<'members'>,
  todayKey: string,
): Promise<number> {
  let cursor = todayKey;
  let streak = 0;
  for (let i = 0; i < 30; i += 1) {
    const rows = await ctx.db
      .query('checkins')
      .withIndex('by_member_day', (q) => q.eq('memberId', memberId).eq('dayKey', cursor))
      .take(1);
    if (rows.length === 0) {
      // Today being empty does not break a streak that ran to yesterday.
      if (i === 0) {
        cursor = previousDayKey(cursor);
        continue;
      }
      break;
    }
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}
