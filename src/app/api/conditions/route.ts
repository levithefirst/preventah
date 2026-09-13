import { sanitizeConditionIds } from '@/lib/conditions';
import { hasActiveConsent, setSelections } from '@/lib/repo';
import { buildState } from '@/lib/state';
import { fail, ok, readJson, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Replaces the user's hereditary risk selections.
 *
 * Two gates, both server-side:
 *  1. An active consent row must exist.
 *  2. Keys are filtered against the fixed checklist, so free text or an
 *     unknown key is dropped rather than stored.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    if (!(await hasActiveConsent(user.id))) {
      return fail('Consent is required before saving health selections.', 403);
    }

    const body = await readJson(request);
    const keys = sanitizeConditionIds(body.keys);

    await setSelections(user.id, keys);
    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('conditions', error);
  }
}
