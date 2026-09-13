import {
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
  MAX_OCCURRENCES,
  buildReminderIcs,
} from '@/lib/ics';
import { todayIso } from '@/lib/dates';
import { requireUser } from '@/lib/api';
import { getActiveStake } from '@/lib/repo';
import { daysUntilInclusive } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The daily reminder, as a downloadable calendar file.
 *
 * Returns text/calendar rather than JSON, because the point is for the
 * WebView to hand the response to the operating system, which opens it in
 * whatever calendar app the user already has. No OAuth, no calendar API,
 * no token stored anywhere.
 *
 * The file contains no health data and no wallet address. A calendar entry
 * syncs to other devices and is sometimes visible to a household, so it
 * says "Preventah check-in" and nothing more.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return new Response('Not signed in.', { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const hour = Number(params.get('hour') ?? DEFAULT_REMINDER_HOUR);
  const minute = Number(params.get('minute') ?? DEFAULT_REMINDER_MINUTE);

  // Cover the rest of an active commitment, or a month for someone who has
  // not committed yet. buildReminderIcs clamps anything out of range.
  let occurrences = 30;
  let uidSuffix = 'general';
  try {
    const stake = await getActiveStake(user.id);
    if (stake) {
      uidSuffix = stake.id;
      occurrences = daysUntilInclusive(stake.ends_on) ?? 30;
    }
  } catch {
    // A reminder is worth having even if the stake lookup fails. Fall
    // through to the 30-day default rather than returning an error.
  }

  const ics = buildReminderIcs({
    hour,
    minute,
    startDate: todayIso(),
    occurrences: Math.min(Math.max(occurrences, 1), MAX_OCCURRENCES),
    uidSuffix,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="preventah-checkin.ics"',
      'cache-control': 'no-store',
    },
  });
}
