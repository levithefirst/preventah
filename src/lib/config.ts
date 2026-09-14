/**
 * Public configuration. Every value here is safe to ship to the browser.
 *
 * Server-only secrets live in src/lib/server-env.ts and must never be
 * imported from a client component.
 */

/** Polygon PoS mainnet. */
export const DEFAULT_CHAIN_ID = 137;

/** USDT (PoS) on Polygon. 6 decimals. */
export const DEFAULT_USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

/** USDT uses 6 decimals, not 18. Getting this wrong is a 12-order-of-magnitude bug. */
export const USDT_DECIMALS = 6;

export const CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? DEFAULT_CHAIN_ID,
);

export const USDT_ADDRESS = (
  process.env.NEXT_PUBLIC_USDT_ADDRESS ?? DEFAULT_USDT_ADDRESS
).toLowerCase();

export const ESCROW_WALLET_ADDRESS = (
  process.env.NEXT_PUBLIC_ESCROW_WALLET_ADDRESS ?? ''
).toLowerCase();

/**
 * Commitment size for a NEW stake, in whole USDT.
 *
 * Compiled in, deliberately not configurable at runtime.
 *
 * This used to read NEXT_PUBLIC_STAKE_AMOUNT_USDT with 0.1 as a fallback,
 * which meant the amount a user was actually asked to transfer depended on
 * a dashboard field nobody reviews and git could not show. For a value
 * denominated in real money that is the wrong trade: an environment
 * variable that can silently change what the app charges is a hidden
 * default, not a feature. Changing the amount is now a code change, with a
 * diff and a test.
 *
 * Only NEW commitments read this. An existing stake is settled and
 * re-verified against the amount_base recorded on its own row, so changing
 * this value never reprices a commitment somebody already paid for. The
 * live 1.00 USDT commitment predates this change and is unaffected by it.
 */
export const STAKE_AMOUNT_USDT = 0.1;

/**
 * The same amount in integer base units, which is what actually moves.
 *
 * Exported so both the client and the server can assert against one number
 * rather than each recomputing it. 0.1 USDT at 6 decimals is exactly
 * 100000 base units, with no remainder and no float involved.
 */
export const STAKE_AMOUNT_BASE = 100_000n;

/** Commitment shape: check in on 5 separate days inside a 7-day window. */
export const TARGET_DAYS = 5;
export const WINDOW_DAYS = 7;

/**
 * Bump this string whenever the consent copy changes materially.
 *
 * A bump makes every existing consent row inactive, so people are asked
 * again rather than being held to wording they never read. v2 widened the
 * scope from condition selections to measurements as well.
 *
 * Bumping does not delete anything and does not interrupt a commitment: a
 * running stake stays checkable while consent is absent, and selections
 * stay in the database but are not returned or used until consent is given
 * again.
 */
export const CONSENT_VERSION = '2026-09-13.v2';

/** Hex chain id as required by wallet_switchEthereumChain. */
export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

/** Converts a whole-USDT amount to integer base units. */
export function toBaseUnits(amountUsdt: number): bigint {
  // Route through a fixed-point string so float noise never reaches a balance.
  const [whole, frac = ''] = amountUsdt.toFixed(USDT_DECIMALS).split('.');
  return BigInt(whole + frac.padEnd(USDT_DECIMALS, '0'));
}

/** Formats integer base units as a human-readable USDT string. */
export function formatUsdt(base: bigint | string | number): string {
  const value = BigInt(base);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(USDT_DECIMALS);
  const whole = abs / divisor;
  const frac = (abs % divisor).toString().padStart(USDT_DECIMALS, '0');
  // Trim trailing zeros but always keep at least two decimal places.
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${negative ? '-' : ''}${whole}.${trimmed}`;
}

/**
 * Reward for a commitment, in integer base units.
 *
 * Deliberately takes the stake's own recorded amount rather than reading
 * STAKE_AMOUNT_USDT: a change to the default must never reprice a
 * commitment somebody already paid for. Integer division throughout, so no
 * rounding error can reach a balance.
 */
export function rewardBaseUnits(
  stakeAmountBase: bigint,
  bps: bigint,
): bigint {
  if (stakeAmountBase <= 0n || bps <= 0n) return 0n;
  return (stakeAmountBase * bps) / 10_000n;
}
