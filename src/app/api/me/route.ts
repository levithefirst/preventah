import { buildState } from '@/lib/state';
import { fail, ok, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/** Everything the client needs to render, in one round trip. */
export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);
    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('me', error);
  }
}
