'use client';

/**
 * TEMPORARY DIAGNOSTIC - remove once the Nimiq Pay post-auth failure is
 * understood.
 *
 * Two kinds of marker:
 *  - diagMark: console only. Cheap, but lost if the WebView dies, which is
 *    precisely the failure under investigation.
 *  - diagBeacon: a fire-and-forget GET to an endpoint that already exists,
 *    so the marker lands in the Vercel runtime log and survives the WebView.
 *
 * Never carries a wallet address, signature, cookie, nonce, signed message,
 * health data or condition key. Only a fixed step name and an opaque id.
 */

/** Opaque id for the current sign-in attempt, set by the auth flow. */
let diagId = 'unknown';

export function setDiagId(id: string): void {
  diagId = /^[a-f0-9]{1,16}$/.test(id) ? id : 'unknown';
}

export function getDiagId(): string {
  return diagId;
}

/** Console marker for a render boundary. */
export function diagMark(step: string): void {
  try {
    console.info(`AUTH_STEP=${step} requestId=${diagId}`);
  } catch {
    // Diagnostics must never break the flow they observe.
  }
}

/**
 * Durable marker. Rides an existing authenticated GET so no new route or
 * behaviour is introduced; the response is deliberately ignored.
 */
export function diagBeacon(step: string): void {
  try {
    void fetch(
      `/api/me?d=${encodeURIComponent(step)}&rid=${encodeURIComponent(diagId)}`,
      { method: 'GET', cache: 'no-store' },
    ).catch(() => {
      // A failed beacon is itself uninteresting; the absence of the log line
      // is the signal.
    });
  } catch {
    // ignored
  }
}
