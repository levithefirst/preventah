import { buildPayload, validateRewrite, type RewrittenAction } from './rewrite';
import type { TieredAction } from './tiers';

/**
 * The OpenAI call, and the rules that keep it cheap.
 *
 * Lives here rather than beside the Convex action so the money rules can
 * be exercised against a stubbed fetch: no retries on anything that could
 * have been billed, a free 404 or parameter rejection advancing to the
 * next model, and a hard ceiling on output tokens. The caller owns the
 * once-per-day guard; this module owns what one call is allowed to do.
 */

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Cheapest first. The chain is walked only when a model id is rejected
 * outright (404, unknown model, unsupported parameter), which costs
 * nothing; any failure that could have been billed stops the whole thing.
 */
export const MODELS = ['gpt-5-nano', 'gpt-4.1-nano', 'gpt-4o-mini'] as const;

export const MAX_OUTPUT_TOKENS = 400;
const TIMEOUT_MS = 20_000;

const SYSTEM = [
  'You tighten the wording of general prevention actions. You are not a clinician.',
  'Rewrite only the title, the one-line how, and each tier title.',
  'Keep every id and tier name exactly as given. Return all of them.',
  'Never mention a drug, a dose, a supplement as treatment, a lab test or a measurement the input did not contain.',
  'Never write "you have", "you will develop", "diagnose", "treat" or "cure".',
  'Never add a URL.',
  'Keep each string shorter than the one it replaces where you can. Plain, direct, imperative.',
  'Reply with JSON only: {"actions":[{"id":"","title":"","oneLiner":"","tiers":[{"tier":"","title":""}]}]}',
].join(' ');

export interface CallOutcome {
  actions: RewrittenAction[] | null;
  model: string | null;
  detail: string;
}

/** True for a rejection that was never billed, so the next model is free to try. */
export function isModelRejection(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  return /model|unsupported|unrecognized|unknown[_ ]parameter|max_tokens|temperature/i.test(body);
}

export async function callOpenAI(
  apiKey: string,
  catalog: TieredAction[],
): Promise<CallOutcome> {
  const payload = buildPayload(catalog);
  const userMessage = JSON.stringify({ actions: payload });

  for (const model of MODELS) {
    // Newer small models take max_completion_tokens and only the default
    // temperature; the 4.x ones take max_tokens and honour 0. Sending the
    // wrong pair is a free 400, which advances the chain rather than
    // burning the day.
    const isNextGen = model.startsWith('gpt-5');
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      ...(isNextGen
        ? { max_completion_tokens: MAX_OUTPUT_TOKENS }
        : { max_tokens: MAX_OUTPUT_TOKENS, temperature: 0 }),
    };

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      // Timeout or transport failure. Could have been billed, so stop.
      return { actions: null, model, detail: `request failed: ${String(error).slice(0, 120)}` };
    }

    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      if (isModelRejection(response.status, text)) continue;
      return { actions: null, model, detail: `openai returned ${response.status}` };
    }

    let content: unknown;
    try {
      const json = (await response.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const raw = json.choices?.[0]?.message?.content;
      if (typeof raw !== 'string') {
        return { actions: null, model, detail: 'response had no message content' };
      }
      content = JSON.parse(raw);
    } catch {
      return { actions: null, model, detail: 'response was not valid JSON' };
    }

    const validation = validateRewrite(content, catalog);
    if (!validation.ok) {
      const first = validation.violations[0];
      return {
        actions: null,
        model,
        detail: `rejected: ${first ? `${first.field} ${first.reason}` : 'failed validation'}`,
      };
    }

    return { actions: validation.actions, model, detail: 'ok' };
  }

  return { actions: null, model: null, detail: 'no configured model was accepted' };
}

