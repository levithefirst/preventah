/**
 * Day arithmetic for the loop.
 *
 * Everything the app counts is a UTC calendar day. Members carry an IANA
 * timezone, but it is used only to decide when their morning mail fires,
 * never to shift which day a check-in belongs to: two people in one
 * household must always be looking at the same board.
 */

/** UTC calendar day as YYYY-MM-DD. */
export function dayKeyOf(at: number = Date.now()): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** Whole UTC days since the epoch. The index plan rotation runs on. */
export function dayIndexOf(at: number = Date.now()): number {
  return Math.floor(at / 86_400_000);
}

export function previousDayKey(dayKey: string): string {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return dayKey;
  return dayKeyOf(at - 86_400_000);
}

/**
 * Local hour for an IANA zone, or null when the zone is unusable.
 * Falling back to null lets the caller decide, rather than guessing UTC
 * and mailing someone at 3am.
 */
export function localHour(timezone: string, at: number = Date.now()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(at));
    const hour = parts.find((part) => part.type === 'hour')?.value;
    if (hour === undefined) return null;
    const parsed = Number.parseInt(hour, 10);
    return Number.isFinite(parsed) ? parsed % 24 : null;
  } catch {
    return null;
  }
}

export function isValidTimezone(value: string): boolean {
  return localHour(value) !== null;
}
