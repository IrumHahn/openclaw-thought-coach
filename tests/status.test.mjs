import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { answer, run, runJson, sampleReflections, tempDir, writeReflections } from './helpers.mjs';

test('status prints counts, active threads, content-ready claims and pending question; --json mirrors it', () => {
  const dir = tempDir('status');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const empty = run('status.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-20']);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /질문 0회 · 답 0개 · 오늘 0개/);
    assert.match(empty.stdout, /진행 중인 스레드 없음/);

    const reflections = writeReflections(dir, sampleReflections);
    const answers = ['사실 답.', '이유 답.', '의미 답.', '에이전트는 신입사원처럼 대하라.'];
    for (let step = 1; step <= 4; step += 1) {
      const q = runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', `2026-10-2${step}`, '--reflections', reflections, '--mark-asked']);
      assert.equal(answer(dir, thoughts, q, answers[step - 1], `2026-10-2${step}`).status, 0);
    }
    runJson('next_question.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-25', '--reflections', reflections, '--mark-asked']);

    const text = run('status.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-24']);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /질문 5회 · 답 4개 · 오늘 1개 · 콘텐츠 준비 완료 1개/);
    assert.match(text.stdout, /준비 완료: t001 회고 — "에이전트는 신입사원처럼 대하라\."/);
    assert.match(text.stdout, /진행 중: t002 업무 0\/4 \(아직 답 없음\)/);
    assert.match(text.stdout, /대기 중 질문: t002 1단계 \(2026-10-25 발송\)/);

    const json = runJson('status.mjs', ['--thoughts-dir', thoughts, '--date', '2026-10-24', '--json']);
    assert.equal(json.contentReady.length, 1);
    assert.equal(json.contentReady[0].claim, '에이전트는 신입사원처럼 대하라.');
    assert.deepEqual(json.contentReady[0].files, ['2026-10-21.md', '2026-10-22.md', '2026-10-23.md', '2026-10-24.md']);
    assert.equal(json.active.length, 1);
    assert.equal(json.pending.threadId, 't002');
    assert.equal(json.counters.answered, 4);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
