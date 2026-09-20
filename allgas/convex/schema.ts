import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Preventah All Gas schema.
 *
 * The loop this backs: a household is created, each member consents, picks
 * the conditions that run in their family, and gets three actions a day at
 * three spend tiers. Checking one off writes a row that every other member
 * sees immediately, because the board is a live Convex query rather than a
 * poll.
 *
 * Two rules the tables encode:
 *  - Nothing personal is free text. `conditionIds` only ever holds catalog
 *    ids (convex/lib/conditions.ts sanitises every write), and check-ins
 *    reference plan item ids from the same curated content table.
 *  - Every outbound email is logged before it is sent, keyed by day, so a
 *    retried cron cannot mail the same person twice.
 */
export default defineSchema({
  households: defineTable({
    name: v.string(),
    /** Six characters, A-Z2-9. What a second member types to join. */
    joinCode: v.string(),
    createdAt: v.number(),
  }).index('by_join_code', ['joinCode']),

  members: defineTable({
    householdId: v.id('households'),
    name: v.string(),
    /** Null until the member accepts the consent copy. Gates everything. */
    consentedAt: v.union(v.number(), v.null()),
    /** Bumped when the consent copy changes, so it can be re-asked. */
    consentVersion: v.number(),
    /** Catalog ids only. Never free text. */
    conditionIds: v.array(v.string()),
    /** Where the morning plan goes. Optional: the loop works without it. */
    email: v.union(v.string(), v.null()),
    /** IANA name, used only to decide when "morning" is. */
    timezone: v.string(),
    /** Day the member joined, as a UTC day index. Anchors plan rotation. */
    startDayIndex: v.number(),
    createdAt: v.number(),
  })
    .index('by_household', ['householdId'])
    .index('by_email', ['email']),

  checkins: defineTable({
    memberId: v.id('members'),
    householdId: v.id('households'),
    /** UTC calendar day, YYYY-MM-DD. The unit the whole loop counts in. */
    dayKey: v.string(),
    /** Plan content id, e.g. "diet_vegetables". */
    actionId: v.string(),
    actionType: v.union(v.literal('diet'), v.literal('exercise'), v.literal('habit')),
    tier: v.union(v.literal('free'), v.literal('cheap'), v.literal('premium')),
    note: v.union(v.string(), v.null()),
    at: v.number(),
  })
    .index('by_member_day', ['memberId', 'dayKey'])
    .index('by_household_day', ['householdId', 'dayKey'])
    .index('by_member_action_day', ['memberId', 'dayKey', 'actionId']),

  /** Firecrawl results, cached per condition so the board renders instantly. */
  sourceCards: defineTable({
    conditionId: v.string(),
    title: v.string(),
    url: v.string(),
    snippet: v.string(),
    provider: v.string(),
    fetchedAt: v.number(),
  })
    .index('by_condition', ['conditionId'])
    .index('by_condition_url', ['conditionId', 'url']),

  /**
   * One row per member per day of rewritten wording.
   *
   * The row is claimed before the OpenAI call and patched after, so it is
   * both the cache and the spend guard: a row existing at all means today
   * is already paid for, whether the call succeeded or fell back.
   */
  dailyPlans: defineTable({
    memberId: v.id('members'),
    dayKey: v.string(),
    /** 'openai' when validated wording is stored, 'catalog' when it fell back. */
    rewrite: v.union(v.literal('openai'), v.literal('catalog')),
    /** The model id actually called, or null when none was. */
    model: v.union(v.string(), v.null()),
    /** Empty when rewrite is 'catalog'. Overlaid on the catalog plan when not. */
    actions: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        oneLiner: v.string(),
        tiers: v.array(v.object({ tier: v.string(), title: v.string() })),
      }),
    ),
    /** Why it fell back, for the dashboard. Never a key or a response body. */
    detail: v.union(v.string(), v.null()),
    updatedAt: v.number(),
  }).index('by_member_day', ['memberId', 'dayKey']),

  /** One row per intended send. Written before the API call, so it dedupes. */
  mailLog: defineTable({
    memberId: v.id('members'),
    kind: v.union(v.literal('morning'), v.literal('nudge')),
    dayKey: v.string(),
    status: v.union(v.literal('pending'), v.literal('sent'), v.literal('failed'), v.literal('skipped')),
    detail: v.union(v.string(), v.null()),
    at: v.number(),
  }).index('by_member_kind_day', ['memberId', 'kind', 'dayKey']),
});
