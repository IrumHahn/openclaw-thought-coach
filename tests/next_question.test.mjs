import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { answer, runJson, sampleReflections, tempDir, writeReflections } from './helpers.mjs';

function ask(thoughtsDir, date, extra = []) {
  return runJson('next_question.mjs', ['--thoughts-dir', thoughtsDir, '--date', date, ...extra]);
}

test('no reflections and empty state → opener on 회고, step 1, nothing written without --mark-asked', () => {
  const dir = tempDir('opener');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const first = ask(thoughts, '2026-10-20');
    assert.equal(first.threadId, 't001');
    assert.equal(first.step, 1);
    assert.equal(first.topic, '회고');
    assert.equal(first.sourceType, 'opener');
    assert.equal(first.sourceId, null);
    assert.match(first.question, /들려주세요/);
    assert.ok(!fs.existsSync(path.join(thoughts, '_state.json')), 'preview must not write state');
    assert.deepEqual(ask(thoughts, '2026-10-20'), first, 'deterministic');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('seeds from the newest unaddressed reflection with a short quote, two sentences max', () => {
  const dir = tempDir('seed');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const reflections = writeReflections(dir, sampleReflections);
    const q = ask(thoughts, '2026-10-21', ['--reflections', reflections]);
    assert.equal(q.sourceType, 'reflection');
    assert.equal(q.sourceId, 'r-new');
    assert.equal(q.quote, '오늘은 에이전트가 처음으로 내 파일을 읽었다.');
    assert.ok(q.question.includes(q.quote));
    assert.ok(q.question.split(/[.?!]\s|[.?!]$/).filter(Boolean).length <= 2, q.question);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ladder: 사실→이유→의미→주장 on one thread, each follow-up quotes the previous answer, then content-ready', () => {
  const dir = tempDir('ladder');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const reflections = writeReflections(dir, sampleReflections);
    const answers = ['에이전트가 파일을 읽고 요약했는데 폴더를 잘못 짚었다.', '지시에 경로를 안 적어서 그랬다.', '사람에게 시킬 때처럼 맥락을 줘야 한다는 걸 배웠다.', '에이전트는 신입사원처럼 대하라.'];
    let q;
    for (let step = 1; step <= 4; step += 1) {
      q = ask(thoughts, `2026-10-2${step}`, ['--reflections', reflections, '--mark-asked']);
      assert.equal(q.threadId, 't001');
      assert.equal(q.step, step);
      assert.equal(q.stepName, ['사실', '이유', '의미', '주장'][step - 1]);
      if (step > 1) assert.ok(q.question.includes(answers[step - 2].slice(0, 10)), `step ${step} should quote previous answer: ${q.question}`);
      const saved = answer(dir, thoughts, q, answers[step - 1], `2026-10-2${step}`);
      assert.equal(saved.status, 0, saved.stderr);
    }
    const state = JSON.parse(fs.readFileSync(path.join(thoughts, '_state.json'), 'utf8'));
    assert.equal(state.threads[0].contentReady, true);
    assert.equal(state.threads[0].step, 4);
    assert.equal(state.counters.asked, 4);
    assert.equal(state.counters.answered, 4);
    assert.equal(state.counters.contentReady, 1);
    assert.deepEqual(state.addressedReflectionIds, ['r-new']);
    assert.equal(state.pending, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rotation: after a thread completes, the next thread moves 회고 → 업무 → 고객 …, and 회고 skips addressed reflections', () => {
  const dir = tempDir('rotation');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const reflections = writeReflections(dir, sampleReflections);
    const seen = [];
    let day = 1;
    for (let thread = 0; thread < 7; thread += 1) {
      for (let step = 1; step <= 4; step += 1) {
        const date = `2026-11-${String(day).padStart(2, '0')}`; day += 1;
        const q = ask(thoughts, date, ['--reflections', reflections, '--mark-asked']);
        if (step === 1) seen.push({ topic: q.topic, sourceType: q.sourceType, sourceId: q.sourceId, threadId: q.threadId });
        const saved = answer(dir, thoughts, q, `${q.topic} 답 ${step}: 고객이 업무 때문에 힘들다고 했다.`, date);
        assert.equal(saved.status, 0, saved.stderr);
      }
    }
    assert.deepEqual(seen.map(item => item.topic), ['회고', '업무', '고객', '실패', '아이디어', 'AI 에이전트 경험', '회고']);
    assert.deepEqual(seen.map(item => item.threadId), ['t001', 't002', 't003', 't004', 't005', 't006', 't007']);
    assert.equal(seen[0].sourceId, 'r-new');
    assert.equal(seen[6].sourceId, 'r-old', 'second 회고 thread uses the next unaddressed reflection');
    assert.equal(seen[1].sourceType, 'thought', '업무 thread seeds from a recent thought tagged 업무');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('reminder: same-day re-ask is idempotent, remind fires once, stale question is dropped next evening', () => {
  const dir = tempDir('remind');
  const thoughts = path.join(dir, 'thoughts');
  try {
    const q1 = ask(thoughts, '2026-10-20', ['--mark-asked']);
    const again = ask(thoughts, '2026-10-20', ['--mark-asked']);
    assert.equal(again.alreadyAsked, true);
    assert.equal(again.question, q1.question);
    let state = JSON.parse(fs.readFileSync(path.join(thoughts, '_state.json'), 'utf8'));
    assert.equal(state.counters.asked, 1, 'same-day re-run must not count twice');

    assert.equal(ask(thoughts, '2026-10-20', ['--mode', 'remind']).skip, true);
    const remind = ask(thoughts, '2026-10-21', ['--mode', 'remind', '--mark-asked']);
    assert.equal(remind.reminder, true);
    assert.equal(remind.question, q1.question);
    assert.match(remind.reminderPrefix, /한 번만/);
    const second = ask(thoughts, '2026-10-21', ['--mode', 'remind', '--mark-asked']);
    assert.equal(second.skip, true);
    assert.equal(second.reason, 'already-reminded');

    const q2 = ask(thoughts, '2026-10-21', ['--mark-asked']);
    assert.equal(q2.threadId, 't001', 'unanswered thread continues at the same step');
    assert.equal(q2.step, 1);
    state = JSON.parse(fs.readFileSync(path.join(thoughts, '_state.json'), 'utf8'));
    assert.equal(state.counters.unanswered, 1);
    assert.equal(state.pending.date, '2026-10-21');
    assert.equal(state.threads.length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
