import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseThoughtFile } from '../skill/thought-coach/scripts/lib/store.mjs';
import { answer, runJson, sampleReflections, tempDir, writeReflections } from './helpers.mjs';

test('writes thoughts/<date>.md with the header fields, auto tags and summary, and updates _state.json', () => {
  const dir = tempDir('save');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const reflections = writeReflections(dir, sampleReflections);
    const q = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-24', '--reflections', reflections, '--mark-asked']);
    const text = '에이전트에게 "폴더 정리해줘"라고 했는데 엉뚱한 폴더를 건드렸다.\n실수였지만 고객 자료는 아니라 다행이었다.\n';
    const saved = answer(dir, thoughts, q, text, '2026-10-24');
    assert.equal(saved.status, 0, saved.stderr);
    assert.match(saved.stdout, /^오늘 1개째 생각을 저장했어요 — 전체 1개 · t001 1\/4 사실\n$/);

    const file = path.join(thoughts, '2026-10-24.md');
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /^---\ndate: 2026-10-24\nthread: t001\nstep: 1\/4 사실\ntopic: 회고\nsource: reflection:r-new\nquestion: .+\ntags: 고객, 실패\nsummary: .+\n---\n\n## 질문\n/);
    assert.ok(content.includes('## 답\n에이전트에게 "폴더 정리해줘"라고 했는데 엉뚱한 폴더를 건드렸다.\n실수였지만 고객 자료는 아니라 다행이었다.'));
    const [entry] = parseThoughtFile(content);
    assert.equal(entry.threadId, 't001');
    assert.equal(entry.step, 1);
    assert.deepEqual(entry.tags, ['고객', '실패']);
    assert.equal(entry.answer, text.trim());
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);

    const state = JSON.parse(fs.readFileSync(path.join(thoughts, '_state.json'), 'utf8'));
    assert.deepEqual(state.threads.map(t => [t.id, t.step, t.lastAnswered, t.contentReady]), [['t001', 1, '2026-10-24', false]]);
    assert.equal(state.counters.answered, 1);
    assert.equal(state.pending, null);
    assert.deepEqual(state.addressedReflectionIds, ['r-new']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('"오늘 N개째" counts entries saved on the same date; explicit --tags/--summary override; --json output', () => {
  const dir = tempDir('count');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const q1 = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-24', '--mark-asked']);
    assert.equal(answer(dir, thoughts, q1, '첫 답.', '2026-10-24').status, 0);
    const q2 = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-25', '--mark-asked']);
    const second = answer(dir, thoughts, q2, '둘째 답이지만 같은 날 저장.', '2026-10-24', ['--tags', '아이디어,없는태그', '--summary', '한 줄 요약', '--json']);
    assert.equal(second.status, 0, second.stderr);
    const result = JSON.parse(second.stdout);
    assert.equal(result.todayCount, 2);
    assert.equal(result.totalAnswered, 2);
    assert.deepEqual(result.tags, ['아이디어']);
    assert.equal(result.summary, '한 줄 요약');
    assert.match(result.message, /^오늘 2개째/);
    const entries = parseThoughtFile(fs.readFileSync(path.join(thoughts, '2026-10-24.md'), 'utf8'));
    assert.equal(entries.length, 2);
    assert.equal(entries[1].step, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('manual (B track) answer without --mark-asked starts a thread at step 1; wrong step or empty answer is refused', () => {
  const dir = tempDir('manual');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const preview = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-24']);
    assert.equal(answer(dir, thoughts, { ...preview, step: 3 }, '건너뛴 답', '2026-10-24').status, 1);
    assert.equal(answer(dir, thoughts, preview, '   \n', '2026-10-24').status, 1);
    const ok = answer(dir, thoughts, preview, '수동으로 적은 첫 답.', '2026-10-24');
    assert.equal(ok.status, 0, ok.stderr);
    const state = JSON.parse(fs.readFileSync(path.join(thoughts, '_state.json'), 'utf8'));
    assert.equal(state.threads[0].id, 't001');
    assert.equal(state.counters.asked, 1);
    assert.equal(state.counters.answered, 1);
    const next = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-25']);
    assert.equal(next.step, 2);
    assert.ok(next.question.includes('수동으로 적은 첫 답'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
