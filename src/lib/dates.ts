/**
 * Total date helpers for calendar dates (no time component).
 *
 * Every function here returns null rather than throwing. That matters
 * because `new Date(NaN).toISOString()` raises `RangeError: Invalid time
 * value`, and one of those inside a React render unmounts the entire tree.
 * Inside a WebView that surfaces as the host's generic "couldn't load"
 * page, indistinguishable from a network failure.
 *
 * These are deliberately permissive about input shape: a Postgres `date`
 * column reaches the client as a full ISO timestamp once it has been
 * through a driver and JSON.stringify, so "2026-09-18" and
 * "2026-09-18T00:00:00.000Z" must both be accepted and normalise to the
 * same calendar day.
 */

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Normalises any date-ish value to YYYY-MM-DD, or null if unusable. */
export function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (PLAIN_DATE.test(trimmed)) {
    // Still parse it: 2026-13-45 matches the shape but is not a real date.
    return Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ? null : trimmed;
  }

  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

/** The calendar date `days` after `value`, or null if either is unusable. */
export function addUtcDays(value: unknown, days: number): string | null {
  const iso = toIsoDate(value);
  if (iso === null || !Number.isFinite(days)) return null;

  const ms = Date.parse(`${iso}T00:00:00Z`) + Math.trunc(days) * MS_PER_DAY;
  if (Number.isNaN(ms)) return null;

  const next = new Date(ms);
  return Number.isNaN(next.getTime()) ? null : next.toISOString().slice(0, 10);
}

/** Day of week, 0 = Sunday, in UTC. Null if the date is unusable. */
export function utcDayOfWeek(value: unknown): number | null {
  const iso = toIsoDate(value);
  if (iso === null) return null;

  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
}

/** Today as YYYY-MM-DD, in UTC. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whole days from today until `value`, counting today. Never negative.
 * Null when the date cannot be read, so callers show a fallback rather
 * than rendering NaN.
 */
export function daysUntilInclusive(
  value: unknown,
  now: Date = new Date(),
): number | null {
  const iso = toIsoDate(value);
  if (iso === null) return null;

  const end = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.parse(`${todayIso(now)}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(today)) return null;

  return Math.max(0, Math.round((end - today) / MS_PER_DAY) + 1);
}

/**
 * Whether a calendar day falls inside a commitment window, inclusive of
 * both ends.
 *
 * A stake stays 'active' until the daily settlement job runs, which can be
 * up to 24 hours after its window closes. Without this bound a check-in
 * recorded in that gap still counts toward target_days, turning a missed
 * window into a paid reward. The database enforces the same rule inside the
 * INSERT; this is the readable statement of it.
 */
export function isWithinCommitmentWindow(
  day: unknown,
  startsOn: unknown,
  endsOn: unknown,
): boolean {
  const today = toIsoDate(day);
  const start = toIsoDate(startsOn);
  const end = toIsoDate(endsOn);
  if (today === null || start === null || end === null) return false;
  // ISO date strings compare correctly as plain strings.
  return today >= start && today <= end;
}
