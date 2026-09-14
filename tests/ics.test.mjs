import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_REMINDER_HOUR,
  MAX_OCCURRENCES,
  buildReminderIcs,
  foldLine,
} from '../src/lib/ics.ts';

const NOW = new Date('2026-09-13T10:30:00Z');

function build(overrides = {}) {
  return buildReminderIcs(
    {
      hour: 8,
      minute: 0,
      startDate: '2026-09-13',
      occurrences: 7,
      uidSuffix: 'test',
      ...overrides,
    },
    NOW,
  );
}

function lines(ics) {
  // Unfold first: a folded line continues with CRLF followed by a space.
  return ics.replace(/\r\n /g, '').split('\r\n');
}

test('produces a well-formed VCALENDAR', () => {
  const ics = build();
  const out = lines(ics);
  assert.equal(out[0], 'BEGIN:VCALENDAR');
  assert.ok(out.includes('VERSION:2.0'));
  assert.ok(out.includes('BEGIN:VEVENT'));
  assert.ok(out.includes('END:VEVENT'));
  // A trailing CRLF leaves an empty final element.
  assert.equal(out[out.length - 2], 'END:VCALENDAR');
  assert.equal(out[out.length - 1], '');
});

test('every line ends with CRLF, never a bare LF', () => {
  const ics = build();
  assert.ok(ics.endsWith('\r\n'));
  assert.equal(ics.split('\n').length - 1, ics.split('\r\n').length - 1);
});

test('BEGIN and END blocks are balanced', () => {
  const out = lines(build());
  const begins = out.filter((l) => l.startsWith('BEGIN:'));
  const ends = out.filter((l) => l.startsWith('END:'));
  assert.equal(begins.length, ends.length);
  assert.deepEqual(
    begins.map((l) => l.slice(6)).reverse(),
    ends.map((l) => l.slice(4)),
  );
});

test('the start time is floating local, with no Z and no TZID', () => {
  const out = lines(build({ hour: 8, minute: 5 }));
  const dtstart = out.find((l) => l.startsWith('DTSTART'));
  assert.equal(dtstart, 'DTSTART:20260913T080500');
  assert.ok(!dtstart.includes('Z'), 'a floating time must not be UTC');
  assert.ok(!dtstart.includes('TZID'), 'a floating time must carry no timezone');
});

test('DTSTAMP is absolute UTC, as the spec requires', () => {
  const out = lines(build());
  const dtstamp = out.find((l) => l.startsWith('DTSTAMP'));
  assert.equal(dtstamp, 'DTSTAMP:20260913T103000Z');
});

test('single-digit hours and minutes are zero padded', () => {
  const out = lines(build({ hour: 7, minute: 5 }));
  assert.ok(out.includes('DTSTART:20260913T070500'));
});

test('the recurrence is daily for the requested count', () => {
  const out = lines(build({ occurrences: 5 }));
  assert.ok(out.includes('RRULE:FREQ=DAILY;COUNT=5'));
});

test('the file carries no health data and no address', () => {
  const ics = build().toLowerCase();
  for (const leak of [
    'diabetes',
    'cancer',
    'blood pressure',
    'hypertension',
    'condition',
    '0x',
    'wallet',
    'stake',
  ]) {
    assert.ok(!ics.includes(leak), `the calendar file mentions "${leak}"`);
  }
  assert.ok(build().includes('SUMMARY:Preventah check-in'));
});

test('the UID is stable for the same suffix, so re-importing updates', () => {
  const first = lines(build({ uidSuffix: 'abc' })).find((l) => l.startsWith('UID:'));
  const second = lines(build({ uidSuffix: 'abc' })).find((l) => l.startsWith('UID:'));
  const other = lines(build({ uidSuffix: 'xyz' })).find((l) => l.startsWith('UID:'));
  assert.equal(first, second);
  assert.notEqual(first, other);
});

test('out-of-range input falls back rather than throwing', () => {
  for (const hour of [-1, 24, 99, NaN, Infinity]) {
    const out = lines(build({ hour }));
    const dtstart = out.find((l) => l.startsWith('DTSTART'));
    assert.equal(dtstart, `DTSTART:20260913T0${DEFAULT_REMINDER_HOUR}0000`);
  }
  for (const minute of [-1, 60, NaN]) {
    assert.ok(lines(build({ minute })).some((l) => l.endsWith('T080000')));
  }
});

test('the occurrence count is clamped to something a calendar will accept', () => {
  assert.ok(lines(build({ occurrences: 0 })).includes('RRULE:FREQ=DAILY;COUNT=30'));
  assert.ok(lines(build({ occurrences: -5 })).includes('RRULE:FREQ=DAILY;COUNT=30'));
  assert.ok(
    lines(build({ occurrences: 99999 })).includes('RRULE:FREQ=DAILY;COUNT=30'),
    'beyond the maximum falls back rather than emitting a huge recurrence',
  );
  assert.ok(
    lines(build({ occurrences: MAX_OCCURRENCES })).includes(
      `RRULE:FREQ=DAILY;COUNT=${MAX_OCCURRENCES}`,
    ),
  );
});

test('a malformed start date falls back to today rather than throwing', () => {
  for (const startDate of ['', 'tomorrow', '13/09/2026', '2026-9-3']) {
    const out = lines(build({ startDate }));
    assert.ok(
      out.some((l) => l === 'DTSTART:20260913T080000'),
      `start date ${JSON.stringify(startDate)} did not fall back to today`,
    );
  }
});

test('building never throws on hostile input', () => {
  assert.doesNotThrow(() =>
    buildReminderIcs(
      {
        hour: NaN,
        minute: NaN,
        startDate: '',
        occurrences: NaN,
        uidSuffix: '',
      },
      NOW,
    ),
  );
});

// --- line folding ----------------------------------------------------------

test('short lines are left alone', () => {
  assert.equal(foldLine('SUMMARY:Short'), 'SUMMARY:Short');
  assert.equal(foldLine('x'.repeat(75)), 'x'.repeat(75));
});

test('long lines fold at 75 octets with a leading space continuation', () => {
  const folded = foldLine(`SUMMARY:${'a'.repeat(200)}`);
  const parts = folded.split('\r\n');
  assert.ok(parts.length > 1);
  assert.equal(Buffer.byteLength(parts[0]), 75);
  for (const part of parts.slice(1)) {
    assert.ok(part.startsWith(' '), 'continuations must begin with a space');
    assert.ok(Buffer.byteLength(part) <= 75);
  }
  // Unfolding must restore the original exactly.
  assert.equal(folded.replace(/\r\n /g, ''), `SUMMARY:${'a'.repeat(200)}`);
});

test('folding counts octets, so a multi-byte character is never split', () => {
  const line = `SUMMARY:${'é'.repeat(100)}`;
  const folded = foldLine(line);
  for (const part of folded.split('\r\n')) {
    assert.ok(Buffer.byteLength(part) <= 75, 'a folded segment exceeded 75 octets');
  }
  assert.equal(folded.replace(/\r\n /g, ''), line);
  // A split multi-byte character would show up as a replacement character.
  assert.ok(!folded.includes('�'));
});

// --- the route ------------------------------------------------------------

/*
  The reminder endpoint must stay unauthenticated.

  It used to require a session, which broke it at exactly the moment it
  mattered: a WebView that cannot render text/calendar hands the URL to a
  download manager or an external browser, neither of which carries the Mini
  App's cookie, so the user got "Not signed in." instead of a reminder.

  There is nothing in the response worth authenticating: a time of day, a
  generic title and a recurrence rule.
*/
test('the reminder route requires no session and reads no user data', () => {
  const route = readFileSync('src/app/api/reminder.ics/route.ts', 'utf8');

  assert.ok(!route.includes('requireUser'), 'must not require a session');
  assert.ok(!route.includes('getActiveStake'), 'must not read the stake');
  assert.ok(!route.includes('@/lib/repo'), 'must not touch the database');
  assert.ok(!route.includes('401'), 'must not have an unauthorised path');
});

/*
  The event UID must carry no correlator.

  It used to be stamped with the user's stake id, which put a unique handle
  into a file that syncs to a user's other devices and is sometimes visible
  to a household. It is derived from the requested time alone now, which is
  still stable enough that re-importing updates the entry rather than
  stacking a second daily alarm.
*/
test('the UID is derived from the reminder time, not from the user', () => {
  const route = readFileSync('src/app/api/reminder.ics/route.ts', 'utf8');
  assert.ok(route.includes('uidSuffix: uidFor(hour, minute)'));
  assert.ok(!/uidSuffix:\s*stake/.test(route));
  assert.ok(!route.includes('stake.id'));
});

/*
  Content-Disposition must not be `attachment`.

  `attachment` forces the WebView download path, which on Android does
  nothing at all unless the host app installed a DownloadListener. That is
  what made the old button silently swallow the tap.
*/
test('the response is served inline, not as a forced download', () => {
  const route = readFileSync('src/app/api/reminder.ics/route.ts', 'utf8');

  assert.ok(route.includes("'text/calendar; charset=utf-8'"));
  assert.ok(route.includes('inline; filename='));
  assert.ok(
    !/content-disposition[^\n]*attachment/i.test(route),
    'attachment routes into the WebView download path',
  );
});

/*
  And the button must not reintroduce the download attribute, which is the
  other half of the same failure.
*/
test('the reminder button does not depend on a download', () => {
  const card = readFileSync('src/components/ReminderCard.tsx', 'utf8');

  assert.ok(!/\bdownload\b(?!\s)/.test(card.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the download attribute is swallowed by Android WebViews');
  assert.ok(card.includes('webcal://'), 'the primary action uses the webcal scheme');
  // No success state: the page cannot observe whether the OS accepted it.
  assert.ok(!/Added to calendar/i.test(card));
});
