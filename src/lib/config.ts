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

/** Default commitment size, in whole USDT. */
export const STAKE_AMOUNT_USDT = Number(
  process.env.NEXT_PUBLIC_STAKE_AMOUNT_USDT ?? 1,
);

/** Commitment shape: check in on 5 separate days inside a 7-day window. */
export const TARGET_DAYS = 5;
export const WINDOW_DAYS = 7;

/** Bump this string whenever the consent copy changes materially. */
export const CONSENT_VERSION = '2026-09-12.v1';

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
