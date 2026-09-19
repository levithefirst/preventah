import { action, internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { getCondition, conditionName } from './lib/condition-index';

/**
 * Firecrawl source cards.
 *
 * A condition page in this app says "here is what a family history means,
 * and here is where to read more". The catalog ships one authoritative
 * link per condition; Firecrawl finds current public-health pages beyond
 * that, and the results are cached in a table so the UI reads them from a
 * live query instead of waiting on an HTTP call.
 *
 * Fetching is an action, because it touches the network. Writing is an
 * internal mutation, so the cache can only be filled by a fetch that
 * actually happened.
 */

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/search';

/** Public-health domains only. A prevention app should not cite a forum. */
const ALLOWED_HOSTS = [
  'who.int',
  'nhs.uk',
  'cdc.gov',
  'medlineplus.gov',
  'nih.gov',
  'nci.nih.gov',
  'cancer.gov',
  'heart.org',
  'diabetes.org',
  'nhlbi.nih.gov',
  'niddk.nih.gov',
  'mayoclinic.org',
];

function hostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

const card = v.object({
  conditionId: v.string(),
  title: v.string(),
  url: v.string(),
  snippet: v.string(),
  provider: v.string(),
  fetchedAt: v.number(),
});

/** What the UI subscribes to. Returns whatever is cached, instantly. */
export const forCondition = query({
  args: { conditionId: v.string() },
  returns: v.array(card),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sourceCards')
      .withIndex('by_condition', (q) => q.eq('conditionId', args.conditionId))
      .collect();
    return rows.map((row) => ({
      conditionId: row.conditionId,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      provider: row.provider,
      fetchedAt: row.fetchedAt,
    }));
  },
});

export const cachedAt = internalQuery({
  args: { conditionId: v.string() },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sourceCards')
      .withIndex('by_condition', (q) => q.eq('conditionId', args.conditionId))
      .take(1);
    return rows.length > 0 ? rows[0].fetchedAt : null;
  },
});

export const store = internalMutation({
  args: {
    conditionId: v.string(),
    cards: v.array(
      v.object({ title: v.string(), url: v.string(), snippet: v.string() }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let written = 0;
    for (const incoming of args.cards) {
      const existing = await ctx.db
        .query('sourceCards')
        .withIndex('by_condition_url', (q) =>
          q.eq('conditionId', args.conditionId).eq('url', incoming.url),
        )
        .unique();
      const row = {
        conditionId: args.conditionId,
        title: incoming.title.slice(0, 200),
        url: incoming.url,
        snippet: incoming.snippet.slice(0, 400),
        provider: 'firecrawl',
        fetchedAt: Date.now(),
      };
      if (existing) await ctx.db.patch(existing._id, row);
      else await ctx.db.insert('sourceCards', row);
      written += 1;
    }
    return written;
  },
});

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetches and caches source cards for a condition.
 *
 * Degrades rather than throws: no key, a refused call or a bad payload all
 * leave the cached cards in place and report why. A prevention app must
 * still render when a third party is down.
 */
export const refresh = action({
  args: { conditionId: v.string(), force: v.optional(v.boolean()) },
  returns: v.object({ ok: v.boolean(), written: v.number(), detail: v.string() }),
  handler: async (ctx, args): Promise<{ ok: boolean; written: number; detail: string }> => {
    const entry = getCondition(args.conditionId);
    if (!entry) return { ok: false, written: 0, detail: 'Unknown condition.' };

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { ok: false, written: 0, detail: 'FIRECRAWL_API_KEY is not set on this deployment.' };
    }

    if (!args.force) {
      const at: number | null = await ctx.runQuery(internal.sources.cachedAt, {
        conditionId: args.conditionId,
      });
      if (at !== null && Date.now() - at < ONE_WEEK) {
        return { ok: true, written: 0, detail: 'Cached within the last week.' };
      }
    }

    const query = `${entry.name} prevention and risk factors site guidance`;

    let payload: unknown;
    try {
      const response = await fetch(FIRECRAWL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 8, sources: ['web'] }),
      });
      if (!response.ok) {
        return { ok: false, written: 0, detail: `Firecrawl returned ${response.status}.` };
      }
      payload = await response.json();
    } catch (error) {
      return { ok: false, written: 0, detail: `Firecrawl call failed: ${String(error)}` };
    }

    const web = (payload as { data?: { web?: unknown[] } } | null)?.data?.web;
    const rows = Array.isArray(web) ? web : [];

    const cards: { title: string; url: string; snippet: string }[] = [];
    const seen = new Set<string>();
    for (const raw of rows) {
      const item = raw as { title?: unknown; url?: unknown; description?: unknown };
      const url = typeof item.url === 'string' ? item.url : '';
      if (!url || seen.has(url) || !hostAllowed(url)) continue;
      seen.add(url);
      cards.push({
        title: typeof item.title === 'string' && item.title ? item.title : conditionName(args.conditionId),
        url,
        snippet: typeof item.description === 'string' ? item.description : '',
      });
      if (cards.length === 5) break;
    }

    if (cards.length === 0) {
      return { ok: false, written: 0, detail: 'No results from an allowed public-health domain.' };
    }

    const written: number = await ctx.runMutation(internal.sources.store, {
      conditionId: args.conditionId,
      cards,
    });
    return { ok: true, written, detail: `Cached ${written} source card(s).` };
  },
});
