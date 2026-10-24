#!/usr/bin/env node
// 질문·답 개수, 스레드 진행, 콘텐츠 준비 완료 목록을 보여준다. 3주차 주간 리포트의 입력으로도 쓴다.
//   node status.mjs --thoughts-dir <dir> [--date YYYY-MM-DD] [--json]
import path from 'node:path';
import { STEPS, fail, isMain, listThoughtEntries, parseOptions, readState, todayKST } from './lib/store.mjs';

export function buildStatus({ thoughtsDir, date }) {
  const state = readState(thoughtsDir);
  const entries = listThoughtEntries(thoughtsDir);
  const threads = state.threads.map(thread => ({
    id: thread.id, topic: thread.topic, step: thread.step, stepName: thread.step ? STEPS[thread.step - 1] : null,
    contentReady: Boolean(thread.contentReady), lastAsked: thread.lastAsked, lastAnswered: thread.lastAnswered, sourceId: thread.sourceId, sourceType: thread.sourceType,
  }));
  const contentReady = state.threads.filter(thread => thread.contentReady).map(thread => {
    const own = entries.filter(entry => entry.threadId === thread.id);
    const claim = own.find(entry => entry.step === STEPS.length);
    return { threadId: thread.id, topic: thread.topic, claim: claim?.answer ?? thread.claim ?? '', summary: claim?.summary ?? thread.claim ?? '', tags: [...new Set(own.flatMap(entry => entry.tags))], files: [...new Set(own.map(entry => entry.file))] };
  });
  const tagCounts = {};
  for (const entry of entries) for (const tag of entry.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  return {
    date, counters: state.counters, today: entries.filter(entry => entry.date === date).length, totalEntries: entries.length,
    threads, active: threads.filter(thread => !thread.contentReady), contentReady, pending: state.pending, tagCounts,
  };
}

export function renderStatus(status) {
  const lines = [`생각 코치 현황 (${status.date})`];
  lines.push(`- 질문 ${status.counters.asked}회 · 답 ${status.counters.answered}개 · 오늘 ${status.today}개 · 콘텐츠 준비 완료 ${status.contentReady.length}개`);
  if (status.active.length) {
    for (const thread of status.active) lines.push(`- 진행 중: ${thread.id} ${thread.topic} ${thread.step}/${STEPS.length}${thread.lastAnswered ? ` (마지막 답 ${thread.lastAnswered})` : ' (아직 답 없음)'}`);
  } else lines.push('- 진행 중인 스레드 없음 — 다음 질문은 새 주제로 시작합니다');
  for (const item of status.contentReady) lines.push(`- 준비 완료: ${item.threadId} ${item.topic} — "${item.summary}"`);
  if (status.pending) lines.push(`- 대기 중 질문: ${status.pending.threadId} ${status.pending.step}단계 (${status.pending.date} 발송${status.pending.remindedAt ? ', 리마인드 1회 완료' : ''})`);
  const tags = Object.entries(status.tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => `${tag} ${count}`).join(' · ');
  if (tags) lines.push(`- 태그: ${tags}`);
  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseOptions(process.argv.slice(2), { allowed: ['--thoughts-dir', '--date'], flags: ['--json'] });
  if (!options.thoughtsDir) fail('--thoughts-dir <dir> is required');
  const status = buildStatus({ thoughtsDir: path.resolve(options.thoughtsDir), date: options.date || todayKST() });
  process.stdout.write(options.json ? `${JSON.stringify(status, null, 2)}\n` : renderStatus(status));
}

if (isMain(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exit(error.exitCode ?? 1); }
}
