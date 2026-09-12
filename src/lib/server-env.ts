import 'server-only';

/**
 * Server-only environment access.
 *
 * Values are read lazily through functions rather than at module scope so a
 * missing variable surfaces as a clean runtime error on the one route that
 * needs it, instead of breaking the build or taking down unrelated pages.
 *
 * ESCROW_PRIVATE_KEY is read here and nowhere else. It is never logged,
 * never returned in a response, and never sent to the client.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function databaseUrl(): string {
  return required('DATABASE_URL');
}

export function sessionSecret(): string {
  return required('SESSION_SECRET');
}

export function cronSecret(): string {
  return required('CRON_SECRET');
}

export function polygonRpcUrl(): string {
  return required('POLYGON_RPC_URL');
}

/** Escrow address as seen by the server, lowercased for comparison. */
export function escrowAddress(): string {
  return required('ESCROW_WALLET_ADDRESS').toLowerCase();
}

/**
 * Escrow signing key. Only the payout job calls this.
 * Set exclusively in the Vercel dashboard.
 */
export function escrowPrivateKey(): `0x${string}` {
  const raw = required('ESCROW_PRIVATE_KEY');
  const key = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    // Deliberately does not echo the value.
    throw new Error('ESCROW_PRIVATE_KEY is not a valid 32-byte hex key');
  }
  return key as `0x${string}`;
}

/** Reward paid on success, in basis points of the stake. Defaults to 5%. */
export function rewardBps(): bigint {
  const raw = process.env.REWARD_BPS;
  const parsed = raw ? Number(raw) : 500;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error('REWARD_BPS must be between 0 and 10000');
  }
  return BigInt(Math.floor(parsed));
}
