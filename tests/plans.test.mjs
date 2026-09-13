import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SELECTIONS,
  sanitizeConditionIds,
  upgradeLegacyKey,
} from '../src/lib/conditions.ts';
import { CONDITION_CATALOG } from '../src/lib/condition-catalog.ts';
import { PLAN_TAGS } from '../src/lib/condition-types.ts';
import { PLAN_CONTENT } from '../src/lib/plan-content.ts';
import {
  dayIndexSince,
  calendarDayIndex,
  getDailyPlan,
  matchingContent,
  PLAN_TYPES,
} from '../src/lib/plans.ts';

const SLOTS = ['diet', 'exercise', 'habit'];

function assertWellFormed(item, context) {
  assert.equal(typeof item.id, 'string', `${context}: no id`);
  assert.ok(item.title.length > 0, `${context}: empty title`);
  assert.ok(item.description.length > 0, `${context}: empty description`);
  assert.ok(item.why.length > 0, `${context}: empty why`);
  assert.ok(item.howTo.length > 0, `${context}: no steps`);
  assert.ok(item.benefit.length > 0, `${context}: empty benefit`);
  assert.ok(item.target.length > 0, `${context}: empty target`);
  assert.ok(
    item.safetyNote === null || item.safetyNote.length > 0,
    `${context}: blank safety note`,
  );
  assert.match(item.sourceUrl, /^https:\/\//, `${context}: bad source url`);
  assert.ok(item.sourceName.length > 0, `${context}: no source name`);
}

// --- the content library itself -------------------------------------------

test('every plan item is complete and well formed', () => {
  const seen = new Set();
  const tagSet = new Set(PLAN_TAGS);
  for (const item of PLAN_CONTENT) {
    assert.ok(!seen.has(item.id), `duplicate plan item id: ${item.id}`);
    seen.add(item.id);
    assert.ok(PLAN_TYPES.includes(item.type), `${item.id}: bad type`);
    assert.ok(item.tags.length > 0, `${item.id}: no tags`);
    for (const tag of item.tags) {
      assert.ok(tagSet.has(tag), `${item.id}: unknown tag ${tag}`);
    }
    assertWellFormed({ ...item, safetyNote: item.safetyNote ?? null }, item.id);
  }
});

test('every plan tag is covered by at least one plan item', () => {
  const covered = new Set(PLAN_CONTENT.flatMap((item) => item.tags));
  for (const tag of PLAN_TAGS) {
    assert.ok(covered.has(tag), `no plan item carries the tag "${tag}"`);
  }
});

test('each plan type has enough items to rotate over a commitment window', () => {
  for (const type of PLAN_TYPES) {
    const count = PLAN_CONTENT.filter((item) => item.type === type).length;
    assert.ok(count >= 7, `${type} has only ${count} items`);
  }
});

test('the fallback pools are non-empty for every type', () => {
  for (const type of PLAN_TYPES) {
    const pool = matchingContent(type, new Set());
    assert.ok(pool.length > 0, `${type} fallback is empty`);
    for (const item of pool) assert.equal(item.type, type);
  }
});

// --- resolution ------------------------------------------------------------

test('every single condition in the catalog resolves a complete plan', () => {
  for (const entry of CONDITION_CATALOG) {
    for (const day of [0, 1, 5, 99, 3650]) {
      const plan = getDailyPlan([entry.id], day);
      for (const slot of SLOTS) {
        assertWellFormed(plan[slot], `${entry.id}/${slot}/day${day}`);
        assert.equal(plan[slot].type, slot);
      }
    }
  }
});

test('every condition produces guidance in its own type where its tags allow', () => {
  // A condition tagged only for eye care has no dietary tag, and the honest
  // answer there is general prevention rather than a strained connection.
  // What must never happen is an empty slot.
  for (const entry of CONDITION_CATALOG) {
    const plan = getDailyPlan([entry.id], 0);
    const linked = SLOTS.filter(
      (slot) => plan[slot].relatedConditions.length > 0,
    );
    assert.ok(
      linked.length > 0,
      `${entry.id} produced no item linked to it in any slot`,
    );
  }
});

test('a plan is resolved for a large multi-select profile', () => {
  const many = CONDITION_CATALOG.slice(0, MAX_SELECTIONS).map((e) => e.id);
  for (let day = 0; day < 60; day += 1) {
    const plan = getDailyPlan(many, day);
    for (const slot of SLOTS) assertWellFormed(plan[slot], `${slot}/day${day}`);
    assert.equal(plan.isBaseline, false);
  }
});

test('falls back to general guidance when nothing is selected', () => {
  for (let day = 0; day < 30; day += 1) {
    const plan = getDailyPlan([], day);
    assert.equal(plan.isBaseline, true);
    for (const slot of SLOTS) {
      assertWellFormed(plan[slot], slot);
      assert.deepEqual(plan[slot].relatedConditions, []);
      assert.deepEqual(plan[slot].matchedTags, []);
    }
  }
});

test('unknown ids are ignored rather than throwing', () => {
  const plan = getDailyPlan(['not_a_condition', 'type2_diabetes'], 4);
  for (const slot of SLOTS) assertWellFormed(plan[slot], slot);
  assert.equal(plan.isBaseline, false);

  const allJunk = getDailyPlan(['nope', 'also_nope'], 4);
  assert.equal(allJunk.isBaseline, true);
});

test('is deterministic: same inputs give the same plan', () => {
  const subset = ['coronary_artery_disease', 'osteoporosis'];
  for (let day = 0; day < 50; day += 1) {
    assert.deepEqual(getDailyPlan(subset, day), getDailyPlan(subset, day));
  }
});

test('does not depend on the order ids arrive in', () => {
  const a = getDailyPlan(['osteoporosis', 'coronary_artery_disease'], 3);
  const b = getDailyPlan(['coronary_artery_disease', 'osteoporosis'], 3);
  // relatedConditions follows selection order by design, so compare the
  // items chosen rather than the whole object.
  for (const slot of SLOTS) assert.equal(a[slot].id, b[slot].id);
});

test('survives hostile day indexes instead of throwing', () => {
  for (const day of [-1, -999, NaN, Infinity, -Infinity, 1.7, 0]) {
    const plan = getDailyPlan(['hypertension'], day);
    assert.ok(plan.diet.title.length > 0);
    assert.ok(Number.isInteger(plan.dayIndex) && plan.dayIndex >= 0);
  }
});

test('content rotates across a 7-day commitment window', () => {
  for (const slot of SLOTS) {
    const titles = new Set();
    for (let day = 0; day < 7; day += 1) {
      titles.add(getDailyPlan(['type2_diabetes'], day)[slot].title);
    }
    assert.ok(titles.size >= 4, `${slot} repeated too much: ${titles.size}/7`);
  }
});

test('an item links back to the selections that surfaced it', () => {
  const plan = getDailyPlan(['hypertension'], 0);
  const linked = SLOTS.map((slot) => plan[slot]).filter(
    (item) => item.relatedConditions.length > 0,
  );
  assert.ok(linked.length > 0);
  for (const item of linked) {
    assert.ok(item.relatedConditions.includes('High blood pressure'));
    assert.ok(item.matchedTags.length > 0);
  }
});

test('at most three related conditions are named', () => {
  const many = CONDITION_CATALOG.slice(0, MAX_SELECTIONS).map((e) => e.id);
  const plan = getDailyPlan(many, 0);
  for (const slot of SLOTS) {
    assert.ok(plan[slot].relatedConditions.length <= 3);
  }
});

// --- the selection trust boundary -----------------------------------------

test('sanitizeConditionIds rejects free text and unknown ids', () => {
  assert.deepEqual(
    sanitizeConditionIds(['type2_diabetes', 'i have a lump on my arm']),
    ['type2_diabetes'],
  );
  assert.deepEqual(sanitizeConditionIds('type2_diabetes'), []);
  assert.deepEqual(sanitizeConditionIds(null), []);
  assert.deepEqual(sanitizeConditionIds(undefined), []);
  assert.deepEqual(sanitizeConditionIds([{ evil: true }, 42, [], null]), []);
});

test('sanitizeConditionIds collapses duplicates and uses catalog order', () => {
  const result = sanitizeConditionIds([
    'osteoporosis',
    'hypertension',
    'osteoporosis',
  ]);
  assert.deepEqual(result, ['hypertension', 'osteoporosis']);
});

test('sanitizeConditionIds upgrades the legacy cardiovascular key', () => {
  assert.equal(upgradeLegacyKey('cardiovascular'), 'coronary_artery_disease');
  assert.equal(upgradeLegacyKey('type2_diabetes'), 'type2_diabetes');
  assert.equal(upgradeLegacyKey('nonsense'), 'nonsense');
  assert.deepEqual(sanitizeConditionIds(['cardiovascular']), [
    'coronary_artery_disease',
  ]);
  // The legacy key and its replacement together must not double up.
  assert.deepEqual(
    sanitizeConditionIds(['cardiovascular', 'coronary_artery_disease']),
    ['coronary_artery_disease'],
  );
});

test('sanitizeConditionIds caps the number of selections', () => {
  const everything = CONDITION_CATALOG.map((entry) => entry.id);
  const result = sanitizeConditionIds(everything);
  assert.equal(result.length, MAX_SELECTIONS);
  assert.deepEqual(result, everything.slice(0, MAX_SELECTIONS));
});

// --- day indexing ----------------------------------------------------------

test('dayIndexSince counts UTC days from the start date', () => {
  const start = new Date('2026-09-01T22:00:00Z');
  assert.equal(dayIndexSince(start, new Date('2026-09-01T23:59:00Z')), 0);
  assert.equal(dayIndexSince(start, new Date('2026-09-02T00:01:00Z')), 1);
  assert.equal(dayIndexSince(start, new Date('2026-09-08T12:00:00Z')), 7);
  // A clock skewed into the past must not produce a negative index.
  assert.equal(dayIndexSince(start, new Date('2026-08-20T12:00:00Z')), 0);
});

test('dayIndexSince returns 0 for an unparseable date rather than NaN', () => {
  assert.equal(dayIndexSince(new Date('nonsense')), 0);
  assert.equal(dayIndexSince(new Date('2026-09-01'), new Date('nonsense')), 0);
});

test('calendarDayIndex is a stable non-negative integer', () => {
  const index = calendarDayIndex(new Date('2026-09-13T10:00:00Z'));
  assert.ok(Number.isInteger(index) && index > 0);
  assert.equal(index, calendarDayIndex(new Date('2026-09-13T23:59:00Z')));
  assert.equal(
    calendarDayIndex(new Date('2026-09-14T00:00:00Z')),
    index + 1,
  );
});
