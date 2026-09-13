import { validateMeasurement } from '@/lib/measurements';
import {
  deleteAllMeasurements,
  deleteMeasurement,
  hasActiveConsent,
  recordMeasurement,
} from '@/lib/repo';
import { buildState } from '@/lib/state';
import { todayIso } from '@/lib/dates';
import { fail, ok, readJson, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records one measurement.
 *
 * Two gates, both server-side and both the same ones the conditions route
 * uses:
 *  1. An active consent row must exist. Measurements are health data.
 *  2. The reading is validated against the fixed kinds, units and plausible
 *     ranges in src/lib/measurements.ts, so a typo or a hostile payload is
 *     rejected with a message rather than stored.
 *
 * Nothing about the reading is logged. The error returned to the client is
 * the validator's own message, which names a bound but never echoes what
 * was sent.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    if (!(await hasActiveConsent(user.id))) {
      return fail('Consent is required before recording measurements.', 403);
    }

    const body = await readJson(request);
    const result = validateMeasurement(body, todayIso());
    if (!result.ok) return fail(result.error);

    await recordMeasurement(user.id, result.value);
    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('measurements POST', error);
  }
}

/**
 * Deletes one measurement, or all of them.
 *
 * A user can always remove what they recorded, without having to withdraw
 * consent and lose their condition selections too.
 */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    const body = await readJson(request);

    if (body.all === true) {
      await deleteAllMeasurements(user.id);
      return ok({ state: await buildState(user) });
    }

    const id = typeof body.id === 'string' ? body.id : '';
    if (!UUID.test(id)) return fail('That measurement could not be found.');

    // Scoped to the user inside the DELETE itself, so one user can never
    // remove another's row even with a valid id.
    const removed = await deleteMeasurement(user.id, id);
    if (!removed) return fail('That measurement could not be found.', 404);

    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('measurements DELETE', error);
  }
}
