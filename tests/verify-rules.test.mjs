import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_CONFIRMATIONS,
  confirmationsFor,
  hasEnoughConfirmations,
  findMatchingTransfer,
} from '../src/lib/verify-rules.ts';

const USDT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
const USER = '0x1111111111111111111111111111111111111111';
const ESCROW = '0x2222222222222222222222222222222222222222';
const RELAYER = '0x3333333333333333333333333333333333333333';
const OTHER_TOKEN = '0x4444444444444444444444444444444444444444';

const ONE_USDT = 1_000_000n; // 6 decimals

const transfer = (over = {}) => ({
  address: USDT,
  args: { from: USER, to: ESCROW, value: ONE_USDT, ...(over.args ?? {}) },
  ...(over.address ? { address: over.address } : {}),
});

const criteria = {
  token: USDT,
  escrow: ESCROW,
  from: USER,
  minAmount: ONE_USDT,
};

// --- confirmations ---------------------------------------------------------

test('counts confirmations inclusively from the receipt block', () => {
  assert.equal(confirmationsFor(100n, 100n), 1n);
  assert.equal(confirmationsFor(102n, 100n), 3n);
  assert.equal(confirmationsFor(150n, 100n), 51n);
});

test('reaches the threshold at exactly REQUIRED_CONFIRMATIONS', () => {
  const receipt = 100n;
  const atThreshold = receipt + REQUIRED_CONFIRMATIONS - 1n;
  assert.equal(hasEnoughConfirmations(atThreshold - 1n, receipt), false);
  assert.equal(hasEnoughConfirmations(atThreshold, receipt), true);
});

// This is the regression that let a confirmed stake hang forever: a load
// balanced RPC serving eth_blockNumber from a node behind the one that
// served the receipt made the subtraction negative.
test('a lagging RPC yields zero confirmations, never a negative count', () => {
  assert.equal(confirmationsFor(98n, 100n), 0n);
  assert.equal(confirmationsFor(0n, 100n), 0n);
  assert.equal(hasEnoughConfirmations(98n, 100n), false);
  // And it must recover once the node catches up, rather than latching.
  assert.equal(hasEnoughConfirmations(105n, 100n), true);
});

// --- transfer matching: success path --------------------------------------

test('matches a plain USDT transfer to the escrow', () => {
  const match = findMatchingTransfer([transfer()], criteria);
  assert.ok(match);
  assert.equal(match.args.value, ONE_USDT);
});

test('address comparison ignores case and checksum formatting', () => {
  const mixed = {
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    args: {
      from: USER.toUpperCase().replace('0X', '0x'),
      to: ESCROW,
      value: ONE_USDT,
    },
  };
  assert.ok(findMatchingTransfer([mixed], criteria));
});

test('accepts an overpayment', () => {
  const over = transfer({ args: { value: ONE_USDT * 5n } });
  const match = findMatchingTransfer([over], criteria);
  assert.ok(match);
  assert.equal(match.args.value, ONE_USDT * 5n);
});

// A relayed / meta-transaction pays the relayer in the same transaction, so
// the stake transfer is not necessarily the only log, nor the first.
test('finds the stake transfer among relayer fee logs', () => {
  const logs = [
    { address: USDT, args: { from: USER, to: RELAYER, value: 25_000n } },
    transfer(),
  ];
  const match = findMatchingTransfer(logs, criteria);
  assert.ok(match);
  assert.equal(match.args.to, ESCROW);
  assert.equal(match.args.value, ONE_USDT);
});

// --- transfer matching: failure paths -------------------------------------

test('rejects a transfer of a different token', () => {
  const wrongToken = { ...transfer(), address: OTHER_TOKEN };
  assert.equal(findMatchingTransfer([wrongToken], criteria), undefined);
});

test('rejects a transfer to somewhere other than the escrow', () => {
  const wrongTo = transfer({ args: { to: RELAYER } });
  assert.equal(findMatchingTransfer([wrongTo], criteria), undefined);
});

test('rejects a transfer from a different sender', () => {
  const wrongFrom = transfer({ args: { from: RELAYER } });
  assert.equal(findMatchingTransfer([wrongFrom], criteria), undefined);
});

test('rejects an underpayment, including one short by a single unit', () => {
  assert.equal(
    findMatchingTransfer([transfer({ args: { value: ONE_USDT - 1n } })], criteria),
    undefined,
  );
  assert.equal(
    findMatchingTransfer([transfer({ args: { value: 0n } })], criteria),
    undefined,
  );
});

test('returns undefined for a transaction with no transfer logs', () => {
  assert.equal(findMatchingTransfer([], criteria), undefined);
});

test('a malformed log does not abort the search over the rest', () => {
  const logs = [
    { address: 'not-an-address', args: { from: USER, to: ESCROW, value: ONE_USDT } },
    transfer(),
  ];
  const match = findMatchingTransfer(logs, criteria);
  assert.ok(match, 'the valid log after the malformed one should still match');
});

test('a malformed configured address matches nothing rather than throwing', () => {
  assert.equal(
    findMatchingTransfer([transfer()], { ...criteria, escrow: 'nonsense' }),
    undefined,
  );
});

// An escrow/NEXT_PUBLIC mismatch is a real deployment failure mode: the user
// pays a different address than the server verifies against.
test('rejects payment to a mismatched escrow address', () => {
  const paidElsewhere = transfer({
    args: { to: '0x5555555555555555555555555555555555555555' },
  });
  assert.equal(findMatchingTransfer([paidElsewhere], criteria), undefined);
});
