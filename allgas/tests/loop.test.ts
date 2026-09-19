import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getDailyPlan } from '../convex/lib/plans.ts';
import { withTiers, TIERS } from '../convex/lib/tiers.ts';
import { sanitizeConditionIds, MAX_SELECTIONS } from '../convex/lib/conditions.ts';
import { CONDITION_COUNT, searchConditions } from '../convex/lib/conditionIndex.ts';
import { dayKeyOf, previousDayKey, localHour } from '../convex/lib/day.ts';
import { normalizeJoinCode } from '../convex/lib/joincode.ts';

/**
 * The loop's pure core. Everything here runs without a deployment, which
 * is the point: resolving a day's plan must never depend on the network.
 */

test('a plan resolves for any input, including nonsense', () => {
  for (const input of [[], ['not_a_condition'], ['hypertension'], ['hypertension', 'nope']]) {
    for (const day of [0, 1, 7, -3, Number.NaN]) {
      const plan = getDailyPlan(input, day);
      assert.ok(plan.diet && plan.exercise && plan.habit);
      assert.equal(plan.diet.type, 'diet');
      assert.equal(plan.exercise.type, 'exercise');
      assert.equal(plan.habit.type, 'habit');
    }
  }
});

test('the same selections and day always give the same plan', () => {
  const a = getDailyPlan(['hypertension', 'type2_diabetes'], 5);
  const b = getDailyPlan(['hypertension', 'type2_diabetes'], 5);
  assert.deepEqual(
    [a.diet.id, a.exercise.id, a.habit.id],
    [b.diet.id, b.exercise.id, b.habit.id],
  );
});

test('an empty selection is flagged as the baseline plan', () => {
  assert.equal(getDailyPlan([], 0).isBaseline, true);
  assert.equal(getDailyPlan(['hypertension'], 0).isBaseline, false);
});

test('every action offers all three tiers, free first', () => {
  const plan = getDailyPlan(['coronary_artery_disease'], 2);
  for (const item of [plan.diet, plan.exercise, plan.habit]) {
    const tiered = withTiers(item);
    assert.deepEqual(tiered.options.map((option) => option.tier), [...TIERS]);
    assert.equal(tiered.options[0].tier, 'free');
    for (const option of tiered.options) {
      assert.ok(option.title.length > 0, `${tiered.id} ${option.tier} has no title`);
      assert.ok(option.costHint.length > 0, `${tiered.id} ${option.tier} has no cost hint`);
    }
  }
});

test('the free tier is the action target, never a teaser', () => {
  const plan = getDailyPlan(['osteoporosis'], 1);
  const tiered = withTiers(plan.exercise);
  assert.equal(tiered.options[0].title, plan.exercise.target);
});

test('the sanitizer is the trust boundary', () => {
  assert.deepEqual(sanitizeConditionIds('not an array'), []);
  assert.deepEqual(sanitizeConditionIds([1, null, {}, 'nope']), []);
  assert.deepEqual(sanitizeConditionIds(['hypertension']), ['hypertension']);
  // Legacy key from the pre-catalog checklist still upgrades.
  assert.deepEqual(sanitizeConditionIds(['cardiovascular']), ['coronary_artery_disease']);
  // Duplicates collapse and the cap holds.
  const many = searchConditions('', {}).map((entry) => entry.id);
  assert.equal(sanitizeConditionIds([...many, ...many]).length, MAX_SELECTIONS);
});

test('the catalog is non-trivial and searchable', () => {
  assert.ok(CONDITION_COUNT > 100, `only ${CONDITION_COUNT} conditions`);
  const hits = searchConditions('hyp', { limit: 5 });
  assert.ok(hits.length > 0);
  assert.equal(hits[0].id, 'hypertension');
});

test('day keys are UTC and walk backwards correctly', () => {
  assert.equal(dayKeyOf(Date.parse('2026-03-01T00:00:00Z')), '2026-03-01');
  assert.equal(previousDayKey('2026-03-01'), '2026-02-28');
  assert.equal(previousDayKey('2024-03-01'), '2024-02-29');
  assert.equal(previousDayKey('garbage'), 'garbage');
});

test('an unusable timezone reports null rather than guessing UTC', () => {
  assert.equal(localHour('Not/AZone'), null);
  assert.equal(typeof localHour('UTC'), 'number');
});

test('join codes normalise to the readable alphabet', () => {
  assert.equal(normalizeJoinCode('abc234'), 'ABC234');
  assert.equal(normalizeJoinCode('a-b c 2 3 4 5 6'), 'ABC234');
  assert.equal(normalizeJoinCode('OIL01'), 'L');
});
