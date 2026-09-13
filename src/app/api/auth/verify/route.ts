import { isAddress, verifyMessage } from 'viem';
import { db } from '@/lib/db';
import { loginMessage, setSessionCookie } from '@/lib/session';
import { getOrCreateUser } from '@/lib/repo';
import { fail, ok, readJson, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Verifies a wallet signature over a nonce we issued, then starts a session.
 *
 * The nonce is consumed atomically (UPDATE ... WHERE used_at IS NULL
 * RETURNING), so a captured signature cannot be replayed.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const address = String(body.address ?? '');
    const signature = String(body.signature ?? '');
    const nonce = String(body.nonce ?? '');

    if (!isAddress(address)) return fail('Invalid wallet address.');
    if (!/^0x[0-9a-fA-F]+$/.test(signature)) return fail('Invalid signature.');
    if (!/^[a-f0-9]{32}$/.test(nonce)) return fail('Invalid nonce.');

    const sql = db();
    const claimed = (await sql`
      UPDATE auth_nonces SET used_at = now()
       WHERE nonce = ${nonce} AND used_at IS NULL AND expires_at > now()
      RETURNING nonce
    `) as { nonce: string }[];

    if (claimed.length === 0) {
      return fail('This login request expired. Please try again.', 401);
    }

    const valid = await verifyMessage({
      address,
      message: loginMessage(nonce),
      signature: signature as `0x${string}`,
    });

    if (!valid) return fail('Signature did not match the wallet address.', 401);

    await getOrCreateUser(address);
    await setSessionCookie(address);

    return ok({ address: address.toLowerCase() });
  } catch (error) {
    return serverError('auth/verify', error);
  }
}
