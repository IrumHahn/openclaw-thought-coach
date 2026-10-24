// thoughts/ 디렉터리와 _state.json 을 읽고 쓰는 공용 모듈. npm 의존성 없음.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STEPS = ['사실', '이유', '의미', '주장'];
export const TOPICS = ['회고', '업무', '고객', '실패', '아이디어', 'AI 에이전트 경험'];
export const TAGS = ['업무', '고객', '아이디어', '감정', '실패'];
export const STATE_FILE = '_state.json';

export function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

// KST(UTC+9) 기준 날짜 문자열. 테스트에서는 --date 로 고정한다.
export function todayKST(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function defaultState() {
  return {
    version: 1,
    threads: [],
    counters: { asked: 0, answered: 0, contentReady: 0, threadsStarted: 0 },
    topicCursor: 0,
    addressedReflectionIds: [],
    pending: null,
    updatedAt: null,
  };
}

export function readState(thoughtsDir) {
  const file = path.join(thoughtsDir, STATE_FILE);
  if (!fs.existsSync(file)) return defaultState();
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== 1 || !Array.isArray(state.threads)) fail(`invalid state file: ${file}`);
  return { ...defaultState(), ...state, counters: { ...defaultState().counters, ...state.counters } };
}

export function writeState(thoughtsDir, state) {
  fs.mkdirSync(thoughtsDir, { recursive: true });
  const file = path.join(thoughtsDir, STATE_FILE);
  const temporary = `${file}.${process.pid}.tmp`;
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}

// 원문에서 인용할 짧은 구절(첫 문장, 최대 maxLength자)을 고른다.
export function quoteOf(text, maxLength = 40) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const sentence = flat.split(/(?<=[.!?。]|다\.|요\.)\s/)[0] || flat;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength).trim()}…` : sentence;
}

// ---- thoughts/YYYY-MM-DD.md 파싱 ----
// 한 파일에 항목이 여러 개면 각각 `---` 헤더 블록으로 시작한다.
export function parseThoughtFile(content) {
  const entries = [];
  const blocks = content.split(/^---\n(?=date:)/m).filter(block => block.trim());
  for (const block of blocks) {
    const end = block.indexOf('\n---\n');
    if (end === -1) continue;
    const header = {};
    for (const line of block.slice(0, end).split('\n')) {
      const match = line.match(/^([a-z]+):\s?(.*)$/);
      if (match) header[match[1]] = match[2];
    }
    const body = block.slice(end + 5);
    const answerMatch = body.match(/## 답\n([\s\S]*?)(?:\n## |\s*$)/);
    entries.push({
      date: header.date,
      threadId: header.thread,
      step: Number((header.step || '').split('/')[0]) || null,
      stepName: (header.step || '').split(' ')[1] || null,
      topic: header.topic,
      source: header.source,
      question: header.question,
      tags: (header.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
      summary: header.summary || '',
      answer: (answerMatch ? answerMatch[1] : '').trim(),
    });
  }
  return entries;
}

export function listThoughtEntries(thoughtsDir) {
  if (!fs.existsSync(thoughtsDir)) return [];
  const files = fs.readdirSync(thoughtsDir).filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort();
  return files.flatMap(name => parseThoughtFile(fs.readFileSync(path.join(thoughtsDir, name), 'utf8')).map(entry => ({ ...entry, file: name })));
}

export function formatThoughtEntry(entry) {
  const header = [
    `date: ${entry.date}`,
    `thread: ${entry.threadId}`,
    `step: ${entry.step}/${STEPS.length} ${STEPS[entry.step - 1]}`,
    `topic: ${entry.topic}`,
    `source: ${entry.source}`,
    `question: ${entry.question.replace(/\s+/g, ' ')}`,
    `tags: ${entry.tags.join(', ')}`,
    `summary: ${entry.summary.replace(/\s+/g, ' ')}`,
  ].join('\n');
  return `---\n${header}\n---\n\n## 질문\n${entry.question}\n\n## 답\n${entry.answer.trim()}\n\n`;
}

// 간단한 옵션 파서: --key value / --flag
export function parseOptions(args, { allowed, flags = [] }) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith('--')) fail(`unexpected argument: ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (flags.includes(key)) { result[name] = true; continue; }
    if (!allowed.includes(key)) fail(`invalid option: ${key}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`${key} needs a value`);
    result[name] = value;
    index += 1;
  }
  return result;
}

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
