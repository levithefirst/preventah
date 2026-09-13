import test from 'node:test';
import assert from 'node:assert/strict';

import { api, API_TIMEOUT_MS } from '../src/lib/api-client.ts';

const realFetch = globalThis.fetch;
function stubFetch(impl) {
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = realFetch;
  };
}

test('a successful JSON response passes straight through', async () => {
  const restore = stubFetch(async () => ({
    json: async () => ({ ok: true, state: { address: '0xabc' } }),
  }));
  try {
    const result = await api('/api/me');
    assert.equal(result.ok, true);
    assert.equal(result.state.address, '0xabc');
    assert.notEqual(result.offline, true);
  } finally {
    restore();
  }
});

// Without this, the rejection escapes into an effect or click handler, the
// busy flag is never cleared, and the user is stranded on a spinner.
test('a network failure resolves as offline instead of rejecting', async () => {
  const restore = stubFetch(async () => {
    throw new TypeError('Failed to fetch');
  });
  try {
    const result = await api('/api/checkin', { method: 'POST' });
    assert.equal(result.ok, false);
    assert.equal(result.offline, true);
    assert.match(result.error, /connection/i);
  } finally {
    restore();
  }
});

test('an aborted request reports a timeout rather than rejecting', async () => {
  const restore = stubFetch(async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  });
  try {
    const result = await api('/api/me');
    assert.equal(result.ok, false);
    assert.equal(result.offline, true);
    assert.match(result.error, /too long/i);
  } finally {
    restore();
  }
});

test('an unreadable body is reported, not thrown', async () => {
  const restore = stubFetch(async () => ({
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  }));
  try {
    const result = await api('/api/me');
    assert.equal(result.ok, false);
    assert.match(result.error, /could not read/i);
    // A malformed body is not a transport failure.
    assert.notEqual(result.offline, true);
  } finally {
    restore();
  }
});

test('an abort signal and a sane timeout are always attached', async () => {
  let seen;
  const restore = stubFetch(async (_path, init) => {
    seen = init;
    return { json: async () => ({ ok: true }) };
  });
  try {
    await api('/api/me');
    assert.ok(seen.signal, 'no abort signal attached');
    assert.equal(seen.signal.aborted, false);
    assert.equal(seen.headers['content-type'], 'application/json');
    assert.ok(
      API_TIMEOUT_MS > 0 && API_TIMEOUT_MS <= 30_000,
      'timeout should be set and not effectively infinite',
    );
  } finally {
    restore();
  }
});

test('caller-supplied method and body survive', async () => {
  let seen;
  const restore = stubFetch(async (_p, init) => {
    seen = init;
    return { json: async () => ({ ok: true }) };
  });
  try {
    await api('/api/stake', { method: 'POST', body: '{"txHash":"0x1"}' });
    assert.equal(seen.method, 'POST');
    assert.equal(seen.body, '{"txHash":"0x1"}');
  } finally {
    restore();
  }
});
