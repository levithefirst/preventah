import 'server-only';
import { NextResponse } from 'next/server';
import { currentAddress } from './session';
import { getOrCreateUser, type UserRow } from './repo';

/** Shared helpers for route handlers. */

export function ok<T>(data: T): NextResponse {
  // bigint is not JSON-serialisable, so amounts are stringified by callers
  // before they reach here.
  return NextResponse.json({ ok: true, ...data });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Resolves the authenticated user, or null when no valid session cookie is
 * present. Routes that need auth should return fail(..., 401).
 */
export async function requireUser(): Promise<UserRow | null> {
  const address = await currentAddress();
  if (!address) return null;
  return getOrCreateUser(address);
}

/** Parses a JSON body without throwing on malformed input. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Logs an unexpected error and returns a generic message.
 * Internal detail stays in the server log rather than going to the client.
 */
export function serverError(context: string, error: unknown): NextResponse {
  console.error(`[preventah] ${context}`, error);
  return fail('Something went wrong. Please try again.', 500);
}
