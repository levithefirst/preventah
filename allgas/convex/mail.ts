import { action, internalAction, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { getDailyPlan } from './lib/plans';
import { withTiers } from './lib/tiers';
import { dayIndexOf, dayKeyOf, localHour, previousDayKey } from './lib/day';

/**
 * Outbound mail, through AgentMail.
 *
 * Two sends, both driven by crons. The morning plan is what the day asks
 * of you, written out so the app does not have to be opened to know it.
 * The nudge is the follow-up when yesterday went by without a check-in,
 * and it is deliberately the gentler of the two: a prevention habit that
 * shames people is a prevention habit they delete.
 *
 * Every send claims a mailLog row first. The row is the idempotency key,
 * so a cron that retries after a partial failure cannot mail twice.
 */

const AGENTMAIL_BASE = 'https://api.agentmail.to/v0';

interface Sendable {
  to: string;
  subject: string;
  text: string;
}

async function resolveInbox(apiKey: string): Promise<string | null> {
  const configured = process.env.AGENTMAIL_INBOX_ID;
  if (configured) return configured;
  try {
    const response = await fetch(`${AGENTMAIL_BASE}/inboxes`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { inboxes?: { inbox_id?: string }[] };
    return payload.inboxes?.[0]?.inbox_id ?? null;
  } catch {
    return null;
  }
}

async function send(message: Sendable): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  if (!apiKey) return { ok: false, detail: 'AGENTMAIL_API_KEY is not set on this deployment.' };

  const inboxId = await resolveInbox(apiKey);
  if (!inboxId) {
    return { ok: false, detail: 'No AgentMail inbox available. Set AGENTMAIL_INBOX_ID.' };
  }

  try {
    const response = await fetch(
      `${AGENTMAIL_BASE}/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: message.to, subject: message.subject, text: message.text }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, detail: `AgentMail returned ${response.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true, detail: 'sent' };
  } catch (error) {
    return { ok: false, detail: `AgentMail call failed: ${String(error)}` };
  }
}

/**
 * Claims the right to send. Returns false when this member already has a
 * row for this kind and day, which is what makes a retry safe.
 */
export const claim = internalMutation({
  args: {
    memberId: v.id('members'),
    kind: v.union(v.literal('morning'), v.literal('nudge')),
    dayKey: v.string(),
  },
  returns: v.union(v.id('mailLog'), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('mailLog')
      .withIndex('by_member_kind_day', (q) =>
        q.eq('memberId', args.memberId).eq('kind', args.kind).eq('dayKey', args.dayKey),
      )
      .unique();
    if (existing) return null;
    return await ctx.db.insert('mailLog', {
      memberId: args.memberId,
      kind: args.kind,
      dayKey: args.dayKey,
      status: 'pending',
      detail: null,
      at: Date.now(),
    });
  },
});

export const settle = internalMutation({
  args: {
    logId: v.id('mailLog'),
    status: v.union(v.literal('sent'), v.literal('failed'), v.literal('skipped')),
    detail: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, { status: args.status, detail: args.detail, at: Date.now() });
    return null;
  },
});

export const recent = internalQuery({
  args: {},
  returns: v.array(
    v.object({ kind: v.string(), dayKey: v.string(), status: v.string(), at: v.number() }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query('mailLog').order('desc').take(20);
    return rows.map((row) => ({
      kind: row.kind,
      dayKey: row.dayKey,
      status: row.status,
      at: row.at,
    }));
  },
});

function morningBody(name: string, conditionIds: string[], dayIndex: number): Sendable['text'] {
  const plan = getDailyPlan(conditionIds, dayIndex);
  const actions = [plan.diet, plan.exercise, plan.habit].map(withTiers);

  const lines: string[] = [
    `Morning ${name}.`,
    '',
    'Three things today. Each one has a free option that is a real option.',
    '',
  ];

  for (const item of actions) {
    lines.push(`${item.type.toUpperCase()}: ${item.title}`);
    for (const option of item.options) {
      lines.push(`  - ${option.label} (${option.costHint}): ${option.title}`);
    }
    if (item.relatedConditions.length > 0) {
      lines.push(`  Connects to: ${item.relatedConditions.join(', ')}`);
    }
    lines.push(`  Source: ${item.sourceName} - ${item.sourceUrl}`);
    lines.push('');
  }

  if (plan.isBaseline) {
    lines.push('This is the general plan. Pick the conditions that run in your family to tune it.');
    lines.push('');
  }

  lines.push('Check one off and your household sees it straight away.');
  lines.push('');
  lines.push('General lifestyle guidance from public-health sources. Not medical advice.');
  return lines.join('\n');
}

/** One member's morning plan. Split out so it can be fired by hand in a demo. */
export const sendMorning = internalAction({
  args: {
    memberId: v.id('members'),
    name: v.string(),
    email: v.string(),
    conditionIds: v.array(v.string()),
    startDayIndex: v.number(),
    dayKey: v.string(),
  },
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; detail: string }> => {
    const logId: Id<'mailLog'> | null = await ctx.runMutation(internal.mail.claim, {
      memberId: args.memberId,
      kind: 'morning',
      dayKey: args.dayKey,
    });
    if (logId === null) return { ok: true, detail: 'Already sent today.' };

    const result = await send({
      to: args.email,
      subject: `Today's three: ${args.dayKey}`,
      text: morningBody(args.name, args.conditionIds, dayIndexOf() - args.startDayIndex),
    });

    await ctx.runMutation(internal.mail.settle, {
      logId,
      status: result.ok ? 'sent' : 'failed',
      detail: result.detail,
    });
    return result;
  },
});

export const sendNudge = internalAction({
  args: {
    memberId: v.id('members'),
    name: v.string(),
    email: v.string(),
    missedDayKey: v.string(),
    dayKey: v.string(),
  },
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; detail: string }> => {
    const logId: Id<'mailLog'> | null = await ctx.runMutation(internal.mail.claim, {
      memberId: args.memberId,
      kind: 'nudge',
      dayKey: args.dayKey,
    });
    if (logId === null) return { ok: true, detail: 'Already nudged today.' };

    const text = [
      `${args.name}, yesterday went by without a check-in.`,
      '',
      'That is genuinely fine. The point of this is the next day, not the last one.',
      'Today has three fresh actions waiting, and the free one is always a real option.',
      '',
      'Open the app and check one off. Your household will see it.',
    ].join('\n');

    const result = await send({
      to: args.email,
      subject: 'No check-in yesterday. Today is open.',
      text,
    });

    await ctx.runMutation(internal.mail.settle, {
      logId,
      status: result.ok ? 'sent' : 'failed',
      detail: result.detail,
    });
    return result;
  },
});

/**
 * Cron body for the morning plan.
 *
 * Runs hourly and mails only the members whose local clock has just
 * reached 07:00. That is how one deployment serves several timezones
 * without a per-member scheduled job.
 */
export const morningSweep = internalAction({
  args: {},
  returns: v.object({ considered: v.number(), sent: v.number() }),
  handler: async (ctx): Promise<{ considered: number; sent: number }> => {
    const members = await ctx.runQuery(internal.members.listForMail, {});
    const dayKey = dayKeyOf();
    let sent = 0;

    for (const member of members) {
      if (localHour(member.timezone) !== 7) continue;
      const result = await ctx.runAction(internal.mail.sendMorning, {
        memberId: member.memberId,
        name: member.name,
        email: member.email,
        conditionIds: member.conditionIds,
        startDayIndex: member.startDayIndex,
        dayKey,
      });
      if (result.ok) sent += 1;
    }

    return { considered: members.length, sent };
  },
});

/** Cron body for the nudge. Fires at 19:00 local, about yesterday. */
export const nudgeSweep = internalAction({
  args: {},
  returns: v.object({ considered: v.number(), sent: v.number() }),
  handler: async (ctx): Promise<{ considered: number; sent: number }> => {
    const members = await ctx.runQuery(internal.members.listForMail, {});
    const dayKey = dayKeyOf();
    const missedDayKey = previousDayKey(dayKey);
    let sent = 0;

    for (const member of members) {
      if (localHour(member.timezone) !== 19) continue;
      const missed = await ctx.runQuery(internal.checkins.missedOn, {
        memberId: member.memberId,
        dayKey: missedDayKey,
      });
      if (!missed) continue;
      const result = await ctx.runAction(internal.mail.sendNudge, {
        memberId: member.memberId,
        name: member.name,
        email: member.email,
        missedDayKey,
        dayKey,
      });
      if (result.ok) sent += 1;
    }

    return { considered: members.length, sent };
  },
});

/**
 * Demo hook: send this member their morning plan now, ignoring the clock.
 * Public because a judge watching a demo should not have to wait for 07:00.
 */
export const sendMorningNow = action({
  args: { memberId: v.id('members') },
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; detail: string }> => {
    const members = await ctx.runQuery(internal.members.listForMail, {});
    const member = members.find((candidate) => candidate.memberId === args.memberId);
    if (!member) {
      return { ok: false, detail: 'Add an email address first, then try again.' };
    }
    // A manual send uses a distinct day key so it never consumes the
    // real morning claim, and can be pressed twice in a demo.
    return await ctx.runAction(internal.mail.sendMorning, {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      conditionIds: member.conditionIds,
      startDayIndex: member.startDayIndex,
      dayKey: `${dayKeyOf()}-manual-${Date.now()}`,
    });
  },
});
