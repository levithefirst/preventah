import type { Id } from '../convex/_generated/dataModel';

/**
 * Who this browser is.
 *
 * A member id in localStorage, nothing more. This is a household app
 * without accounts: enough to come back to your own row, and explicitly
 * not an authentication boundary. The UI says so rather than implying a
 * security property it does not have.
 */

const MEMBER_KEY = 'allgas.memberId';
const HOUSEHOLD_KEY = 'allgas.householdId';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode, blocked storage. The session simply does not persist.
  }
}

export interface Session {
  memberId: Id<'members'>;
  householdId: Id<'households'>;
}

export function loadSession(): Session | null {
  const memberId = read(MEMBER_KEY);
  const householdId = read(HOUSEHOLD_KEY);
  if (!memberId || !householdId) return null;
  return { memberId: memberId as Id<'members'>, householdId: householdId as Id<'households'> };
}

export function saveSession(session: Session): void {
  write(MEMBER_KEY, session.memberId);
  write(HOUSEHOLD_KEY, session.householdId);
}

export function clearSession(): void {
  write(MEMBER_KEY, null);
  write(HOUSEHOLD_KEY, null);
}

export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
