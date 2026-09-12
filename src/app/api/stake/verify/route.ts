import { STAKE_AMOUNT_USDT, toBaseUnits } from '@/lib/config';
import { verifyStakeTransaction } from '@/lib/chain';
import { activateStake, getActiveStake, rejectStake } from '@/lib/repo';
import { buildState } from '@/lib/state';
import { fail, ok, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Re-checks a pending stake against the chain. The client polls this while
 * the transaction gathers confirmations.
 *
 * The cron job runs the same sweep, so a user who closes the Mini App
 * mid-confirmation still ends up with an active stake.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    const stake = await getActiveStake(user.id);
    if (!stake) return fail('No commitment to verify.', 404);

    if (stake.status !== 'pending') {
      return ok({ state: await buildState(user), pending: false });
    }

    const verdict = await verifyStakeTransaction(
      stake.stake_tx_hash,
      stake.wallet_address,
      toBaseUnits(STAKE_AMOUNT_USDT),
    );

    if (verdict.ok) {
      await activateStake(stake.id, verdict.amountBase);
    } else if (!verdict.retryable) {
      await rejectStake(stake.id, verdict.reason);
      return fail(verdict.reason, 422);
    } else {
      // Logged so a stake that stays pending can be diagnosed from the
      // production logs instead of guessed at.
      console.warn(
        `[preventah] stake ${stake.id} still pending: ${verdict.reason}`,
      );
    }

    return ok({
      state: await buildState(user),
      pending: !verdict.ok,
      reason: verdict.ok ? null : verdict.reason,
    });
  } catch (error) {
    return serverError('stake/verify', error);
  }
}
