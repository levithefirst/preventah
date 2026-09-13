import test from 'node:test';
import assert from 'node:assert/strict';

import { CONDITION_CATALOG } from '../src/lib/condition-catalog.ts';
import {
  CONDITION_CATEGORIES,
  PLAN_TAGS,
  CATEGORY_LABELS,
} from '../src/lib/condition-types.ts';
import {
  CATEGORY_SUMMARIES,
  CONDITION_COUNT,
  conditionName,
  conditionsInCategory,
  getCondition,
  isConditionId,
  normalize,
  planTagsFor,
  searchConditions,
} from '../src/lib/condition-index.ts';

const CATEGORY_SET = new Set(CONDITION_CATEGORIES);
const TAG_SET = new Set(PLAN_TAGS);

test('the catalog covers at least 100 conditions', () => {
  assert.ok(
    CONDITION_CATALOG.length >= 100,
    `expected 100+ conditions, got ${CONDITION_CATALOG.length}`,
  );
  assert.equal(CONDITION_COUNT, CONDITION_CATALOG.length);
});

test('every id is unique and stable-looking', () => {
  const seen = new Set();
  for (const entry of CONDITION_CATALOG) {
    assert.match(entry.id, /^[a-z][a-z0-9_]*$/, `bad id: ${entry.id}`);
    assert.ok(!seen.has(entry.id), `duplicate id: ${entry.id}`);
    seen.add(entry.id);
  }
});

test('every entry carries the metadata the UI renders', () => {
  for (const entry of CONDITION_CATALOG) {
    assert.ok(entry.name.length > 0, `${entry.id} has no name`);
    assert.ok(entry.description.length > 0, `${entry.id} has no description`);
    assert.ok(entry.riskContext.length > 0, `${entry.id} has no risk context`);
    assert.ok(CATEGORY_SET.has(entry.category), `${entry.id} bad category`);
    assert.ok(
      ['strong', 'moderate', 'some'].includes(entry.familyHistoryRelevance),
      `${entry.id} bad relevance`,
    );
    assert.ok(entry.planTags.length > 0, `${entry.id} has no plan tags`);
    for (const tag of entry.planTags) {
      assert.ok(TAG_SET.has(tag), `${entry.id} has unknown tag ${tag}`);
    }
    assert.ok(entry.sourceName.length > 0, `${entry.id} has no source name`);
    assert.match(entry.sourceUrl, /^https:\/\//, `${entry.id} bad source url`);
  }
});

test('no entry duplicates a tag within its own list', () => {
  for (const entry of CONDITION_CATALOG) {
    assert.equal(
      new Set(entry.planTags).size,
      entry.planTags.length,
      `${entry.id} repeats a plan tag`,
    );
  }
});

test('every category label is populated and every category has entries', () => {
  for (const category of CONDITION_CATEGORIES) {
    assert.ok(CATEGORY_LABELS[category], `${category} has no label`);
    assert.ok(
      conditionsInCategory(category).length > 0,
      `${category} has no conditions`,
    );
  }
  assert.equal(CATEGORY_SUMMARIES.length, CONDITION_CATEGORIES.length);
  const total = CATEGORY_SUMMARIES.reduce((sum, s) => sum + s.count, 0);
  assert.equal(total, CONDITION_CATALOG.length);
});

test('every plan tag in the vocabulary is used by at least one condition', () => {
  const used = new Set(CONDITION_CATALOG.flatMap((entry) => entry.planTags));
  for (const tag of PLAN_TAGS) {
    assert.ok(used.has(tag), `plan tag "${tag}" is never used`);
  }
});

test('the six legacy selection keys all survive as catalog ids', () => {
  // These are the keys already written to condition_selections in
  // production. Losing one would orphan a real user's selection.
  for (const legacy of [
    'type2_diabetes',
    'hypertension',
    'metabolic_syndrome',
    'osteoporosis',
    'cancer_family_history',
  ]) {
    assert.ok(isConditionId(legacy), `legacy key ${legacy} is not in the catalog`);
  }
});

test('lookup helpers are total', () => {
  assert.equal(getCondition('nope_not_real'), undefined);
  assert.equal(conditionName('nope_not_real'), 'nope_not_real');
  assert.equal(isConditionId(null), false);
  assert.equal(isConditionId(42), false);
  assert.equal(isConditionId('type2_diabetes'), true);
  assert.equal(getCondition('type2_diabetes')?.category, 'metabolic');
});

test('normalize folds case, accents and punctuation', () => {
  assert.equal(normalize('  Crohn’s Disease  '), 'crohn s disease');
  assert.equal(normalize('M\u00e9ni\u00e8re'), 'meniere');
  assert.equal(normalize('!!!'), '');
});

test('an empty query returns the catalog in curated order', () => {
  const all = searchConditions('');
  assert.equal(all.length, CONDITION_CATALOG.length);
  assert.equal(all[0].id, CONDITION_CATALOG[0].id);
  assert.equal(searchConditions('   ').length, CONDITION_CATALOG.length);
});

test('search matches names', () => {
  const results = searchConditions('glaucoma');
  assert.equal(results[0].id, 'glaucoma');
});

test('search matches aliases, and ranks an alias prefix above a substring', () => {
  const results = searchConditions('hypertension');
  assert.equal(results[0].id, 'hypertension');
  assert.ok(results.some((entry) => entry.id === 'hypertension'));
});

test('search is case and punctuation insensitive', () => {
  const a = searchConditions('CROHNS').map((e) => e.id);
  const b = searchConditions("crohn's").map((e) => e.id);
  assert.ok(a.includes('crohns_disease'));
  assert.ok(b.includes('crohns_disease'));
});

test('multi-word queries narrow rather than widen', () => {
  const one = searchConditions('blood');
  const two = searchConditions('blood pressure');
  assert.ok(two.length > 0);
  assert.ok(two.length < one.length, 'adding a word should narrow the result set');
  assert.equal(two[0].id, 'hypertension');
});

test('search can be scoped to a category and capped', () => {
  const scoped = searchConditions('cancer', { category: 'cancer' });
  assert.ok(scoped.length > 0);
  for (const entry of scoped) assert.equal(entry.category, 'cancer');

  assert.equal(searchConditions('', { limit: 5 }).length, 5);
  assert.equal(searchConditions('a', { limit: 3 }).length, 3);
});

test('a query that matches nothing returns an empty array, not a throw', () => {
  assert.deepEqual(searchConditions('zzzzqqqq'), []);
  assert.deepEqual(searchConditions('zzzzqqqq', { category: 'heart' }), []);
});

test('search is deterministic across repeated calls', () => {
  const first = searchConditions('heart').map((e) => e.id);
  const second = searchConditions('heart').map((e) => e.id);
  assert.deepEqual(first, second);
});

test('plan tags resolve as a deduplicated union and ignore unknown ids', () => {
  const tags = planTagsFor(['type2_diabetes', 'hypertension', 'made_up']);
  assert.ok(tags.length > 0);
  assert.equal(new Set(tags).size, tags.length);
  for (const tag of tags) assert.ok(TAG_SET.has(tag));
  assert.deepEqual(planTagsFor([]), []);
  assert.deepEqual(planTagsFor(['made_up']), []);
});
