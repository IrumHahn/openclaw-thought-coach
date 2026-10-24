#!/usr/bin/env node
// 베이스캠프 모닥불 회고를 가져와 정규화한다. fetch 를 주입할 수 있어 네트워크 없이 테스트된다.
//   node fetch_reflections.mjs --out <json> [--token-env RUN_ACADEMY_PLAZA_TOKEN] [--base-url https://run-academy.pages.dev] [--limit 30]
// 종료코드: 0 성공 · 3 토큰 거부(401/403) · 4 네트워크 오류(오늘은 조용히 건너뜀) · 1 그 외
import fs from 'node:fs';
import path from 'node:path';
import { fail, isMain, parseOptions } from './lib/store.mjs';

export const DEFAULT_BASE_URL = 'https://run-academy.pages.dev';
export const DEFAULT_TOKEN_ENV = 'RUN_ACADEMY_PLAZA_TOKEN';
export const MESSAGES = {
  unauthorized: '베이스캠프 토큰이 거부됐어요(401). 베이스캠프 > 에이전트 연동에서 토큰을 다시 발급해 RUN_ACADEMY_PLAZA_TOKEN 에 넣어주세요.',
  missingToken: 'RUN_ACADEMY_PLAZA_TOKEN 이 비어 있어요. 베이스캠프 > 에이전트 연동에서 발급한 rap_ 토큰을 환경변수로 넣어주세요.',
  network: '베이스캠프에 연결하지 못했어요. 오늘은 회고 없이 건너뛰고 내일 다시 시도합니다.',
};

export class FetchReflectionsError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code; // 'unauthorized' | 'network' | 'http' | 'missing-token' | 'bad-shape'
    this.status = status;
    this.exitCode = code === 'unauthorized' || code === 'missing-token' ? 3 : code === 'network' ? 4 : 1;
  }
}

export function normalizeReflections(payload, { fetchedAt = new Date().toISOString() } = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.reflections)) {
    throw new FetchReflectionsError('bad-shape', 'response did not contain a reflections array');
  }
  const reflections = payload.reflections
    .filter(item => item && typeof item.id === 'string' && typeof item.text === 'string' && item.text.trim())
    .map(item => ({
      id: item.id,
      text: item.text.trim(),
      createdAt: item.createdAt ?? null,
      updatedAt: item.updatedAt ?? item.createdAt ?? null,
      commentCount: Number.isFinite(item.commentCount) ? item.commentCount : 0,
    }))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))); // 최신 먼저
  return {
    version: 1,
    fetchedAt,
    cohort: payload.cohort ?? null,
    owner: { participantId: payload.owner?.participantId ?? null, name: payload.owner?.name ?? null },
    reflections,
    count: reflections.length,
  };
}

export async function fetchReflections({ baseUrl = DEFAULT_BASE_URL, token, limit = 30, fetchImpl = globalThis.fetch } = {}) {
  if (!token || !String(token).trim()) throw new FetchReflectionsError('missing-token', MESSAGES.missingToken);
  const url = `${baseUrl.replace(/\/$/, '')}/api/agent-plaza?view=reflections&limit=${Number(limit) || 30}`;
  let response;
  try {
    response = await fetchImpl(url, { headers: { Authorization: `Bearer ${String(token).trim()}`, Accept: 'application/json' } });
  } catch (error) {
    throw new FetchReflectionsError('network', `${MESSAGES.network} (${error?.message ?? error})`);
  }
  if (response.status === 401 || response.status === 403) throw new FetchReflectionsError('unauthorized', MESSAGES.unauthorized, response.status);
  if (!response.ok) throw new FetchReflectionsError('http', `베이스캠프가 ${response.status} 를 돌려줬어요. 잠시 뒤 다시 시도하세요.`, response.status);
  let payload;
  try { payload = await response.json(); } catch { throw new FetchReflectionsError('bad-shape', 'response was not JSON'); }
  return normalizeReflections(payload);
}

async function main() {
  const options = parseOptions(process.argv.slice(2), { allowed: ['--out', '--token-env', '--base-url', '--limit'] });
  if (!options.out) fail('--out <json> is required');
  const tokenEnv = options.tokenEnv || DEFAULT_TOKEN_ENV;
  const result = await fetchReflections({ baseUrl: options.baseUrl || DEFAULT_BASE_URL, token: process.env[tokenEnv], limit: options.limit || 30 });
  const out = path.resolve(options.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ ok: true, out, count: result.count, owner: result.owner.name, fetchedAt: result.fetchedAt })}\n`);
}

if (isMain(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode ?? 1);
  });
}
