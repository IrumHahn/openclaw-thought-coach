import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const scriptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'thought-coach', 'scripts');

export function run(script, args, env = {}) {
  return spawnSync(process.execPath, [path.join(scriptsDir, script), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}

export function runJson(script, args, env) {
  const result = run(script, args, env);
  if (result.status !== 0) throw new Error(`${script} failed (${result.status}): ${result.stderr}`);
  return JSON.parse(result.stdout);
}

export function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `thought-coach-${prefix}-`));
}

export function writeReflections(dir, reflections) {
  const file = path.join(dir, 'reflections.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, cohort: 's4', owner: { participantId: 'p1', name: '테스트' }, reflections, count: reflections.length }));
  return file;
}

export const sampleReflections = [
  { id: 'r-new', text: '오늘은 에이전트가 처음으로 내 파일을 읽었다. 신기했지만 지시를 세 번이나 고쳤다.', createdAt: '2026-10-21T12:00:00Z', updatedAt: '2026-10-21T12:00:00Z', commentCount: 2 },
  { id: 'r-old', text: '첫 주 발표 준비가 생각보다 오래 걸렸다.', createdAt: '2026-10-14T12:00:00Z', updatedAt: '2026-10-14T12:00:00Z', commentCount: 0 },
];

// 질문 JSON → 파일, 답 → 파일 로 저장한 뒤 save_answer 를 실행한다.
export function answer(dir, thoughtsDir, question, text, date, extra = []) {
  const qFile = path.join(dir, `q-${question.threadId}-${question.step}.json`);
  const aFile = path.join(dir, `a-${question.threadId}-${question.step}.txt`);
  fs.writeFileSync(qFile, JSON.stringify(question));
  fs.writeFileSync(aFile, text);
  return run('save_answer.mjs', ['--question-json', qFile, '--answer-file', aFile, '--thoughts-dir', thoughtsDir, '--date', date, ...extra]);
}
