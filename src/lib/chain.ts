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

/**
 * On-chain verification and payout.
 *
 * The verification half is the security boundary of the whole app: a client
 * can claim any transaction hash it likes, so nothing is trusted until the
 * receipt has been read from Polygon and every field checked against what
 * the client claimed.
 */

/** Confirmations required before a stake counts as settled. */
export const REQUIRED_CONFIRMATIONS = 3n;

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

  const client = publicClient();

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as Hash });
  } catch {
    // Not mined yet, or the RPC is briefly unavailable. Both are worth retrying.
    return {
      ok: false,
      reason: 'Transaction not found on-chain yet.',
      retryable: true,
    };
  }

  if (receipt.status !== 'success') {
    return { ok: false, reason: 'Transaction reverted on-chain.', retryable: false };
  }

  const latest = await client.getBlockNumber();
  if (latest - receipt.blockNumber + 1n < REQUIRED_CONFIRMATIONS) {
    return {
      ok: false,
      reason: 'Waiting for confirmations.',
      retryable: true,
    };
  }

  // Read the Transfer events rather than the transaction's input data: this
  // works whether the user paid directly or through a batching contract, and
  // it reflects what actually moved rather than what was requested.
  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: receipt.logs,
  });

  const escrow = getAddress(escrowAddress());
  const from = getAddress(expectedFrom);
  const token = getAddress(USDT_ADDRESS);

  const match = transfers.find(
    (log) =>
      getAddress(log.address) === token &&
      getAddress(log.args.to) === escrow &&
      getAddress(log.args.from) === from &&
      log.args.value >= expectedAmountBase,
  );

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
