import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_UNITS,
  MEASUREMENTS,
  MEASUREMENT_KINDS,
  defaultUnitFor,
  describeTrend,
  formatMeasurement,
  getMeasurementSpec,
  isMeasurementKind,
  validateMeasurement,
} from '../src/lib/measurements.ts';

const TODAY = '2026-09-13';

function valid(input) {
  const result = validateMeasurement(input, TODAY);
  assert.ok(result.ok, `expected valid, got: ${result.ok ? '' : result.error}`);
  return result.value;
}

function invalid(input) {
  const result = validateMeasurement(input, TODAY);
  assert.equal(result.ok, false, 'expected invalid');
  assert.ok(result.error.length > 0, 'an error message is required');
  return result.error;
}

test('every kind has a spec, a prompt, help and at least one unit', () => {
  assert.equal(MEASUREMENTS.length, MEASUREMENT_KINDS.length);
  for (const kind of MEASUREMENT_KINDS) {
    const spec = getMeasurementSpec(kind);
    assert.ok(spec, `${kind} has no spec`);
    assert.equal(spec.kind, kind);
    assert.ok(spec.label.length > 0);
    assert.ok(spec.prompt.length > 0);
    assert.ok(spec.help.length > 0);
    assert.ok(spec.units.length > 0);
    for (const unit of spec.units) {
      assert.ok(unit.min < unit.max, `${kind}/${unit.unit} has an empty range`);
      assert.ok(ALLOWED_UNITS.includes(unit.unit));
      assert.ok(Number.isInteger(unit.decimals) && unit.decimals >= 0);
    }
    assert.equal(defaultUnitFor(kind), spec.units[0].unit);
  }
});

test('blood pressure is the only paired reading', () => {
  const paired = MEASUREMENTS.filter((spec) => spec.secondary);
  assert.deepEqual(
    paired.map((spec) => spec.kind),
    ['blood_pressure'],
  );
});

test('the kind guard rejects anything not in the list', () => {
  assert.equal(isMeasurementKind('weight'), true);
  assert.equal(isMeasurementKind('mood'), false);
  assert.equal(isMeasurementKind(null), false);
  assert.equal(isMeasurementKind(42), false);
  assert.equal(getMeasurementSpec('nope'), undefined);
});

test('a straightforward reading validates and rounds', () => {
  const result = valid({ kind: 'weight', unit: 'kg', value: '82.46', measuredOn: TODAY });
  assert.equal(result.kind, 'weight');
  assert.equal(result.unit, 'kg');
  assert.equal(result.value, 82.5);
  assert.equal(result.valueSecondary, null);
  assert.equal(result.measuredOn, TODAY);
});

test('numbers arrive as strings from a form and as numbers from JSON', () => {
  assert.equal(valid({ kind: 'resting_heart_rate', value: '58' }).value, 58);
  assert.equal(valid({ kind: 'resting_heart_rate', value: 58 }).value, 58);
  assert.equal(valid({ kind: 'weight', value: ' 70.2 ' }).value, 70.2);
});

test('the date defaults to today and cannot be in the future', () => {
  assert.equal(valid({ kind: 'weight', value: 70 }).measuredOn, TODAY);
  assert.equal(valid({ kind: 'weight', value: 70, measuredOn: '2026-01-04' }).measuredOn, '2026-01-04');
  invalid({ kind: 'weight', value: 70, measuredOn: '2026-09-14' });
  invalid({ kind: 'weight', value: 70, measuredOn: 'tomorrow' });
  invalid({ kind: 'weight', value: 70, measuredOn: '13/09/2026' });
});

test('an unknown kind or unit is rejected', () => {
  invalid({ kind: 'mood', value: 5 });
  invalid({ kind: 'weight', unit: 'stone', value: 12 });
  invalid({ kind: 'resting_heart_rate', unit: 'kg', value: 60 });
});

test('non-numeric values are rejected rather than becoming NaN', () => {
  for (const value of ['', '   ', 'heavy', null, undefined, {}, [], NaN, Infinity]) {
    invalid({ kind: 'weight', value });
  }
});

test('out-of-range values are rejected with the bound named', () => {
  const error = invalid({ kind: 'weight', unit: 'kg', value: 7000 });
  assert.match(error, /between 20 and 400 kg/);
  invalid({ kind: 'weight', unit: 'kg', value: 2 });
  invalid({ kind: 'resting_heart_rate', value: 400 });
  invalid({ kind: 'sleep_hours', value: 25 });
  invalid({ kind: 'blood_glucose', unit: 'mmol/L', value: 900 });
});

test('each unit carries its own range', () => {
  // 200 lb is an ordinary weight; 200 kg is at the edge but allowed; the
  // ranges must not be shared between them.
  valid({ kind: 'weight', unit: 'lb', value: 200 });
  invalid({ kind: 'weight', unit: 'lb', value: 30 });
  valid({ kind: 'blood_glucose', unit: 'mg/dL', value: 100 });
  invalid({ kind: 'blood_glucose', unit: 'mmol/L', value: 100 });
});

test('blood pressure requires both numbers, systolic higher', () => {
  const bp = valid({ kind: 'blood_pressure', value: 128, valueSecondary: 82 });
  assert.equal(bp.value, 128);
  assert.equal(bp.valueSecondary, 82);
  assert.equal(bp.unit, 'mmHg');

  invalid({ kind: 'blood_pressure', value: 128 });
  invalid({ kind: 'blood_pressure', value: 128, valueSecondary: '' });
  invalid({ kind: 'blood_pressure', value: 128, valueSecondary: 'eighty' });
  // Transposed, which is the most likely real mistake.
  const swapped = invalid({ kind: 'blood_pressure', value: 82, valueSecondary: 128 });
  assert.match(swapped, /systolic/i);
  // Equal is not a plausible reading either.
  invalid({ kind: 'blood_pressure', value: 100, valueSecondary: 100 });
  // Diastolic out of its own range.
  invalid({ kind: 'blood_pressure', value: 250, valueSecondary: 220 });
});

test('a second number on a single-value kind is rejected, not silently dropped', () => {
  invalid({ kind: 'weight', value: 70, valueSecondary: 40 });
  // An absent or blank second field is fine, since forms send empty strings.
  valid({ kind: 'weight', value: 70, valueSecondary: '' });
  valid({ kind: 'weight', value: 70, valueSecondary: null });
  valid({ kind: 'weight', value: 70 });
});

test('validation never throws on a hostile payload', () => {
  for (const payload of [{}, { kind: {}, value: [] }, { kind: 'weight', value: { toString: null } }]) {
    assert.doesNotThrow(() => validateMeasurement(payload, TODAY));
    assert.equal(validateMeasurement(payload, TODAY).ok, false);
  }
});

test('formatting handles single and paired readings', () => {
  assert.equal(
    formatMeasurement({ kind: 'weight', unit: 'kg', value: 82.5, valueSecondary: null }),
    '82.5 kg',
  );
  assert.equal(
    formatMeasurement({ kind: 'blood_pressure', unit: 'mmHg', value: 128, valueSecondary: 82 }),
    '128 / 82 mmHg',
  );
  assert.equal(
    formatMeasurement({ kind: 'resting_heart_rate', unit: 'bpm', value: 58, valueSecondary: null }),
    '58 bpm',
  );
});

// --- trends ---------------------------------------------------------------

function point(measuredOn, value, unit = 'kg') {
  return { id: measuredOn, kind: 'weight', unit, value, valueSecondary: null, measuredOn };
}

test('a trend needs two points', () => {
  const empty = describeTrend([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.change, null);
  assert.equal(empty.latest, null);

  const one = describeTrend([point('2026-09-01', 80)]);
  assert.equal(one.count, 1);
  assert.equal(one.change, null);
  assert.equal(one.direction, null);
  assert.equal(one.latest.value, 80);
});

test('a trend reports direction and magnitude', () => {
  const down = describeTrend([point('2026-09-01', 82), point('2026-09-08', 80)]);
  assert.equal(down.direction, 'down');
  assert.equal(down.change, -2);
  assert.equal(down.count, 2);

  const up = describeTrend([point('2026-09-01', 80), point('2026-09-08', 82)]);
  assert.equal(up.direction, 'up');
  assert.equal(up.change, 2);

  const flat = describeTrend([point('2026-09-01', 80), point('2026-09-08', 80)]);
  assert.equal(flat.direction, 'flat');
  assert.equal(flat.change, 0);
});

test('a trend is computed oldest to newest whatever order it is given', () => {
  const forwards = describeTrend([point('2026-09-01', 82), point('2026-09-08', 80)]);
  const backwards = describeTrend([point('2026-09-08', 80), point('2026-09-01', 82)]);
  assert.equal(forwards.change, backwards.change);
  assert.equal(forwards.latest.measuredOn, '2026-09-08');
  assert.equal(backwards.latest.measuredOn, '2026-09-08');
});

test('a trend never compares across units', () => {
  // 80 kg then 176 lb is roughly no change, not a gain of 96.
  const mixed = describeTrend([
    point('2026-09-01', 80, 'kg'),
    point('2026-09-08', 176, 'lb'),
  ]);
  assert.equal(mixed.change, null, 'a single point in the newest unit has no trend');
  assert.equal(mixed.latest.unit, 'lb');
  assert.equal(mixed.count, 2);

  const twoInNewUnit = describeTrend([
    point('2026-09-01', 80, 'kg'),
    point('2026-09-08', 176, 'lb'),
    point('2026-09-15', 174, 'lb'),
  ]);
  assert.equal(twoInNewUnit.change, -2);
  assert.equal(twoInNewUnit.first.unit, 'lb');
});
