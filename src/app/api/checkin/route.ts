import { addCheckin, getActiveStake } from '@/lib/repo';
import { buildState } from '@/lib/state';
import { fail, ok, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Records today's check-in against the active stake.
 *
 * One per UTC calendar day, enforced by a UNIQUE constraint in the database
 * rather than by a read-then-write here, so two rapid taps or two open tabs
 * cannot both succeed.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    const stake = await getActiveStake(user.id);
    if (!stake) {
      return fail('Start a commitment before checking in.', 404);
    }
    if (stake.status === 'pending') {
      return fail('Your stake is still confirming on-chain.', 409);
    }
    if (stake.status !== 'active') {
      return fail('This commitment is no longer accepting check-ins.', 409);
    }

    const outcome = await addCheckin(stake.id, user.id);

    if (outcome === 'outside_window') {
      return fail(
        'Today falls outside your commitment window, so it cannot be counted.',
        409,
      );
    }

    return ok({
      state: await buildState(user),
      alreadyCheckedIn: outcome === 'already_checked_in',
    });
  } catch (error) {
    return serverError('checkin', error);
  }
}
