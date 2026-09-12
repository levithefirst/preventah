import { buildState } from '@/lib/state';
import { fail, ok, requireUser, serverError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY DIAGNOSTIC - remove with the rest of the AUTH_STEP markers.
 *
 * Render-boundary beacons ride this existing endpoint so no new route is
 * introduced. Both values are constrained before they reach a log line, so
 * a hostile query string cannot inject into the log.
 */
function logRenderBeacon(url: string): void {
  try {
    const params = new URL(url).searchParams;
    const step = params.get('d');
    if (!step) return;
    const safeStep = /^[a-zA-Z0-9_]{1,40}$/.test(step) ? step : 'invalid';
    const rid = params.get('rid') ?? '';
    const safeRid = /^[a-f0-9]{1,16}$/.test(rid) ? rid : 'unknown';
    console.info(`AUTH_STEP=${safeStep} requestId=${safeRid}`);
  } catch {
    // A malformed beacon must never affect the response.
  }
}

/** Everything the client needs to render, in one round trip. */
export async function GET(request: Request) {
  logRenderBeacon(request.url);

  try {
    const user = await requireUser();
    if (!user) return fail('Not signed in.', 401);
    return ok({ state: await buildState(user) });
  } catch (error) {
    return serverError('me', error);
  }
}
