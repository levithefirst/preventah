import { CHAIN_ID, STAKE_AMOUNT_USDT, USDT_ADDRESS, toBaseUnits } from '@/lib/config';
import { verifyStakeTransaction } from '@/lib/chain';
import { escrowAddress } from '@/lib/server-env';
import {
  activateStake,
  createPendingStake,
  findStakeByTxHash,
  getActiveStake,
  getSelections,
  hasActiveConsent,
  rejectStake,
} from '@/lib/repo';
import { buildState } from '@/lib/state';
import { fail, ok, readJson, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registers a USDT stake the user has already broadcast from their wallet.
 *
 * The client sends only a transaction hash. The amount, sender, recipient
 * and token are all read back from Polygon in verifyStakeTransaction, never
 * taken from the request, so a forged or under-funded claim cannot create
 * an active stake.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);

    if (!(await hasActiveConsent(user.id))) {
      return fail('Consent is required before staking.', 403);
    }

    const selections = await getSelections(user.id);
    if (selections.length === 0) {
      return fail('Choose at least one risk category before staking.');
    }

    const existing = await getActiveStake(user.id);
    if (existing) {
      return fail('You already have a commitment in progress.', 409);
    }

    const body = await readJson(request);
    const txHash = String(body.txHash ?? '').toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) {
      return fail('Invalid transaction hash.');
    }

    // A hash already on file belongs to someone's stake; never let it fund
    // a second one.
    if (await findStakeByTxHash(txHash)) {
      return fail('This transaction has already been registered.', 409);
    }

    const expected = toBaseUnits(STAKE_AMOUNT_USDT);
    const stake = await createPendingStake({
      userId: user.id,
      walletAddress: user.wallet_address,
      chainId: CHAIN_ID,
      tokenAddress: USDT_ADDRESS,
      escrowAddress: escrowAddress(),
      amountBase: expected,
      txHash,
    });

    // Try once immediately. If the transaction needs more confirmations the
    // stake stays 'pending' and the client polls /api/stake/verify.
    const verdict = await verifyStakeTransaction(
      txHash,
      user.wallet_address,
      expected,
    );

    if (verdict.ok) {
      await activateStake(stake.id, verdict.amountBase);
    } else if (!verdict.retryable) {
      await rejectStake(stake.id, verdict.reason);
      return fail(verdict.reason, 422);
    }

    return ok({
      state: await buildState(user),
      pending: !verdict.ok,
    });
  } catch (error) {
    return serverError('stake POST', error);
  }
}
