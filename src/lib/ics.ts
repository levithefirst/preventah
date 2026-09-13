/**
 * Daily reminder, as an iCalendar file.
 *
 * Deliberately the boring standards-based option. No Google OAuth, no
 * calendar API, no stored refresh token and no third-party scope on
 * anybody's account: a text/calendar file that iOS Calendar, Google
 * Calendar and Outlook all import natively.
 *
 * Nothing health-related goes in the file. A calendar entry syncs to
 * laptops, gets read off a lock screen and is sometimes shared with a
 * household, so the event says "Preventah check-in" and nothing about
 * which conditions anyone selected.
 *
 * Times are deliberately floating: DTSTART carries no Z and no TZID, which
 * RFC 5545 defines as local time on whichever device renders it. For a
 * daily habit reminder that is exactly right, and it means the app never
 * has to ask for or store a timezone.
 */

export interface ReminderOptions {
  /** Local hour, 0-23. */
  hour: number;
  /** Local minute, 0-59. */
  minute: number;
  /** First day the reminder fires, as YYYY-MM-DD. */
  startDate: string;
  /** How many daily occurrences. */
  occurrences: number;
  /**
   * Stable, non-identifying suffix for the event UID, so re-importing
   * updates the existing entry instead of stacking duplicates.
   */
  uidSuffix: string;
}

export const DEFAULT_REMINDER_HOUR = 8;
export const DEFAULT_REMINDER_MINUTE = 0;
/** Long enough to cover a commitment window and a fresh one after it. */
export const MAX_OCCURRENCES = 365;

/** RFC 5545 escaping for TEXT values. Order matters: backslash first. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds a content line to 75 octets, as RFC 5545 requires.
 *
 * Measured in octets rather than characters, because a multi-byte
 * character split across a fold boundary corrupts the file. The
 * continuation marker is CRLF followed by a single space.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  // First line allows 75 octets; continuations allow 74 plus the space.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = char;
      bytes = size;
      limit = 74;
    } else {
      current += char;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads a date-only string into its parts, or null if it is not one. */
function dateParts(value: string): { y: string; m: string; d: string } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  return { y: match[1], m: match[2], d: match[3] };
}

/** UTC timestamp form, used only for DTSTAMP which must be absolute. */
function utcStamp(now: Date): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

/**
 * Builds the calendar file.
 *
 * Total: out-of-range or unparseable input falls back to a sensible
 * default rather than throwing, because this runs in a route handler and a
 * malformed query string should produce a usable reminder, not a 500.
 */
export function buildReminderIcs(
  options: ReminderOptions,
  now: Date = new Date(),
): string {
  const hour = clampInt(options.hour, 0, 23, DEFAULT_REMINDER_HOUR);
  const minute = clampInt(options.minute, 0, 59, DEFAULT_REMINDER_MINUTE);
  const occurrences = clampInt(options.occurrences, 1, MAX_OCCURRENCES, 30);

  const parts = dateParts(options.startDate);
  const start = parts ?? dateParts(now.toISOString().slice(0, 10))!;
  const dtStart = `${start.y}${start.m}${start.d}T${pad(hour)}${pad(minute)}00`;

  // Keep the UID opaque and free of anything a calendar-reader could tie
  // to a person: no address, no condition, no email.
  const uid = `preventah-checkin-${options.uidSuffix}@preventah.app`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Preventah//Daily check-in//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${dtStart}`,
    'DURATION:PT10M',
    `RRULE:FREQ=DAILY;COUNT=${occurrences}`,
    `SUMMARY:${escapeText('Preventah check-in')}`,
    `DESCRIPTION:${escapeText("Do today's plan, then open Preventah and check in.")}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText('Preventah check-in')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF throughout, and a trailing one, as the spec requires.
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
