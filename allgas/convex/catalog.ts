import { query } from './_generated/server';
import { v } from 'convex/values';
import { searchConditions, CATEGORY_SUMMARIES, CONDITION_COUNT } from './lib/conditionIndex';

/**
 * The condition picker's data.
 *
 * Served from the curated catalog bundled with the deployment, not from a
 * table, because it is fixed content rather than user data: there is
 * nothing to migrate and no write path. Search is a synchronous scan over
 * a precomputed index, so a keystroke costs a function call and no reads.
 */

const conditionSummary = v.object({
  id: v.string(),
  name: v.string(),
  category: v.string(),
  categoryLabel: v.string(),
  familyHistoryRelevance: v.string(),
  description: v.string(),
  riskContext: v.string(),
  sourceName: v.string(),
  sourceUrl: v.string(),
});

export const search = query({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    total: v.number(),
    categories: v.array(v.object({ category: v.string(), label: v.string(), count: v.number() })),
    results: v.array(conditionSummary),
  }),
  handler: async (_ctx, args) => {
    const labels = new Map(CATEGORY_SUMMARIES.map((s) => [s.category as string, s.label]));
    const category = args.category && labels.has(args.category) ? (args.category as never) : null;

    const results = searchConditions(args.q ?? '', {
      category,
      limit: Math.min(Math.max(args.limit ?? 40, 1), 200),
    });

    return {
      total: CONDITION_COUNT,
      categories: CATEGORY_SUMMARIES.map((s) => ({
        category: s.category,
        label: s.label,
        count: s.count,
      })),
      results: results.map((entry) => ({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        categoryLabel: labels.get(entry.category) ?? entry.category,
        familyHistoryRelevance: entry.familyHistoryRelevance,
        description: entry.description,
        riskContext: entry.riskContext,
        sourceName: entry.sourceName,
        sourceUrl: entry.sourceUrl,
      })),
    };
  },
});
