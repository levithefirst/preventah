import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STAKE_AMOUNT_USDT,
  toBaseUnits,
  formatUsdt,
  rewardBaseUnits,
} from '../src/lib/config.ts';

const BPS = 500n; // REWARD_BPS default, 5%

test('the default commitment for a new stake is 0.10 USDT', () => {
  assert.equal(STAKE_AMOUNT_USDT, 0.1);
  assert.equal(toBaseUnits(STAKE_AMOUNT_USDT), 100_000n);
  assert.equal(formatUsdt(toBaseUnits(STAKE_AMOUNT_USDT)), '0.10');
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
