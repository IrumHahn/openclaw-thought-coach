#!/usr/bin/env node
// 수강생의 답을 thoughts/<날짜>.md 에 저장하고 _state.json 을 갱신한다. 마지막 줄에 "오늘 N개째" 문구를 출력한다.
//   node save_answer.mjs --question-json <next_question 출력 파일> --answer-file <답 텍스트> --thoughts-dir <dir> [--date YYYY-MM-DD] [--tags 업무,고객] [--summary "한 줄"] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { STEPS, TAGS, fail, formatThoughtEntry, isMain, listThoughtEntries, parseOptions, quoteOf, readState, todayKST, writeState } from './lib/store.mjs';

const MAX_ANSWER = 8000;
const TAG_HINTS = {
  '업무': ['업무', '회의', '프로젝트', '마감', '작업', '보고', '출근', '일이', '일을', '일에'],
  '고객': ['고객', '손님', '구매', '문의', '클라이언트', '독자', '사용자', '거래처'],
  '아이디어': ['아이디어', '해보면', '해볼까', '기획', '만들어', '시도'],
  '감정': ['기쁘', '힘들', '불안', '답답', '뿌듯', '화가', '걱정', '좋았', '속상', '설레', '지쳤'],
  '실패': ['실패', '못했', '안 됐', '안됐', '놓쳤', '실수', '망했', '틀렸', '늦었'],
};

export function autoTags(answer, topic) {
  const tags = TAGS.filter(tag => TAG_HINTS[tag].some(hint => answer.includes(hint)));
  if (!tags.length && TAGS.includes(topic)) tags.push(topic);
  return tags;
}

export function saveAnswer({ question, answer, thoughtsDir, date, tags, summary }) {
  const text = String(answer ?? '').trim();
  if (!text) fail('answer is empty');
  if (text.length > MAX_ANSWER) fail(`answer must be ${MAX_ANSWER} characters or less`);
  for (const key of ['threadId', 'step', 'topic', 'question']) if (question[key] === undefined || question[key] === null) fail(`question json is missing "${key}"`);
  const step = Number(question.step);
  if (!Number.isInteger(step) || step < 1 || step > STEPS.length) fail(`invalid step: ${question.step}`);

  const state = readState(thoughtsDir);
  let thread = state.threads.find(item => item.id === question.threadId);
  if (!thread) {
    // 수동(B 트랙)으로 --mark-asked 없이 물었을 때: 1단계부터만 새로 시작할 수 있다.
    if (step !== 1) fail(`thread ${question.threadId} is unknown; a new thread must start at step 1`);
    thread = { id: question.threadId, topic: question.topic, step: 0, lastAsked: date, lastAnswered: null, sourceId: question.sourceId ?? null, sourceType: question.sourceType ?? 'opener', quote: question.quote ?? '', contentReady: false, startedAt: date };
    state.threads.push(thread);
    state.counters.threadsStarted += 1;
    state.topicCursor += 1;
    state.counters.asked += 1;
  }
  if (step !== thread.step + 1) fail(`thread ${thread.id} expects step ${thread.step + 1}, got ${step}`);

  const finalTags = (tags && tags.length ? tags : autoTags(text, question.topic)).filter(tag => TAGS.includes(tag));
  const source = question.sourceType === 'reflection' ? `reflection:${question.sourceId}` : question.sourceType === 'thought' ? `thought:${question.sourceId}` : 'opener';
  const entry = { date, threadId: thread.id, step, topic: question.topic, source, question: String(question.question), tags: finalTags, summary: (summary || quoteOf(text, 60)).trim(), answer: text };

  fs.mkdirSync(thoughtsDir, { recursive: true });
  const file = path.join(thoughtsDir, `${date}.md`);
  fs.appendFileSync(file, formatThoughtEntry(entry), { encoding: 'utf8', mode: 0o600 });

  thread.step = step;
  thread.lastAnswered = date;
  if (step === STEPS.length) { thread.contentReady = true; thread.claim = entry.summary; state.counters.contentReady += 1; }
  if (question.sourceType === 'reflection' && question.sourceId && !state.addressedReflectionIds.includes(question.sourceId)) state.addressedReflectionIds.push(question.sourceId);
  state.counters.answered += 1;
  if (state.pending && state.pending.threadId === thread.id) state.pending = null;
  writeState(thoughtsDir, state);

  const todayCount = listThoughtEntries(thoughtsDir).filter(item => item.date === date).length;
  const message = `오늘 ${todayCount}개째 생각을 저장했어요 — 전체 ${state.counters.answered}개 · ${thread.id} ${step}/${STEPS.length} ${STEPS[step - 1]}${thread.contentReady ? ' · 이 생각은 콘텐츠로 쓸 준비가 됐어요' : ''}`;
  return { ok: true, file, threadId: thread.id, step, stepName: STEPS[step - 1], topic: question.topic, tags: finalTags, summary: entry.summary, contentReady: Boolean(thread.contentReady), todayCount, totalAnswered: state.counters.answered, message };
}

function main() {
  const options = parseOptions(process.argv.slice(2), { allowed: ['--question-json', '--answer-file', '--thoughts-dir', '--date', '--tags', '--summary'], flags: ['--json'] });
  if (!options.questionJson || !options.answerFile || !options.thoughtsDir) fail('--question-json, --answer-file, --thoughts-dir are required');
  const question = JSON.parse(fs.readFileSync(path.resolve(options.questionJson), 'utf8'));
  if (question.skip) fail('question json is a skip result; nothing to save');
  const answer = fs.readFileSync(path.resolve(options.answerFile), 'utf8');
  const result = saveAnswer({
    question, answer, thoughtsDir: path.resolve(options.thoughtsDir), date: options.date || todayKST(),
    tags: options.tags ? options.tags.split(',').map(tag => tag.trim()).filter(Boolean) : null, summary: options.summary,
  });
  process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.message}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exit(error.exitCode ?? 1); }
}
