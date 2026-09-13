import { formatUsdt, rewardBaseUnits } from '@/lib/config';
import { escrowUsdtBalance, sendUsdt, verifyStakeTransaction } from '@/lib/chain';
import { cronSecret, rewardBps } from '@/lib/server-env';
import {
  activateStake,
  claimSettlableStakes,
  getPendingStakes,
  markPayoutFailed,
  markStakePaid,
  rejectStake,
} from '@/lib/repo';
import { fail } from '@/lib/api';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bounded per run so one invocation cannot exceed the function time limit. */
const PENDING_SWEEP_LIMIT = 25;
const SETTLE_LIMIT = 25;

/**
 * Daily settlement job.
 *
 * Two phases:
 *  1. Sweep stakes still pending on-chain confirmation, so a user who closed
 *     the Mini App mid-confirmation still gets an active streak.
 *  2. Settle stakes that have either hit their target or run out of window.
 *
 * Settlement policy: the stake itself is ALWAYS returned. The reward is paid
 * only when the user met their check-in target. Nobody loses their deposit
 * for missing a target, which keeps this a commitment device rather than
 * anything resembling a wager.
 *
 * Concurrency: claimSettlableStakes flips rows to 'settling' in the same
 * statement that selects them, so overlapping runs cannot double-pay.
 */
async function run(request: Request): Promise<NextResponse> {
  const provided = request.headers.get('authorization') ?? '';
  let expected: string;
  try {
    expected = `Bearer ${cronSecret()}`;
  } catch (error) {
    console.error('[preventah] cron misconfigured', error);
    return fail('Payout job is not configured.', 500);
  }
  if (provided !== expected) return fail('Unauthorized.', 401);

  const summary = {
    confirmed: 0,
    rejected: 0,
    paid: 0,
    failed: 0,
    skippedInsufficientFunds: 0,
  };

  // --- Phase 1: confirm pending stakes -------------------------------------
  for (const stake of await getPendingStakes(PENDING_SWEEP_LIMIT)) {
    try {
      const verdict = await verifyStakeTransaction(
        stake.stake_tx_hash,
        stake.wallet_address,
        // Each stake is checked against its own recorded amount.
        stake.amount_base,
      );
      if (verdict.ok) {
        await activateStake(stake.id, verdict.amountBase);
        summary.confirmed += 1;
      } else if (!verdict.retryable) {
        await rejectStake(stake.id, verdict.reason);
        summary.rejected += 1;
      }
    } catch (error) {
      console.error(`[preventah] sweep failed for stake ${stake.id}`, error);
    }
  }

  // --- Phase 2: settle -----------------------------------------------------
  const claimed = await claimSettlableStakes(SETTLE_LIMIT);
  if (claimed.length > 0) {
    const bps = rewardBps();
    let balance: bigint;
    try {
      balance = await escrowUsdtBalance();
    } catch (error) {
      console.error('[preventah] could not read escrow balance', error);
      for (const stake of claimed) {
        await markPayoutFailed(stake.id, 'Could not read escrow balance.');
      }
      return NextResponse.json({ ok: false, summary }, { status: 503 });
    }

    for (const stake of claimed) {
      const targetMet = stake.checkin_count >= stake.target_days;
      const reward = targetMet ? rewardBaseUnits(stake.amount_base, bps) : 0n;
      const total = stake.amount_base + reward;

      // Refuse to broadcast a transfer the escrow cannot cover. The stake
      // goes back to 'active' and the next run retries it, rather than
      // burning gas on a transaction that would revert.
      if (total > balance) {
        await markPayoutFailed(
          stake.id,
          `Escrow balance too low to pay ${formatUsdt(total)} USDT.`,
        );
        summary.skippedInsufficientFunds += 1;
        continue;
      }

      try {
        const hash = await sendUsdt(stake.wallet_address, total);
        await markStakePaid(stake.id, hash, reward);
        balance -= total;
        summary.paid += 1;
      } catch (error) {
        // Never log the error object wholesale: it can carry request context.
        const message =
          error instanceof Error ? error.message : 'Unknown payout error';
        console.error(`[preventah] payout failed for stake ${stake.id}: ${message}`);
        await markPayoutFailed(stake.id, message);
        summary.failed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, summary });
}

/** Vercel Cron issues a GET. POST is accepted for manual runs. */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
