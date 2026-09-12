import { buildState } from '@/lib/state';
import { grantConsent, hasActiveConsent, revokeConsentAndErase } from '@/lib/repo';
import { fail, ok, readJson, requireUser, serverError } from '@/lib/api';
import { CONSENT_VERSION } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records explicit consent to store hereditary risk selections.
 *
 * Nothing health-related is written anywhere before this succeeds: the
 * conditions route refuses to store a selection without an active consent
 * row for the current CONSENT_VERSION.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    const body = await readJson(request);
    if (body.granted !== true) {
      return fail('Consent must be given explicitly.');
    }
    if (body.consentVersion !== CONSENT_VERSION) {
      // Guards against an old cached client agreeing to superseded wording.
      return fail('Consent text is out of date. Please reload and read it again.');
    }

    if (!(await hasActiveConsent(user.id))) {
      await grantConsent(user.id);
    }

    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('consent POST', error);
  }
}

/** Withdraws consent and deletes the hereditary selections it covered. */
export async function DELETE() {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    await revokeConsentAndErase(user.id);
    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('consent DELETE', error);
  }
}
