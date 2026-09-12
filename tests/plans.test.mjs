import test from 'node:test';
import assert from 'node:assert/strict';

import { CONDITION_KEYS, sanitizeConditionKeys } from '../src/lib/conditions.ts';
import {
  getDailyPlan,
  dayIndexSince,
  SLOTS_PER_CATEGORY,
} from '../src/lib/plans.ts';

/** Every non-empty subset of the six categories. 63 combinations. */
function allSubsets() {
  const out = [];
  for (let mask = 1; mask < 1 << CONDITION_KEYS.length; mask += 1) {
    out.push(CONDITION_KEYS.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

test('resolves a complete plan for every subset over a full year of days', () => {
  for (const subset of allSubsets()) {
    for (let day = 0; day < 366; day += 1) {
      const plan = getDailyPlan(subset, day);
      for (const slot of ['diet', 'exercise', 'habit']) {
        assert.equal(
          typeof plan[slot].text,
          'string',
          `${slot} missing for ${subset} day ${day}`,
        );
        assert.ok(plan[slot].text.length > 0);
        assert.ok(subset.includes(plan[slot].sourceKey));
      }
      assert.equal(plan.isBaseline, false);
    }
  }
});

test('falls back to a baseline plan when nothing is selected', () => {
  for (let day = 0; day < 30; day += 1) {
    const plan = getDailyPlan([], day);
    assert.equal(plan.isBaseline, true);
    assert.equal(plan.diet.sourceKey, null);
    assert.ok(plan.exercise.text.length > 0);
  }
});

test('is deterministic: same inputs give the same plan', () => {
  const subset = ['cardiovascular', 'osteoporosis'];
  for (let day = 0; day < 50; day += 1) {
    assert.deepEqual(getDailyPlan(subset, day), getDailyPlan(subset, day));
  }
});

test('does not depend on the order keys arrive in', () => {
  const a = getDailyPlan(['osteoporosis', 'cardiovascular'], 3);
  const b = getDailyPlan(['cardiovascular', 'osteoporosis'], 3);
  assert.deepEqual(a, b);
});

test('survives hostile day indexes instead of throwing', () => {
  for (const day of [-1, -999, NaN, Infinity, 1.7, 0]) {
    const plan = getDailyPlan(['hypertension'], day);
    assert.ok(plan.diet.text.length > 0);
    assert.ok(Number.isInteger(plan.dayIndex) && plan.dayIndex >= 0);
  }
});

test('rotates content across a 7-day commitment window', () => {
  const texts = new Set();
  for (let day = 0; day < SLOTS_PER_CATEGORY; day += 1) {
    texts.add(getDailyPlan(['type2_diabetes'], day).diet.text);
  }
  assert.equal(texts.size, SLOTS_PER_CATEGORY, 'each day should differ');
});

test('blends categories across slots for a multi-select profile', () => {
  const plan = getDailyPlan(['cardiovascular', 'type2_diabetes'], 0);
  assert.notEqual(plan.diet.sourceKey, plan.exercise.sourceKey);
});

test('sanitizeConditionKeys rejects free text and unknown keys', () => {
  assert.deepEqual(sanitizeConditionKeys(['cardiovascular', 'i have a headache']), [
    'cardiovascular',
  ]);
  assert.deepEqual(sanitizeConditionKeys('cardiovascular'), []);
  assert.deepEqual(sanitizeConditionKeys(null), []);
  assert.deepEqual(sanitizeConditionKeys([{ evil: true }, 42]), []);
  // Duplicates collapse, order is canonical.
  assert.deepEqual(
    sanitizeConditionKeys(['osteoporosis', 'cardiovascular', 'osteoporosis']),
    ['cardiovascular', 'osteoporosis'],
  );
});

test('dayIndexSince counts UTC days from the start date', () => {
  const start = new Date('2026-09-01T22:00:00Z');
  assert.equal(dayIndexSince(start, new Date('2026-09-01T23:59:00Z')), 0);
  assert.equal(dayIndexSince(start, new Date('2026-09-02T00:01:00Z')), 1);
  assert.equal(dayIndexSince(start, new Date('2026-09-08T12:00:00Z')), 7);
  // A clock skewed into the past must not produce a negative index.
  assert.equal(dayIndexSince(start, new Date('2026-08-20T12:00:00Z')), 0);
});
