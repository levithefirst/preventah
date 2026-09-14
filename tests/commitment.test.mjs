import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import {
  STAKE_AMOUNT_BASE,
  STAKE_AMOUNT_USDT,
  toBaseUnits,
  formatUsdt,
  rewardBaseUnits,
} from '../src/lib/config.ts';

const BPS = 500n; // REWARD_BPS default, 5%

test('a new commitment is 0.10 USDT, which is exactly 100000 base units', () => {
  assert.equal(STAKE_AMOUNT_USDT, 0.1);
  assert.equal(toBaseUnits(STAKE_AMOUNT_USDT), 100_000n);
  assert.equal(STAKE_AMOUNT_BASE, 100_000n);
  assert.equal(formatUsdt(STAKE_AMOUNT_BASE), '0.10');
});

// The whole-USDT number and the base-unit number are declared separately so
// the server can verify a transfer without recomputing from a float. If they
// ever disagree, the app asks for one amount and accepts another.
test('the whole-USDT and base-unit constants cannot drift apart', () => {
  assert.equal(
    toBaseUnits(STAKE_AMOUNT_USDT),
    STAKE_AMOUNT_BASE,
    'STAKE_AMOUNT_BASE must equal toBaseUnits(STAKE_AMOUNT_USDT)',
  );
});

/*
  The amount is compiled in, not read from the environment.

  It used to be `Number(process.env.NEXT_PUBLIC_STAKE_AMOUNT_USDT ?? 0.1)`,
  which meant a dashboard field nobody reviews could silently change what the
  app charges. This asserts against the source text because that is the only
  way to catch the override being reintroduced: an env-driven value would
  still read 0.1 in a test run that happens to have the variable unset.
*/
test('the commitment amount is not environment-configurable', () => {
  const source = readFileSync('src/lib/config.ts', 'utf8');
  const declaration = source.slice(source.indexOf('export const STAKE_AMOUNT_USDT'));
  const statement = declaration.slice(0, declaration.indexOf(';') + 1);

  assert.ok(
    !statement.includes('process.env'),
    `STAKE_AMOUNT_USDT must be a literal, got: ${statement}`,
  );
  assert.match(statement, /=\s*0\.1\s*;/);
});

// The server decides the amount; the browser never sends one. A client that
// transfers a different amount has its stake rejected, not recorded at
// whatever it paid.
test('the stake route verifies against the server constant, not the request', () => {
  const route = readFileSync('src/app/api/stake/route.ts', 'utf8');

  assert.ok(
    route.includes('const expected = STAKE_AMOUNT_BASE'),
    'the expected amount must come from the compiled-in constant',
  );
  assert.ok(
    !/body\.(amount|amountBase|amountUsdt|value)/.test(route),
    'the route must never read an amount from the request body',
  );
});

test('a 0.10 commitment returns 0.105 with no truncation', () => {
  const stake = toBaseUnits(0.1);
  const reward = rewardBaseUnits(stake, BPS);
  assert.equal(reward, 5_000n);
  assert.equal(formatUsdt(reward), '0.005');
  assert.equal(stake + reward, 105_000n);
  assert.equal(formatUsdt(stake + reward), '0.105');
  // The arithmetic itself must be exact.
  assert.equal((stake * BPS) % 10_000n, 0n);
});

// The live production stake was created at 1 USDT. Lowering the default must
// never reprice it: every settlement path reads amount_base from its row.
test('an existing 1 USDT stake is unaffected by the new default', () => {
  const existing = 1_000_000n; // amount_base as stored in production
  const reward = rewardBaseUnits(existing, BPS);

  assert.equal(reward, 50_000n, 'reward must still be 5% of 1 USDT');
  assert.equal(formatUsdt(existing), '1.00');
  assert.equal(formatUsdt(existing + reward), '1.05');

  // And it must not collapse to the new default under any circumstance.
  assert.notEqual(existing, toBaseUnits(STAKE_AMOUNT_USDT));
  assert.notEqual(reward, rewardBaseUnits(toBaseUnits(STAKE_AMOUNT_USDT), BPS));
});

test('reward scales from the stake, not from configuration', () => {
  for (const [amount, expected] of [
    [100_000n, 5_000n],
    [1_000_000n, 50_000n],
    [5_000_000n, 250_000n],
  ]) {
    assert.equal(rewardBaseUnits(amount, BPS), expected);
  }
});

test('a non-positive stake or bps yields no reward rather than a negative', () => {
  assert.equal(rewardBaseUnits(0n, BPS), 0n);
  assert.equal(rewardBaseUnits(-1n, BPS), 0n);
  assert.equal(rewardBaseUnits(100_000n, 0n), 0n);
});

/*
  Nothing anywhere rewrites a stored amount.

  Lowering the default must not become a migration. These assert against the
  real source of every path that touches stakes: the settlement job, the
  verification routes, the data-access layer and the schema. The only
  statement permitted to write amount_base is the one that records the
  amount the chain actually confirmed, on a stake being activated.
*/
test('no code path rewrites the amount of an existing commitment', () => {
  const files = [
    'src/lib/repo.ts',
    'src/app/api/cron/payout/route.ts',
    'src/app/api/stake/route.ts',
    'src/app/api/stake/verify/route.ts',
    'db/schema.sql',
    'scripts/db-init.mjs',
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    // No UPDATE may set amount_base except the activation one in repo.ts,
    // which writes the amount confirmed on-chain for that specific stake.
    const writes = [...source.matchAll(/amount_base\s*=/g)];
    for (const match of writes) {
      const context = source.slice(Math.max(0, match.index - 400), match.index);
      assert.ok(
        /confirmedAmountBase/.test(source.slice(match.index, match.index + 120)),
        `${file}: amount_base is assigned outside stake activation`,
      );
      assert.ok(
        /UPDATE stakes/i.test(context),
        `${file}: unexpected amount_base write`,
      );
    }

    // And nothing may reference the new default while touching stored rows.
    assert.ok(
      !/STAKE_AMOUNT_(USDT|BASE)/.test(source) || file.endsWith('stake/route.ts'),
      `${file}: settlement paths must read amount_base, never the default`,
    );
  }
});

test('settlement reads the stake row, never the configured default', () => {
  const payout = readFileSync('src/app/api/cron/payout/route.ts', 'utf8');

  assert.ok(payout.includes('rewardBaseUnits(stake.amount_base'));
  assert.ok(payout.includes('stake.amount_base + reward'));
  assert.ok(
    !payout.includes('STAKE_AMOUNT'),
    'the payout job must not import the new-commitment default at all',
  );
});
