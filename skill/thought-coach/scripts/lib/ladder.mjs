// 4단계 사다리(사실→이유→의미→주장)와 주제 순환에 따른 질문 템플릿. 결정적(deterministic)이라 테스트 가능하다.
// 에이전트는 SKILL.md 지침에 따라 이 문장을 자기 말투로 다듬을 수 있지만, 2문장 이내와 인용 구절은 유지한다.
import { STEPS, TOPICS } from './store.mjs';

// 새 스레드 첫 질문(사실 단계)에 쓰는 주제별 오프너 — 인용할 원문이 없을 때.
export const OPENERS = {
  '회고': '아직 모닥불 회고가 없어서 직접 여쭤볼게요. 이번 주에 가장 기억에 남는 장면 하나만 들려주세요.',
  '업무': '요즘 일에서 가장 시간을 많이 쓰는 일은 무엇인가요? 오늘 그 일을 하면서 실제로 있었던 일 하나만 들려주세요.',
  '고객': '최근에 고객(또는 동료, 가족)이 한 말 중에 머리에 남은 말이 있나요? 그 말이 나온 상황을 들려주세요.',
  '실패': '최근에 계획대로 안 된 일이 하나 있다면 무엇인가요? 그때 실제로 무슨 일이 있었는지만 적어주세요.',
  '아이디어': '요즘 "이거 해보면 어떨까" 싶은 생각이 있나요? 그 생각이 처음 떠오른 순간을 들려주세요.',
  'AI 에이전트 경험': '이번 주에 에이전트에게 시킨 일 중 가장 기억나는 것은 무엇인가요? 어떤 요청을 했고 무엇이 돌아왔는지 들려주세요.',
};

// 인용할 원문이 있을 때의 사실 단계 질문 — 주제별로 초점만 다르다.
const FACT_WITH_QUOTE = {
  '회고': quote => `회고에 "${quote}"라고 쓰셨네요. 그날 실제로 무슨 일이 있었는지 장면 하나만 들려주세요.`,
  '업무': quote => `"${quote}"라고 하셨죠. 그 일을 하던 중에 실제로 있었던 일 하나만 들려주세요.`,
  '고객': quote => `"${quote}"에 나오는 사람은 누구였나요? 그 사람과 실제로 어떤 일이 있었는지 들려주세요.`,
  '실패': quote => `"${quote}" 이 부분, 계획과 다르게 간 지점이 있었나요? 그때 실제로 무슨 일이 있었는지 적어주세요.`,
  '아이디어': quote => `"${quote}"라고 하셨는데, 그 생각이 떠오른 순간에 무슨 일이 있었나요? 상황만 짧게 들려주세요.`,
  'AI 에이전트 경험': quote => `"${quote}"에서 에이전트에게 정확히 뭐라고 시켰고, 무엇이 돌아왔나요? 있었던 일만 들려주세요.`,
};

const FOLLOW_UPS = {
  2: quote => `"${quote}"라고 하셨는데, 왜 그렇게 됐다고 생각하세요? 떠오르는 이유를 하나만 꼽아주세요.`,
  3: quote => `"${quote}" — 여기서 배운 것은 무엇인가요? 내 고객(또는 독자)에게는 어떤 의미가 있을지도 한 줄 덧붙여주세요.`,
  4: quote => `"${quote}"까지 왔네요. 이 이야기를 남에게 딱 한 문장으로 말한다면 뭐라고 하시겠어요?`,
};

export function nextTopic(cursor) {
  return TOPICS[((cursor % TOPICS.length) + TOPICS.length) % TOPICS.length];
}

// 주제가 아닐 때 최근 생각에서 씨앗을 고를 태그 매핑.
export const TOPIC_SEED_TAGS = {
  '업무': ['업무'],
  '고객': ['고객'],
  '실패': ['실패', '감정'],
  '아이디어': ['아이디어'],
  'AI 에이전트 경험': ['업무', '아이디어'],
};

export function buildQuestion({ step, topic, quote }) {
  if (step < 1 || step > STEPS.length) throw new Error(`invalid step: ${step}`);
  if (step === 1) {
    if (!quote) return OPENERS[topic] ?? OPENERS['회고'];
    return (FACT_WITH_QUOTE[topic] ?? FACT_WITH_QUOTE['회고'])(quote);
  }
  if (!quote) throw new Error('follow-up questions need a quote from the previous answer');
  return FOLLOW_UPS[step](quote);
}
