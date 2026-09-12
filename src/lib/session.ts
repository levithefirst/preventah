import 'server-only';
import { cookies } from 'next/headers';
import { sessionSecret } from './server-env';

/**
 * Wallet-ownership sessions.
 *
 * The client proves it controls a Polygon address by signing a one-time
 * nonce, and receives an HMAC-signed cookie. Without this, anyone could
 * POST a check-in for somebody else's wallet, or register a stake against
 * an address they do not control.
 *
 * The cookie carries no secret material: just the address and an expiry,
 * authenticated by HMAC-SHA256 so it cannot be edited.
 */

export const SESSION_COOKIE = 'preventah_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  address: string;
  exp: number;
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return b64url(new Uint8Array(sig));
}

/** Constant-time comparison, so a bad signature leaks no timing information. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(address: string): Promise<string> {
  const payload: SessionPayload = {
    address: address.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${await hmac(body)}`;
}

export async function readSessionToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  if (!timingSafeEqual(signature, await hmac(body))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (
      typeof payload.address !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload.address.toLowerCase();
  } catch {
    return null;
  }
}

/** The authenticated wallet address for this request, or null. */
export async function currentAddress(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(address: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(address), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The exact message the wallet is asked to sign. */
export function loginMessage(nonce: string): string {
  return [
    'Preventah: confirm your wallet',
    '',
    'Signing proves you control this address so only you can check in',
    'against your stake. This signature is free and sends no funds.',
    '',
    `Nonce: ${nonce}`,
  ].join('\n');
}
