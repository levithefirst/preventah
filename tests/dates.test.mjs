import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toIsoDate,
  addUtcDays,
  utcDayOfWeek,
  todayIso,
  daysUntilInclusive,
} from '../src/lib/dates.ts';

/**
 * The exact value that crashed production. A Postgres `date` column reaches
 * the client as a full ISO timestamp once it has passed through the driver
 * and JSON.stringify. The old code appended 'T00:00:00Z' to it, producing
 * "2026-09-18T00:00:00.000ZT00:00:00Z", which parses to NaN, and
 * new Date(NaN).toISOString() throws RangeError: Invalid time value.
 */
const CRASHING_VALUE = '2026-09-18T00:00:00.000Z';

test('regression: a full ISO timestamp normalises instead of throwing', () => {
  assert.equal(toIsoDate(CRASHING_VALUE), '2026-09-18');
  assert.doesNotThrow(() => addUtcDays(CRASHING_VALUE, -6));
  assert.equal(addUtcDays(CRASHING_VALUE, -6), '2026-09-12');
});

test('regression: the full 7-day streak window resolves from a timestamp', () => {
  const start = addUtcDays(CRASHING_VALUE, -6);
  assert.equal(start, '2026-09-12');

  const window = Array.from({ length: 7 }, (_, i) => addUtcDays(start, i));
  assert.deepEqual(window, [
    '2026-09-12',
    '2026-09-13',
    '2026-09-14',
    '2026-09-15',
    '2026-09-16',
    '2026-09-17',
    '2026-09-18',
  ]);
  assert.ok(window.every((d) => d !== null));
});

test('a plain calendar date passes through unchanged', () => {
  assert.equal(toIsoDate('2026-09-18'), '2026-09-18');
  assert.equal(addUtcDays('2026-09-18', 1), '2026-09-19');
  assert.equal(addUtcDays('2026-09-18', -1), '2026-09-17');
  assert.equal(addUtcDays('2026-09-18', 0), '2026-09-18');
});

test('a Date object is accepted, as the driver may hand one over', () => {
  assert.equal(toIsoDate(new Date('2026-09-18T00:00:00.000Z')), '2026-09-18');
  assert.equal(toIsoDate(new Date(NaN)), null);
});

test('unusable values return null rather than throwing', () => {
  for (const bad of [
    null,
    undefined,
    '',
    '   ',
    'not-a-date',
    '2026-13-45',
    {},
    [],
    42,
    NaN,
    '0000-00-00',
  ]) {
    assert.doesNotThrow(() => toIsoDate(bad), `toIsoDate(${String(bad)})`);
    assert.equal(toIsoDate(bad), null, `toIsoDate(${String(bad)})`);
    assert.doesNotThrow(() => addUtcDays(bad, 3));
    assert.equal(addUtcDays(bad, 3), null);
    assert.doesNotThrow(() => utcDayOfWeek(bad));
    assert.equal(utcDayOfWeek(bad), null);
    assert.doesNotThrow(() => daysUntilInclusive(bad));
    assert.equal(daysUntilInclusive(bad), null);
  }
});

test('a non-finite day offset cannot produce an invalid date', () => {
  for (const days of [NaN, Infinity, -Infinity]) {
    assert.doesNotThrow(() => addUtcDays('2026-09-18', days));
    assert.equal(addUtcDays('2026-09-18', days), null);
  }
});

test('day of week is correct and in UTC', () => {
  // 2026-09-18 is a Friday.
  assert.equal(utcDayOfWeek('2026-09-18'), 5);
  assert.equal(utcDayOfWeek(CRASHING_VALUE), 5);
});

test('daysUntilInclusive counts today and never goes negative', () => {
  const now = new Date('2026-09-13T09:00:00Z');
  assert.equal(daysUntilInclusive('2026-09-13', now), 1);
  assert.equal(daysUntilInclusive('2026-09-18', now), 6);
  // A window that has already closed reports 0, not a negative number.
  assert.equal(daysUntilInclusive('2026-09-01', now), 0);
  // And it must never yield NaN from a timestamp-shaped input.
  assert.equal(daysUntilInclusive(CRASHING_VALUE, now), 6);
});

test('todayIso returns a plain calendar date', () => {
  assert.match(todayIso(new Date('2026-09-13T23:59:59Z')), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayIso(new Date('2026-09-13T23:59:59Z')), '2026-09-13');
});

test('month and year boundaries roll correctly', () => {
  assert.equal(addUtcDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addUtcDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addUtcDays('2026-01-01', -1), '2025-12-31');
  // Leap day.
  assert.equal(addUtcDays('2028-02-28', 1), '2028-02-29');
});

// --- commitment window bound ----------------------------------------------

test('a check-in inside the window is allowed, on both boundaries', async () => {
  const { isWithinCommitmentWindow } = await import('../src/lib/dates.ts');
  const start = '2026-09-12';
  const end = '2026-09-18';

  assert.equal(isWithinCommitmentWindow(start, start, end), true, 'first day');
  assert.equal(isWithinCommitmentWindow('2026-09-15', start, end), true);
  assert.equal(isWithinCommitmentWindow(end, start, end), true, 'last day');
});

// A stake stays 'active' until the daily job settles it, so without this
// bound a late check-in would still count toward target_days and turn a
// missed window into a paid reward.
test('a check-in after the window closes is rejected', async () => {
  const { isWithinCommitmentWindow } = await import('../src/lib/dates.ts');
  assert.equal(
    isWithinCommitmentWindow('2026-09-19', '2026-09-12', '2026-09-18'),
    false,
  );
  assert.equal(
    isWithinCommitmentWindow('2026-10-01', '2026-09-12', '2026-09-18'),
    false,
  );
});

test('a check-in before the window opens is rejected', async () => {
  const { isWithinCommitmentWindow } = await import('../src/lib/dates.ts');
  assert.equal(
    isWithinCommitmentWindow('2026-09-11', '2026-09-12', '2026-09-18'),
    false,
  );
});

test('the window bound accepts timestamp-shaped values too', async () => {
  const { isWithinCommitmentWindow } = await import('../src/lib/dates.ts');
  // started_at is a timestamptz and ends_on came back as a timestamp before
  // the to_char fix; neither shape may silently disable the bound.
  assert.equal(
    isWithinCommitmentWindow(
      '2026-09-15T09:30:00.000Z',
      '2026-09-12T14:25:15.303Z',
      '2026-09-18T00:00:00.000Z',
    ),
    true,
  );
  assert.equal(
    isWithinCommitmentWindow(
      '2026-09-19T00:00:01.000Z',
      '2026-09-12T14:25:15.303Z',
      '2026-09-18T00:00:00.000Z',
    ),
    false,
  );
});

test('an unreadable date fails closed rather than open', async () => {
  const { isWithinCommitmentWindow } = await import('../src/lib/dates.ts');
  for (const bad of [null, undefined, '', 'nonsense', {}, NaN]) {
    assert.equal(isWithinCommitmentWindow(bad, '2026-09-12', '2026-09-18'), false);
    assert.equal(isWithinCommitmentWindow('2026-09-15', bad, '2026-09-18'), false);
    assert.equal(isWithinCommitmentWindow('2026-09-15', '2026-09-12', bad), false);
  }
});
