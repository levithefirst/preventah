import {
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
  buildReminderIcs,
} from '@/lib/ics';
import { todayIso } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Daily occurrences in the generated series. */
const OCCURRENCES = 30;

/**
 * The daily reminder, as a calendar file.
 *
 * Deliberately unauthenticated, and deliberately carrying nothing derived
 * from a user.
 *
 * It used to require a session and stamp the event UID with the user's
 * stake id. Both were mistakes:
 *
 *  - The session made the endpoint useless at the exact moment it needed to
 *    work. A WebView that cannot render text/calendar hands the URL to a
 *    download manager or an external browser, neither of which carries the
 *    Mini App's cookie, so the user got "Not signed in." instead of a
 *    calendar entry.
 *  - The stake id put a correlator into a file that syncs to a user's other
 *    devices and is sometimes visible to a household, which is the opposite
 *    of what this file is supposed to be.
 *
 * The response is now a pure function of the query string. There is nothing
 * in it worth authenticating: a time of day, a generic title, and a
 * recurrence rule. No health data, no wallet address, no commitment
 * amount, no stake reference.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hour = Number(params.get('hour') ?? DEFAULT_REMINDER_HOUR);
  const minute = Number(params.get('minute') ?? DEFAULT_REMINDER_MINUTE);

  const ics = buildReminderIcs({
    hour,
    minute,
    startDate: todayIso(),
    occurrences: OCCURRENCES,
    // Stable for a given reminder time, so re-importing the same reminder
    // updates the existing entry rather than stacking a second daily alarm.
    // Derived from the requested time only: nothing here identifies anyone.
    uidSuffix: uidFor(hour, minute),
  });

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      /*
        inline, not attachment.

        `attachment` forces the WebView's download path, which on Android
        does nothing at all unless the host app has installed a
        DownloadListener. `inline` lets an engine that understands
        text/calendar hand it straight to the calendar app, which is what
        iOS does, and leaves the filename available for everything else.
      */
      'content-disposition': 'inline; filename="preventah-checkin.ics"',
      'cache-control': 'no-store',
    },
  });
}

/** `0800`-style suffix. Padded so the UID is stable regardless of input form. */
function uidFor(hour: number, minute: number): string {
  const safe = (value: number, max: number) =>
    Number.isFinite(value) && value >= 0 && value <= max
      ? String(Math.floor(value)).padStart(2, '0')
      : '00';
  return `${safe(hour, 23)}${safe(minute, 59)}`;
}
