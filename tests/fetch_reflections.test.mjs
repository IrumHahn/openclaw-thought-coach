import assert from 'node:assert/strict';
import test from 'node:test';
import { FetchReflectionsError, MESSAGES, fetchReflections, normalizeReflections } from '../skill/thought-coach/scripts/fetch_reflections.mjs';
import { run } from './helpers.mjs';

const payload = {
  cohort: 's4', owner: { participantId: 'p1', name: '홍길동' },
  reflections: [
    { id: 'a', text: '  오래된 회고 ', createdAt: '2026-10-14T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z', commentCount: 1 },
    { id: 'b', text: '최신 회고', createdAt: '2026-10-21T00:00:00Z' },
    { id: 'c', text: '   ' },
  ],
  count: 3,
};

function fakeFetch(status, body) {
  return async (url, init) => {
    fakeFetch.lastCall = { url, init };
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
}

test('fetch normalizes shape, sorts newest first, drops empty text and sends bearer header', async () => {
  const result = await fetchReflections({ token: ' rap_s4_abc ', fetchImpl: fakeFetch(200, payload), limit: 5, baseUrl: 'https://example.test/' });
  assert.equal(fakeFetch.lastCall.url, 'https://example.test/api/agent-plaza?view=reflections&limit=5');
  assert.equal(fakeFetch.lastCall.init.headers.Authorization, 'Bearer rap_s4_abc');
  assert.equal(result.count, 2);
  assert.deepEqual(result.reflections.map(item => item.id), ['b', 'a']);
  assert.equal(result.reflections[1].text, '오래된 회고');
  assert.equal(result.reflections[0].commentCount, 0);
  assert.equal(result.reflections[0].updatedAt, '2026-10-21T00:00:00Z');
  assert.deepEqual(result.owner, { participantId: 'p1', name: '홍길동' });
  assert.throws(() => normalizeReflections({ nope: true }), /reflections array/);
});

test('401 asks the owner to re-issue the token; network failure is a quiet skip (exit 4)', async () => {
  await assert.rejects(fetchReflections({ token: 'rap_x', fetchImpl: fakeFetch(401, {}) }), error => {
    assert.ok(error instanceof FetchReflectionsError);
    assert.equal(error.code, 'unauthorized');
    assert.equal(error.exitCode, 3);
    assert.equal(error.message, MESSAGES.unauthorized);
    assert.match(error.message, /베이스캠프/);
    return true;
  });
  await assert.rejects(fetchReflections({ token: 'rap_x', fetchImpl: async () => { throw new Error('ECONNRESET'); } }), error => {
    assert.equal(error.code, 'network');
    assert.equal(error.exitCode, 4);
    assert.match(error.message, /건너뛰/);
    return true;
  });
  await assert.rejects(fetchReflections({ token: '', fetchImpl: fakeFetch(200, payload) }), error => error.code === 'missing-token' && error.exitCode === 3);
});

test('CLI exits 3 with a Korean hint when the token env is missing and never prints the token', () => {
  const result = run('fetch_reflections.mjs', ['--out', '/dev/null', '--token-env', 'THOUGHT_COACH_TEST_TOKEN'], { THOUGHT_COACH_TEST_TOKEN: '' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /토큰/);
  assert.equal(result.stdout, '');
});
