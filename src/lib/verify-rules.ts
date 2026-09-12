import { getAddress } from 'viem';

/**
 * Pure verification rules for a stake transaction.
 *
 * Deliberately free of RPC access, environment variables and secrets, so the
 * decisions that govern real money can be tested directly without a network.
 * src/lib/chain.ts fetches the data and applies these.
 */

/** Confirmations required before a stake counts as settled. */
export const REQUIRED_CONFIRMATIONS = 3n;

/**
 * Confirmations for a receipt, never negative.
 *
 * Public Polygon endpoints are load balanced across nodes. A receipt can be
 * served by a synced node while the very next `eth_blockNumber` is served by
 * one a few blocks behind, making `latest - receiptBlock` negative. Treating
 * that as a large negative number reads as "not confirmed" on every poll, so
 * a fully confirmed stake can stay pending forever. Clamping at zero turns
 * that into an ordinary retry instead.
 */
export function confirmationsFor(
  latestBlock: bigint,
  receiptBlock: bigint,
): bigint {
  if (latestBlock < receiptBlock) return 0n;
  return latestBlock - receiptBlock + 1n;
}

export function hasEnoughConfirmations(
  latestBlock: bigint,
  receiptBlock: bigint,
): boolean {
  return confirmationsFor(latestBlock, receiptBlock) >= REQUIRED_CONFIRMATIONS;
}

/** The shape of a decoded ERC-20 Transfer log that matters here. */
export interface TransferLogLike {
  address: string;
  args: { from: string; to: string; value: bigint };
}

export interface TransferCriteria {
  token: string;
  escrow: string;
  from: string;
  minAmount: bigint;
}

/**
 * Finds the Transfer log that funds a stake.
 *
 * Matching on the emitted event rather than the transaction's `to`/`from` is
 * what makes this work when Nimiq Pay routes the payment through a relayer or
 * meta-transaction: the outer transaction sender is then the relayer, but the
 * Transfer event still names the user as `from`. A relayer fee paid in the
 * same transaction shows up as an extra Transfer log and is simply skipped.
 */
export function findMatchingTransfer(
  transfers: readonly TransferLogLike[],
  criteria: TransferCriteria,
): TransferLogLike | undefined {
  let token: string;
  let escrow: string;
  let from: string;
  try {
    token = getAddress(criteria.token);
    escrow = getAddress(criteria.escrow);
    from = getAddress(criteria.from);
  } catch {
    // A malformed configured address can never match anything.
    return undefined;
  }

  return transfers.find((log) => {
    try {
      return (
        getAddress(log.address) === token &&
        getAddress(log.args.to) === escrow &&
        getAddress(log.args.from) === from &&
        log.args.value >= criteria.minAmount
      );
    } catch {
      // One malformed log must not abort the search over the rest.
      return false;
    }
  });
}
