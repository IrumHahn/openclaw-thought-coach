---
name: thought-coach
description: 주인의 베이스캠프 모닥불 회고와 지금까지 쌓인 생각을 읽고, 하루에 꼬리 질문 하나를 텔레그램으로 보내 답을 thoughts/YYYY-MM-DD.md 에 쌓는다. 4단계 사다리(사실→이유→의미→주장)로 한 생각을 콘텐츠 재료가 될 때까지 키운다. "생각 코치 시작해줘", "오늘 질문 보내줘", "내 생각 현황", "꼬리 질문" 같은 요청과 매일 21:30 / 07:30 예약 실행에 사용. 광장에 글을 올리거나 다른 사람에게 메시지를 보내는 용도가 아님.
---

# Thought Coach — 하루 한 질문으로 생각 쌓기

이 스킬은 **글을 대신 써 주는 도구가 아니다.** 주인이 이미 쓴 회고와 답에서 짧은 구절을 집어 **하루에 딱 하나** 꼬리 질문을 보내고, 돌아온 답을 날짜별 파일에 모은다. 주인은 답만 하면 된다. 3주차에 Threads·블로그 글을 쓸 때 이 파일들이 재료가 된다.

주인에게는 **주인의 언어**(한국어 수강생이면 한국어)로, 이미 정해진 **내 페르소나의 말투**로 말한다. 질문 문장은 스크립트가 만든 틀을 내 말투로 다듬어도 되지만, 아래 "질문 다듬기 규칙"을 어기지 않는다.

## 0. 먼저 알아둘 것 (에이전트용)

- 이 스킬 폴더의 `references/`와 `scripts/`만 있으면 동작한다. 저장소의 `tests/`·`docs/`는 필요 없다. Node 18+, npm 의존성 없음.
- 저장 위치는 **내 워크스페이스의 `thoughts/`** 다. 아래에서 `<workspace>/thoughts` 로 쓴다. 다른 에이전트의 워크스페이스에 쓰지 않는다.
- 회고를 가져오려면 환경변수 `RUN_ACADEMY_PLAZA_TOKEN`(베이스캠프 > 에이전트 연동에서 발급, `rap_s4_…` 형식)이 필요하다. 광장(plaza) 스킬과 같은 토큰이다. **토큰 값을 채팅·로그·파일에 적지 않는다.**
- 이 스킬은 **읽기만** 한다: 광장에 글·댓글을 올리지 않고, 주인 외 누구에게도 메시지를 보내지 않으며, 주인이 쓴 것 이상의 개인정보를 저장하지 않는다.
- 상태를 바꾸는 명령은 `--mark-asked`(질문을 실제로 보낸 뒤)와 `save_answer`(답을 받은 뒤)뿐이다. 미리보기만 할 때는 둘 다 쓰지 않는다.

먼저 `references/question-ladder.md`(질문 설계 규칙)와 `references/storage-format.md`(파일 형식)를 읽는다.

## 1. 매일 저녁 21:30 — 질문 하나 보내기

예약 실행(OpenClaw cron 또는 heartbeat)이 이 절차를 부른다. 사람이 "오늘 질문 보내줘"라고 해도 같다.

```bash
mkdir -p <workspace>/thoughts            # 처음 한 번 (출력 리디렉션 전에 폴더가 있어야 한다)
# ① 회고 가져오기 (실패해도 ②로 간다)
node <skill-dir>/scripts/fetch_reflections.mjs --out <workspace>/thoughts/_reflections.json
# ② 오늘 질문 고르기 (미리보기 — 아직 상태를 바꾸지 않음)
node <skill-dir>/scripts/next_question.mjs --thoughts-dir <workspace>/thoughts --reflections <workspace>/thoughts/_reflections.json
```

①의 종료코드별 행동:

| 코드 | 뜻 | 할 일 |
|---|---|---|
| 0 | 성공 | `_reflections.json` 갱신됨. ②로 |
| 3 | 토큰 없음/거부(401) | 주인에게 **한 번만** 알린다: "베이스캠프 > 에이전트 연동에서 토큰을 다시 발급해 `RUN_ACADEMY_PLAZA_TOKEN` 에 넣어주세요." 그래도 ②는 진행한다(이전에 받아 둔 회고나 오프너로 질문 가능) |
| 4 | 네트워크 오류 | 조용히 건너뛴다. 로그에만 남기고 주인에게 사과 메시지를 보내지 않는다. ②는 진행 |

②의 출력 JSON을 읽는다. `alreadyAsked: true` 면 오늘 이미 보낸 것이니 **다시 보내지 않고 끝낸다.** 아니면:

1. `question`을 내 말투로 다듬는다(아래 규칙). `quote`(주인이 쓴 구절)는 반드시 그대로 들어가야 한다.
2. 연결된 텔레그램 채널로 **주인에게만** 보낸다. 첫 질문이면 한 줄 안내를 앞에 붙인다: "매일 저녁 질문 하나씩 드릴게요. 답은 편하게 한두 줄이면 충분해요."
3. 보낸 직후 같은 명령에 `--mark-asked` 를 붙여 다시 실행해 기록한다. 그 출력 JSON을 `<workspace>/thoughts/_pending.json` 에 저장해 둔다(답이 오면 `save_answer`에 넘길 파일).

```bash
node <skill-dir>/scripts/next_question.mjs --thoughts-dir <workspace>/thoughts --reflections <workspace>/thoughts/_reflections.json --mark-asked > <workspace>/thoughts/_pending.json
```

**완료 기준:** 텔레그램에 질문 1개가 갔고, `_state.json`의 `pending`에 오늘 날짜가 적혀 있다.

### 질문 다듬기 규칙

- **2문장 이내.** 스크립트 출력도 2문장이다. 늘리지 않는다.
- 주인이 쓴 구절(`quote`)을 따옴표로 인용한다. 인용 없이 일반론 질문을 만들지 않는다.
- 단계(`stepName`)의 초점을 바꾸지 않는다: 사실=무슨 일이 있었나, 이유=왜 그렇게 됐나, 의미=배운 것·고객에게 어떤 의미, 주장=남에게 한 문장으로.
- 평가·조언·칭찬을 섞지 않는다. 질문만 한다. "좋은 회고네요!" 같은 문장도 넣지 않는다.
- 선택지를 주지 않는다. 열린 질문 하나.

## 2. 답이 왔을 때 — 저장하고 "오늘 N개째"

주인이 텔레그램으로 보낸 메시지가 **대기 중 질문에 대한 답**인지 판단한다. 기준: `_state.json`의 `pending`이 있고, 메시지가 질문을 받은 뒤에 왔으며, 명령("현황 보여줘", "질문 바꿔줘")이나 다른 업무 요청이 아니다. 애매하면 "방금 그게 어제 질문 답이 맞나요?"라고 **한 번만** 확인한다.

답이 맞으면 답 본문을 파일로 쓰고(한글·따옴표·줄바꿈 안전) 저장한다:

```bash
node <skill-dir>/scripts/save_answer.mjs --question-json <workspace>/thoughts/_pending.json --answer-file <답을 쓴 임시 파일> --thoughts-dir <workspace>/thoughts
```

마지막 줄 출력(예: `오늘 1개째 생각을 저장했어요 — 전체 7개 · t002 3/4 의미`)을 내 말투로 바꿔 짧게 알린다. 그 외 말을 덧붙이지 않는다 — 답에 대한 평가도, 다음 질문도 하지 않는다(다음 질문은 내일 21:30). `콘텐츠로 쓸 준비가 됐어요`가 붙으면 그 문구는 꼭 전한다: 이 생각은 4단계를 다 거쳐 글감이 된 것이다.

태그와 요약은 스크립트가 자동으로 붙인다. 답을 읽고 더 맞는 태그(업무/고객/아이디어/감정/실패)가 보이면 `--tags`로, 한 줄 요약을 더 잘 쓸 수 있으면 `--summary`로 넘긴다. 답 본문은 **절대 고치지 않는다.**

주인이 "이 질문은 넘어갈래요"라고 하면 저장하지 않고 "알겠어요, 내일 다른 질문 드릴게요"로 끝낸다. 다음 날 21:30에 스크립트가 같은 스레드의 같은 단계를 다시 고르면 그때는 다른 표현으로 다듬어 묻되, 두 번 연속 넘기면 그 스레드는 묻지 말고 주인에게 "이 주제는 접을까요?"라고 묻는다.

**완료 기준:** `thoughts/<오늘>.md`에 항목이 추가됐고, `pending`이 비었고, 주인이 "오늘 N개째" 한 줄을 받았다.

## 3. 아침 07:30 — 리마인드는 한 번만

```bash
node <skill-dir>/scripts/next_question.mjs --thoughts-dir <workspace>/thoughts --mode remind
```

- `skip: true` 면 아무것도 보내지 않는다(답이 이미 왔거나, 이미 한 번 리마인드했거나, 대기 중 질문이 없음).
- `reminder: true` 면 `reminderPrefix` + 같은 질문을 **한 번** 보내고, 즉시 `--mark-asked` 를 붙여 리마인드 기록을 남긴다.
- 그래도 답이 없으면 **그날 저녁 21:30에 조용히 접고** 다음 질문으로 간다. 세 번째 독촉은 없다. 답을 안 한 이유를 묻지 않는다.

## 4. "현황 보여줘"

```bash
node <skill-dir>/scripts/status.mjs --thoughts-dir <workspace>/thoughts
```

출력을 그대로 전하거나 내 말투로 요약한다. 콘텐츠 준비 완료 항목이 있으면 "이 생각은 글로 써 볼 만해요"라고 한 줄 덧붙여도 된다. 주간 리포트 스킬이 `--json` 출력을 가져다 쓴다.

## 실행학교 수강생이면

**2주차 화요일 설치 (10분):**

1. 베이스캠프 > 에이전트 연동에서 토큰을 발급받아 VPS의 OpenClaw 환경변수 `RUN_ACADEMY_PLAZA_TOKEN`에 넣는다. 이미 광장 스킬을 쓰고 있으면 같은 토큰이라 추가 작업이 없다.
2. 이 스킬을 설치한 뒤(README 참고) 비서에게 말한다: **"생각 코치 시작해줘. 매일 밤 9시 반에 질문 하나, 아침 7시 반에 한 번만 리마인드."**
3. 에이전트는 cron 두 개를 등록한다 — `30 21 * * *` (Asia/Seoul)에 1단계, `30 7 * * *`에 3단계. 등록 명령은 설치된 OpenClaw 버전의 `openclaw cron add --help`(또는 heartbeat 설정)를 확인한 뒤 쓴다. OpenClaw 2026.10.x 에서 확인된 형태(에이전트 잡, 텔레그램으로 주인에게만 전달):

   ```bash
   openclaw cron add --name thought-coach-ask --agent main --cron "30 21 * * *" --tz Asia/Seoul \
     --channel telegram --to <주인 텔레그램 chatId> --announce \
     --message "thought-coach 스킬 1단계(매일 저녁 질문 하나 보내기)를 실행해. 완료 기준: 질문 1개 전송 + --mark-asked 기록."
   openclaw cron add --name thought-coach-remind --agent main --cron "30 7 * * *" --tz Asia/Seoul \
     --channel telegram --to <주인 텔레그램 chatId> --announce \
     --message "thought-coach 스킬 3단계(아침 리마인드, --mode remind)를 실행해. skip:true 면 아무것도 보내지 마."
   ```

   `--to` 가 없으면 `--channel last`(마지막 대화 채널)로 간다. 등록 전 주인에게 두 시각과 채널을 확인받는다. 등록했으면 주인에게 **두 시각과 채널 이름**을 보여 주고, 첫 질문은 바로 한 번 보내 본다. `openclaw cron list` 로 등록을 확인할 수 있다.
4. 첫 답을 받으면 `thoughts/<오늘>.md`를 열어 보여 준다. 주인이 "내 글이 저장되는 곳"을 알아야 한다.

**3주차 목표:** 3주차 화요일까지 **답 7개 이상**, 콘텐츠 준비 완료 스레드 1개 이상. 매일 답하면 7일 안에 두 번째 스레드까지 간다. 3주차 수업에서 `status.mjs --json`의 `contentReady`를 Threads/블로그 초안의 출발점으로 쓴다.

## 수동으로 하기 (B 트랙 — 에이전트 없이)

OpenClaw 예약 실행이 아직 안 되거나 PC에서 직접 돌려 보고 싶을 때. 세 명령을 손으로 친다.

```bash
export RUN_ACADEMY_PLAZA_TOKEN='rap_s4_…'     # 터미널에서만, 파일에 적지 않기
cd <이 스킬 폴더>/scripts
mkdir -p ~/thoughts

# 1) 회고 가져오기 (안 되면 건너뛰어도 질문은 나온다)
node fetch_reflections.mjs --out ~/thoughts/_reflections.json

# 2) 오늘 질문 보기 → 마음에 들면 --mark-asked 로 기록
node next_question.mjs --thoughts-dir ~/thoughts --reflections ~/thoughts/_reflections.json
node next_question.mjs --thoughts-dir ~/thoughts --reflections ~/thoughts/_reflections.json --mark-asked > ~/thoughts/_pending.json

# 3) 답을 파일에 쓰고 저장
cat > ~/thoughts/_answer.txt      # 답을 적고 Ctrl-D
node save_answer.mjs --question-json ~/thoughts/_pending.json --answer-file ~/thoughts/_answer.txt --thoughts-dir ~/thoughts

# 현황
node status.mjs --thoughts-dir ~/thoughts
```

`--mark-asked` 없이 2)의 출력을 바로 파일에 저장해 3)에 넘겨도 된다(1단계 질문일 때). `--date YYYY-MM-DD`를 붙이면 날짜를 고정할 수 있다(밀린 답을 나중에 적을 때).

## 지켜야 할 경계

- 하루 질문 1개, 리마인드 1회. 주인이 "오늘 하나 더"라고 명시적으로 요청할 때만 예외다. 그때는 첫 답을 저장한 뒤 `next_question.mjs`를 **`--mark-asked` 없이** 실행해(같은 날 두 번째 기록은 `alreadyAsked`로 막힌다) 그 미리보기 JSON으로 질문하고, 답은 그 JSON을 `--question-json`으로 넘겨 저장한다.
- 광장 API는 `view=reflections` 읽기만 호출한다. 글·댓글 작성 엔드포인트는 이 스킬에서 호출하지 않는다.
- 주인이 쓴 글을 요약·태그 외의 형태로 가공해 다른 곳에 저장하지 않는다. `thoughts/`를 공개 저장소에 올리지 않는다.
- 답을 고치거나 "더 좋은 표현"을 제안하지 않는다. 3주차 글쓰기 단계에서 할 일이다.
- 스크립트가 실패하면 **어디까지 됐는지**(질문은 갔는지, 저장은 됐는지)를 정확히 말한다. 저장됐다고 지어내지 않는다.
