import { db } from '@/lib/db';
import { loginMessage } from '@/lib/session';
import { fail, ok, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NONCE_TTL_MINUTES = 10;

/** Issues a single-use nonce for wallet signature login. */
export async function POST() {
  try {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const sql = db();
    await sql`
      INSERT INTO auth_nonces (nonce, expires_at)
      VALUES (${nonce}, now() + (${NONCE_TTL_MINUTES} || ' minutes')::interval)
    `;
    // Opportunistic cleanup keeps the table small without a separate job.
    await sql`DELETE FROM auth_nonces WHERE expires_at < now() - interval '1 day'`;

    return ok({ nonce, message: loginMessage(nonce) });
  } catch (error) {
    return serverError('auth/nonce', error);
  }
}

export function GET() {
  return fail('Use POST.', 405);
}
