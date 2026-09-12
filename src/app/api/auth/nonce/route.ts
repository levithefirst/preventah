import { db } from '@/lib/db';
import { loginMessage } from '@/lib/session';
import { fail, ok, readJson, serverError } from '@/lib/api';

/**
 * TEMPORARY DIAGNOSTIC - remove once the Nimiq Pay sign-in failure is
 * understood. Accepts only an opaque correlation id and never echoes or
 * stores it.
 */
function safeRequestId(value: unknown): string {
  return typeof value === 'string' && /^[a-f0-9]{1,16}$/.test(value)
    ? value
    : 'unknown';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NONCE_TTL_MINUTES = 10;

/** Issues a single-use nonce for wallet signature login. */
export async function POST(request: Request) {
  // TEMPORARY DIAGNOSTIC. The body is read for the correlation id only; the
  // nonce issued below does not depend on it in any way.
  const requestId = safeRequestId((await readJson(request)).requestId);

  try {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const sql = db();
    await sql`
      INSERT INTO auth_nonces (nonce, expires_at)
      VALUES (${nonce}, now() + (${NONCE_TTL_MINUTES} || ' minutes')::interval)
    `;
    // Opportunistic cleanup keeps the table small without a separate job.
    await sql`DELETE FROM auth_nonces WHERE expires_at < now() - interval '1 day'`;

    // The marker pair to compare: this is logged before the WebView is asked
    // to sign. If no matching after_auth_verify follows, the WebView did not
    // survive personal_sign.
    console.info(`AUTH_STEP=nonce_issued requestId=${requestId}`);

    return ok({ nonce, message: loginMessage(nonce) });
  } catch (error) {
    console.info(`AUTH_STEP=nonce_failed requestId=${requestId}`);
    return serverError('auth/nonce', error);
  }
}

export function GET() {
  return fail('Use POST.', 405);
}
