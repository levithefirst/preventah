'use client';

import type { AppState } from './state';

/**
 * The browser's single entry point to the API.
 *
 * It is deliberately total: it never rejects. A dropped connection, a
 * WebView suspended mid-request, or a server that stops responding all come
 * back as an ordinary failed result.
 *
 * That matters because most callers act on the result and then clear a busy
 * flag. If this threw instead, the rejection would escape into an event
 * handler or effect, the busy flag would stay set, and the user would be
 * left on a spinner with every control disabled and no way back. Inside
 * Nimiq Pay that is indistinguishable from the app being broken.
 */

/** Long enough for a cold serverless start, short enough to not feel hung. */
export const API_TIMEOUT_MS = 15_000;

export interface ApiResult {
  ok: boolean;
  error?: string;
  state?: AppState;
  pending?: boolean;
  /** Why a stake is still pending, from the on-chain verdict. */
  reason?: string | null;
  alreadyCheckedIn?: boolean;
  /** True when the request never reached the server, or timed out. */
  offline?: boolean;
}

export async function api(
  path: string,
  init?: RequestInit,
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });

    try {
      return (await response.json()) as ApiResult;
    } catch {
      return {
        ok: false,
        error: 'The server sent a response we could not read.',
      };
    }
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError');

    return {
      ok: false,
      offline: true,
      error: timedOut
        ? 'That took too long. Check your connection and try again.'
        : 'No connection. Check your network and try again.',
    };
  } finally {
    clearTimeout(timer);
  }
}
