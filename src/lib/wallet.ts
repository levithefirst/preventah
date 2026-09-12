'use client';

import { encodeFunctionData, erc20Abi, getAddress } from 'viem';
import { CHAIN_ID, CHAIN_ID_HEX, USDT_ADDRESS } from './config';

/**
 * Client-side wallet integration.
 *
 * Two providers are in play inside Nimiq Pay, and both are used:
 *  - window.nimiq, obtained through the Mini App SDK's init(). This is the
 *    host handshake: it tells us we are running inside Nimiq Pay and gives
 *    us the user's Nimiq account.
 *  - window.ethereum, which Nimiq Pay injects for EVM chains. USDT on
 *    Polygon lives here, and every stake and payout moves through it.
 *
 * Nimiq Pay renders its own native confirmation sheet for the transfer, so
 * the app never builds a confirmation UI of its own.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export class WalletError extends Error {
  constructor(message: string, readonly code: string = 'wallet_error') {
    super(message);
    this.name = 'WalletError';
  }
}

/** EIP-1193 user-rejection code, plus the variants wallets send in practice. */
function isUserRejection(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return true;
  const message = String((error as { message?: unknown })?.message ?? '');
  return /reject|denied|cancell?ed/i.test(message);
}

export interface HostInfo {
  insideNimiqPay: boolean;
  nimiqAddress: string | null;
  language: string | undefined;
}

/**
 * Completes the Nimiq Pay handshake.
 *
 * Resolves either way: outside Nimiq Pay (a desktop browser during
 * development) it reports insideNimiqPay: false rather than throwing, so
 * the app can still explain itself instead of showing a blank screen.
 */
export async function detectHost(timeout = 2500): Promise<HostInfo> {
  try {
    const { init, getHostLanguage } = await import('@nimiq/mini-app-sdk');
    const nimiq = await init({ timeout });

    let nimiqAddress: string | null = null;
    try {
      const accounts = await nimiq.listAccounts();
      if (Array.isArray(accounts) && typeof accounts[0] === 'string') {
        nimiqAddress = accounts[0];
      }
    } catch {
      // The host is present but withheld accounts. Still inside Nimiq Pay.
    }

    return {
      insideNimiqPay: true,
      nimiqAddress,
      language: getHostLanguage(),
    };
  } catch {
    return { insideNimiqPay: false, nimiqAddress: null, language: undefined };
  }
}

function evmProvider(): Eip1193Provider {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!provider) {
    throw new WalletError(
      'No Polygon wallet was found. Open Preventah inside Nimiq Pay to continue.',
      'no_provider',
    );
  }
  return provider;
}

/** Requests the user's Polygon address, prompting if not yet authorised. */
export async function connectEvmAccount(): Promise<string> {
  const provider = evmProvider();
  try {
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new WalletError('No wallet account was returned.', 'no_accounts');
    }
    return getAddress(accounts[0]).toLowerCase();
  } catch (error) {
    if (error instanceof WalletError) throw error;
    if (isUserRejection(error)) {
      throw new WalletError('Wallet connection was declined.', 'rejected');
    }
    throw new WalletError('Could not reach your wallet.', 'connect_failed');
  }
}

/**
 * Ensures the wallet is on Polygon before any token call.
 *
 * Sending a USDT transfer while the wallet sits on another chain would hit
 * a different contract at the same address, so this is checked every time
 * rather than once at startup.
 */
export async function ensurePolygon(): Promise<void> {
  const provider = evmProvider();

  const current = (await provider.request({ method: 'eth_chainId' })) as string;
  if (typeof current === 'string' && parseInt(current, 16) === CHAIN_ID) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (isUserRejection(error)) {
      throw new WalletError('Network switch was declined.', 'rejected');
    }
    throw new WalletError(
      'Please switch your wallet to the Polygon network and try again.',
      'wrong_chain',
    );
  }

  const after = (await provider.request({ method: 'eth_chainId' })) as string;
  if (parseInt(after, 16) !== CHAIN_ID) {
    throw new WalletError(
      'Your wallet is not on Polygon. Switch networks and try again.',
      'wrong_chain',
    );
  }
}

/** Signs the login challenge to prove control of the address. */
export async function signLoginMessage(
  address: string,
  message: string,
): Promise<string> {
  const provider = evmProvider();
  try {
    return (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
  } catch (error) {
    if (isUserRejection(error)) {
      throw new WalletError('Signature request was declined.', 'rejected');
    }
    throw new WalletError('Could not sign the login message.', 'sign_failed');
  }
}

/**
 * Sends the USDT stake to the escrow wallet.
 *
 * Nimiq Pay presents its native confirmation sheet here. The returned hash
 * is handed to the server, which verifies it on-chain before the stake
 * counts for anything.
 */
export async function sendUsdtStake(params: {
  from: string;
  to: string;
  amountBase: bigint;
}): Promise<string> {
  const provider = evmProvider();
  await ensurePolygon();

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [getAddress(params.to), params.amountBase],
  });

  try {
    const hash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: getAddress(params.from),
          to: getAddress(USDT_ADDRESS),
          data,
          value: '0x0',
        },
      ],
    })) as string;

    if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new WalletError('Wallet did not return a transaction hash.', 'no_hash');
    }
    return hash.toLowerCase();
  } catch (error) {
    if (error instanceof WalletError) throw error;
    if (isUserRejection(error)) {
      throw new WalletError('You cancelled the payment.', 'rejected');
    }
    const message = String((error as { message?: unknown })?.message ?? '');
    if (/insufficient/i.test(message)) {
      throw new WalletError(
        'Not enough USDT or POL for gas in your wallet.',
        'insufficient_funds',
      );
    }
    throw new WalletError('The payment could not be sent.', 'send_failed');
  }
}
