# Thought Coach for OpenClaw

내 OpenClaw 비서가 베이스캠프 모닥불 회고와 지금까지 쌓인 생각을 읽고, **하루에 꼬리 질문 하나**를 텔레그램으로 보내 답을 `thoughts/YYYY-MM-DD.md` 에 모아 주는 스킬입니다. 사실→이유→의미→주장 4단계로 한 생각을 키워, 3주차 Threads·블로그 글감을 만듭니다. 수강생은 **답만 하면** 됩니다.

A daily one-question coach: reads the owner's own reflections, asks a single follow-up question per day via Telegram, and files the answer as raw material for later writing.

- 처음이라면: [10분 퀵스타트](docs/quickstart-ko.md)
- 에이전트가 따르는 절차: [`skill/thought-coach/SKILL.md`](skill/thought-coach/SKILL.md)
- 질문 설계 규칙: [`references/question-ladder.md`](skill/thought-coach/references/question-ladder.md) · 파일 형식: [`references/storage-format.md`](skill/thought-coach/references/storage-format.md)

## 저장소 구조

```
skill/thought-coach/   ← OpenClaw에 설치하는 단위 (이 폴더만 복사)
  SKILL.md · references/ · scripts/
tests/                 ← 개발용 (네트워크·OpenClaw 없이 돈다)
docs/                  ← 사람용 안내
dist/                  ← 릴리스 zip (skill 폴더만 담김)
```

## 설치 — OpenClaw가 있는 곳(VPS) 터미널에서

```bash
git clone https://github.com/IrumHahn/openclaw-thought-coach.git
openclaw skills install ./openclaw-thought-coach/skill/thought-coach --as thought-coach --agent main
openclaw skills list | grep thought-coach     # ready 가 보이면 성공
```

`--agent main` 은 에이전트가 2명 이상일 때 필수입니다. 구버전에 `skills install` 이 없으면 `cp -R skill/thought-coach ~/.openclaw/skills/`. 설치 후 **새 세션**에서 시작합니다.

환경변수 `RUN_ACADEMY_PLAZA_TOKEN` 이 필요합니다(베이스캠프 > 에이전트 연동에서 발급, `rap_s4_…`). 광장 스킬과 같은 토큰입니다.

## 사용

채팅에서 "생각 코치 시작해줘. 매일 밤 9시 반에 질문 하나, 아침 7시 반에 한 번만 리마인드." 비서가 cron 두 개를 등록하고 첫 질문을 보냅니다. 그 뒤로는:

| 시각 (KST) | 일어나는 일 |
|---|---|
| 21:30 | 회고를 가져오고 → 오늘 질문 1개를 고르고 → 텔레그램으로 보냄 |
| 답하면 | `thoughts/<오늘>.md` 에 저장, "오늘 N개째 생각을 저장했어요" 한 줄 |
| 07:30 | 답이 없으면 리마인드 **한 번만**. 그래도 없으면 저녁에 조용히 다음으로 |
| "현황 보여줘" | 질문·답 개수, 진행 중 스레드, 콘텐츠 준비 완료 목록 |

## 하는 것 / 하지 않는 것

| 한다 | 하지 않는다 |
|---|---|
| 회고 읽기 (`GET /api/agent-plaza?view=reflections`) | 광장에 글·댓글 올리기 |
| 주인에게 하루 1질문 + 리마인드 1회 | 다른 사람에게 메시지, 하루 2회 이상 독촉 |
| `thoughts/*.md` + `_state.json` 저장 | 답 고치기, 글 대신 쓰기, 평가·조언 |
| 태그(업무/고객/아이디어/감정/실패)·한 줄 요약 | 주인이 쓴 것 이상의 개인정보 저장 |

## 스크립트 (순수 Node, 에이전트 없이도 실행 가능)

```bash
S=skill/thought-coach/scripts
node $S/fetch_reflections.mjs --out ~/thoughts/_reflections.json         # 종료코드 3=토큰 재발급 필요, 4=네트워크(건너뜀)
node $S/next_question.mjs --thoughts-dir ~/thoughts --reflections ~/thoughts/_reflections.json [--mark-asked] [--mode remind]
node $S/save_answer.mjs --question-json ~/thoughts/_pending.json --answer-file answer.txt --thoughts-dir ~/thoughts
node $S/status.mjs --thoughts-dir ~/thoughts [--json]
```

`next_question` 은 같은 상태에서 항상 같은 질문을 내는 틀 기반 생성기입니다. 에이전트가 자기 말투로 다듬되 2문장·인용 구절은 지킵니다. 자세한 수동 절차는 SKILL.md의 "수동으로 하기".

## 요구 사항

- Node.js 18+, npm 의존성 없음. OpenClaw는 예약 실행과 텔레그램 발송에만 쓰이며 스크립트 자체는 OpenClaw 없이 돕니다.
- 베이스캠프 `view=reflections` 엔드포인트 응답 형식: `{ cohort, owner:{participantId,name}, reflections:[{id,text,createdAt,updatedAt,commentCount}], count }`.

## 개발

```bash
node --test tests/*.test.mjs   # 12 tests, 네트워크 없이 (fetch 주입)
node scripts/pack.mjs          # dist/thought-coach.skill 재생성
```

## 라이선스

MIT.
