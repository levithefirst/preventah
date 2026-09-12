import 'server-only';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  getAddress,
  http,
  parseEventLogs,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { CHAIN_ID, USDT_ADDRESS } from './config';
import { escrowAddress, escrowPrivateKey, polygonRpcUrl } from './server-env';
import {
  REQUIRED_CONFIRMATIONS,
  confirmationsFor,
  findMatchingTransfer,
  type TransferLogLike,
} from './verify-rules';

export { REQUIRED_CONFIRMATIONS } from './verify-rules';

/**
 * On-chain verification and payout.
 *
 * The verification half is the security boundary of the whole app: a client
 * can claim any transaction hash it likes, so nothing is trusted until the
 * receipt has been read from Polygon and every field checked against what
 * the client claimed.
 */

function chain() {
  // Polygon mainnet is the default; defineChain keeps a custom chain id
  // (a fork or testnet during development) working without code changes.
  return CHAIN_ID === polygon.id
    ? polygon
    : defineChain({
        ...polygon,
        id: CHAIN_ID,
        name: `chain-${CHAIN_ID}`,
      });
}

export function publicClient() {
  return createPublicClient({ chain: chain(), transport: http(polygonRpcUrl()) });
}

export type StakeVerdict =
  | { ok: true; amountBase: bigint; blockNumber: bigint }
  | { ok: false; reason: string; retryable: boolean };

/**
 * Verifies that `txHash` is a confirmed USDT transfer of at least
 * `expectedAmountBase` from `expectedFrom` into the escrow wallet.
 *
 * `retryable` distinguishes "not confirmed yet, ask again later" from
 * "this transaction will never be valid", so the caller knows whether to
 * poll or to reject outright.
 */
export async function verifyStakeTransaction(
  txHash: string,
  expectedFrom: string,
  expectedAmountBase: bigint,
): Promise<StakeVerdict> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { ok: false, reason: 'Malformed transaction hash.', retryable: false };
  }

  let client: ReturnType<typeof publicClient>;
  try {
    client = publicClient();
  } catch {
    // POLYGON_RPC_URL missing or invalid. That is an operator problem, not a
    // bad payment, so it stays retryable: fixing the config and rechecking
    // must be able to recover the stake.
    return {
      ok: false,
      reason: 'Chain access is not configured. An operator needs to fix this.',
      retryable: true,
    };
  }

  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as Hash });
  } catch {
    // Not mined yet, or the RPC is briefly unavailable. Both worth retrying.
    return {
      ok: false,
      reason: 'Transaction not found on-chain yet.',
      retryable: true,
    };
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: 'Transaction reverted on-chain.', retryable: false };
  }

  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return {
      ok: false,
      reason: 'Could not read the current block height.',
      retryable: true,
    };
  }

  const confirmations = confirmationsFor(latest, receipt.blockNumber);
  if (confirmations < REQUIRED_CONFIRMATIONS) {
    return {
      ok: false,
      reason: `Waiting for confirmations (${confirmations}/${REQUIRED_CONFIRMATIONS}).`,
      retryable: true,
    };
  }

  let transfers: TransferLogLike[];
  try {
    transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: 'Transfer',
      logs: receipt.logs,
    }) as unknown as TransferLogLike[];
  } catch {
    return {
      ok: false,
      reason: 'Could not decode the transfer logs for this transaction.',
      retryable: false,
    };
  }

  let escrow: string;
  try {
    escrow = escrowAddress();
  } catch {
    // Same reasoning as a missing RPC URL: recoverable by an operator.
    return {
      ok: false,
      reason: 'Escrow wallet is not configured. An operator needs to fix this.',
      retryable: true,
    };
  }

  const match = findMatchingTransfer(transfers, {
    token: USDT_ADDRESS,
    escrow,
    from: expectedFrom,
    minAmount: expectedAmountBase,
  });

  if (!match) {
    return {
      ok: false,
      reason:
        'No matching USDT transfer to the escrow wallet was found in this transaction.',
      retryable: false,
    };
  }

  return {
    ok: true,
    amountBase: match.args.value,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Sends USDT from the escrow wallet back to a user.
 * The only caller is the payout job. The private key is read here, used to
 * build a signer, and never returned or logged.
 */
export async function sendUsdt(to: string, amountBase: bigint): Promise<Hash> {
  if (amountBase <= 0n) {
    throw new Error('Refusing to send a non-positive amount.');
  }

  const account = privateKeyToAccount(escrowPrivateKey());
  const wallet = createWalletClient({
    account,
    chain: chain(),
    transport: http(polygonRpcUrl()),
  });

  return wallet.writeContract({
    address: getAddress(USDT_ADDRESS),
    abi: erc20Abi,
    functionName: 'transfer',
    args: [getAddress(to), amountBase],
  });
}

/** Escrow USDT balance, so the payout job can refuse to overdraw. */
export async function escrowUsdtBalance(): Promise<bigint> {
  return publicClient().readContract({
    address: getAddress(USDT_ADDRESS),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [getAddress(escrowAddress())],
  });
}
