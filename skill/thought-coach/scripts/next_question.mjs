#!/usr/bin/env node
// 오늘 보낼 꼬리 질문 하나를 고른다. 같은 상태에서는 항상 같은 질문이 나온다(결정적).
//   node next_question.mjs --thoughts-dir <dir> [--reflections <json>] [--date YYYY-MM-DD] [--mode ask|remind] [--mark-asked]
// --mark-asked 없이 실행하면 상태를 바꾸지 않는 미리보기다. 실제로 보낸 뒤에만 --mark-asked 로 기록한다.
import fs from 'node:fs';
import path from 'node:path';
import { STEPS, fail, isMain, listThoughtEntries, parseOptions, quoteOf, readState, todayKST, writeState } from './lib/store.mjs';
import { TOPIC_SEED_TAGS, buildQuestion, nextTopic } from './lib/ladder.mjs';

export const REMINDER_PREFIX = '어제 질문에 아직 답이 없어서 한 번만 더 여쭤요.';

function loadReflections(file) {
  if (!file) return [];
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) return [];
  const data = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Array.isArray(data.reflections) ? data.reflections : [];
}

function activeThread(state) {
  const candidates = state.threads.filter(thread => !thread.contentReady && thread.step < STEPS.length);
  if (!candidates.length) return null;
  // 가장 최근에 답이 온 스레드를 이어 간다. 답이 없으면 가장 최근에 물은 것.
  return [...candidates].sort((a, b) => String(b.lastAnswered ?? b.lastAsked ?? '').localeCompare(String(a.lastAnswered ?? a.lastAsked ?? '')))[0];
}

function seedForNewThread(topic, reflections, entries, state) {
  if (topic === '회고') {
    const fresh = reflections.find(item => !state.addressedReflectionIds.includes(item.id));
    if (fresh) return { sourceType: 'reflection', sourceId: fresh.id, quote: quoteOf(fresh.text) };
    return { sourceType: 'opener', sourceId: null, quote: '' };
  }
  const tags = TOPIC_SEED_TAGS[topic] ?? [];
  const usedSources = new Set(state.threads.map(thread => thread.sourceId));
  const seed = [...entries].reverse().find(entry => entry.answer && entry.tags.some(tag => tags.includes(tag)) && !usedSources.has(entry.file));
  if (seed) return { sourceType: 'thought', sourceId: seed.file, quote: quoteOf(seed.answer) };
  return { sourceType: 'opener', sourceId: null, quote: '' };
}

export function planQuestion({ state, reflections, entries, date }) {
  const thread = activeThread(state);
  if (thread) {
    const step = thread.step + 1;
    const lastEntry = [...entries].reverse().find(entry => entry.threadId === thread.id && entry.answer);
    const quote = lastEntry ? quoteOf(lastEntry.answer) : thread.quote;
    return {
      threadId: thread.id, step, stepName: STEPS[step - 1], topic: thread.topic,
      sourceType: thread.sourceType, sourceId: thread.sourceId, quote,
      question: buildQuestion({ step, topic: thread.topic, quote }), newThread: false, date,
    };
  }
  const topic = nextTopic(state.topicCursor);
  const seed = seedForNewThread(topic, reflections, entries, state);
  const threadId = `t${String(state.counters.threadsStarted + 1).padStart(3, '0')}`;
  return {
    threadId, step: 1, stepName: STEPS[0], topic, ...seed,
    question: buildQuestion({ step: 1, topic, quote: seed.quote }), newThread: true, date,
  };
}

export function runAsk({ thoughtsDir, reflections, date, markAsked }) {
  const state = readState(thoughtsDir);
  if (state.pending && state.pending.date === date) {
    return { ...state.pending, mode: 'ask', alreadyAsked: true, newThread: false };
  }
  if (state.pending && state.pending.date !== date) {
    state.counters.unanswered = (state.counters.unanswered ?? 0) + 1; // 어제 질문은 조용히 접는다(재촉 금지)
    state.pending = null;
  }
  const entries = listThoughtEntries(thoughtsDir);
  const plan = planQuestion({ state, reflections, entries, date });
  if (markAsked) {
    const now = new Date().toISOString();
    if (plan.newThread) {
      state.threads.push({ id: plan.threadId, topic: plan.topic, step: 0, lastAsked: date, lastAnswered: null, sourceId: plan.sourceId, sourceType: plan.sourceType, quote: plan.quote, contentReady: false, startedAt: date });
      state.counters.threadsStarted += 1;
      state.topicCursor += 1;
    } else {
      state.threads.find(thread => thread.id === plan.threadId).lastAsked = date;
    }
    state.counters.asked += 1;
    state.pending = { threadId: plan.threadId, step: plan.step, stepName: plan.stepName, topic: plan.topic, sourceType: plan.sourceType, sourceId: plan.sourceId, quote: plan.quote, question: plan.question, date, askedAt: now, remindedAt: null };
    writeState(thoughtsDir, state);
  }
  return { ...plan, mode: 'ask', alreadyAsked: false, marked: Boolean(markAsked) };
}

export function runRemind({ thoughtsDir, date, markAsked }) {
  const state = readState(thoughtsDir);
  if (!state.pending) return { mode: 'remind', skip: true, reason: 'no-pending', date };
  if (state.pending.remindedAt) return { mode: 'remind', skip: true, reason: 'already-reminded', date, threadId: state.pending.threadId };
  if (state.pending.date === date) return { mode: 'remind', skip: true, reason: 'asked-today', date, threadId: state.pending.threadId };
  if (markAsked) {
    state.pending.remindedAt = new Date().toISOString();
    writeState(thoughtsDir, state);
  }
  return { ...state.pending, mode: 'remind', reminder: true, reminderPrefix: REMINDER_PREFIX, skip: false, marked: Boolean(markAsked) };
}

function main() {
  const options = parseOptions(process.argv.slice(2), { allowed: ['--thoughts-dir', '--reflections', '--date', '--mode'], flags: ['--mark-asked'] });
  if (!options.thoughtsDir) fail('--thoughts-dir <dir> is required');
  const date = options.date || todayKST();
  const mode = options.mode || 'ask';
  if (!['ask', 'remind'].includes(mode)) fail('--mode must be ask or remind');
  const thoughtsDir = path.resolve(options.thoughtsDir);
  const result = mode === 'remind'
    ? runRemind({ thoughtsDir, date, markAsked: options.markAsked })
    : runAsk({ thoughtsDir, reflections: loadReflections(options.reflections), date, markAsked: options.markAsked });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exit(error.exitCode ?? 1); }
}
