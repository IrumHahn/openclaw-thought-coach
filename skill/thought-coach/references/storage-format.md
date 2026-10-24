# 저장 형식 — `thoughts/`

모두 **내 워크스페이스** 안 `thoughts/` 에 둔다. 공개 저장소·광장에 올리지 않는다. 스크립트가 쓰는 파일은 권한 0600.

```
<workspace>/thoughts/
  2026-10-24.md        ← 하루 한 항목(드물게 둘). 사람이 읽는 원본
  2026-10-25.md
  _state.json          ← 스레드·카운터. 스크립트만 고친다
  _reflections.json    ← fetch_reflections 결과 캐시(최근 30개). 지워도 됨
  _pending.json        ← 마지막 --mark-asked 출력. 답이 오면 save_answer 에 넘긴다
```

## `YYYY-MM-DD.md`

```
---
date: 2026-10-24
thread: t001
step: 1/4 사실
topic: 회고
source: reflection:abc123        ← reflection:<id> | thought:<파일명> | opener
question: 회고에 "…"라고 쓰셨네요. 그날 실제로 무슨 일이 있었는지 장면 하나만 들려주세요.
tags: 업무, 실패                  ← 업무 / 고객 / 아이디어 / 감정 / 실패 중 0~5개
summary: 에이전트가 엉뚱한 폴더를 읽어 지시를 세 번 고쳤다   ← 한 줄
---

## 질문
(질문 전문)

## 답
(주인이 쓴 답, 원문 그대로)

```

- 같은 날 항목이 둘이면 두 번째 블록이 `---\ndate:` 로 다시 시작한다. `parseThoughtFile`이 그 기준으로 나눈다.
- 태그는 `save_answer`가 답 본문의 단어로 자동 추정하고, 하나도 안 걸리면 주제가 태그 목록에 있을 때 주제를 넣는다. `--tags`로 덮어쓸 수 있다.
- 요약은 기본값이 답의 첫 문장(60자). `--summary`로 덮어쓸 수 있다. 4단계(주장)의 요약이 스레드의 `claim`이 된다.
- 답 본문은 고치지 않는다. 앞뒤 공백만 정리한다.

## `_state.json`

```json
{
  "version": 1,
  "threads": [
    { "id": "t001", "topic": "회고", "step": 4, "lastAsked": "2026-10-24", "lastAnswered": "2026-10-24",
      "sourceId": "abc123", "sourceType": "reflection", "quote": "오늘은 에이전트가 처음으로 내 파일을 읽었다.",
      "contentReady": true, "claim": "에이전트는 신입사원처럼 대하라.", "startedAt": "2026-10-21" }
  ],
  "counters": { "asked": 5, "answered": 4, "contentReady": 1, "threadsStarted": 2, "unanswered": 0 },
  "topicCursor": 2,
  "addressedReflectionIds": ["abc123"],
  "pending": { "threadId": "t002", "step": 1, "stepName": "사실", "topic": "업무", "question": "…", "date": "2026-10-25", "askedAt": "…", "remindedAt": null },
  "updatedAt": "…"
}
```

- `threads[].step` = **답이 저장된** 단계 수(0~4). 다음 질문은 `step + 1`.
- `counters.asked` 는 `--mark-asked` 횟수, `answered` 는 저장된 답 수. "오늘 N개째"는 그날 파일의 항목 수.
- `pending` 이 있으면 답을 기다리는 중. `save_answer`가 비운다. 날짜가 지나면 21:30 실행이 `unanswered` 를 올리고 비운다.
- 사람이 손으로 고쳐야 할 일은 없다. 깨졌으면 `_state.json` 만 지우고 `thoughts/*.md`는 남긴다 — 단, 그러면 카운터와 스레드가 0부터 시작하므로 그 전에 `status.mjs --json` 출력을 보관한다.

## 개인정보

- 저장되는 것은 주인이 직접 쓴 회고 구절·답과 그것의 태그·요약뿐이다. 이름·연락처·다른 수강생의 글은 저장하지 않는다.
- `_reflections.json` 에는 API 응답의 `owner.name` 이 들어간다. 주인 본인 이름이며 외부로 보내지 않는다.
- 토큰은 환경변수로만 받고 어떤 파일에도 쓰지 않는다.
