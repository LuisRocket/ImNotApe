---
name: daily-challenge-pipeline
description: ImNotApe Daily Challenge 출제 오케스트레이터. S&P 500 회사의 재무제표 기반 산업+회사 추리 게임의 매일 새 문제 1개를 생성한다. "daily challenge 만들어줘", "오늘의 문제 출제", "다음 daily 출제", "Daily 다시 만들어줘", "narrative 수정", "미끼 다시" 같은 표현으로 트리거. ImNotApe 프로젝트의 일일 콘텐츠 생산 파이프라인을 담당한다.
---

# Daily Challenge Pipeline — ImNotApe 일일 출제 오케스트레이터

ImNotApe의 매일 새 Daily Challenge 1문제를 생성하는 파이프라인. financial-analyst, game-curator, narrative-writer 3명의 에이전트 팀을 조율하여 *재무제표 + funnel 선택지 + 정답 narrative*가 통합된 콘텐츠를 산출한다.

## 실행 모드

**에이전트 팀**. 3명의 에이전트가 `TeamCreate`로 구성되며, 생성-검증 루프(분석가 ↔ 큐레이터)와 파이프라인(큐레이터 → 작가)이 결합된 하이브리드 패턴.

## Phase 0: 컨텍스트 확인

워크플로우 시작 시 다음을 확인하여 실행 모드를 결정한다:

| 상태 | 실행 모드 |
|------|----------|
| `_workspace/daily/{date}/` 미존재 | **초기 실행** — 전체 파이프라인 |
| `_workspace/daily/{date}/` 존재 + 사용자가 부분 수정 요청 (예: "narrative만 다시", "미끼 다시") | **부분 재실행** — 해당 에이전트만 호출 |
| `_workspace/daily/{date}/` 존재 + 사용자가 새 문제 요청 | **새 실행** — 기존을 `_workspace/daily/{date}_prev/`로 이동 후 진행 |

날짜는 사용자 요청에 명시된 날짜, 없으면 오늘 날짜(`date '+%Y-%m-%d'`).

또한 *최근 7일 출제 회사 목록*을 `content/daily/` 디렉토리에서 읽어 financial-analyst의 제외 목록으로 전달 (반복 출제 방지).

## Phase 1: 분석가 — 후보 추출

`TeamCreate`로 팀 구성: `financial-analyst`, `game-curator`, `narrative-writer`.

`TaskCreate`로 financial-analyst에게 작업 할당:
- 입력: 오늘 날짜, 제외 목록, S&P 500 풀
- 출력: `_workspace/daily/{date}/01_candidates.json` (후보 3개)

분석가는 `financial-statement-extractor` 스킬을 사용하여 작업 수행.

## Phase 2: 큐레이터 — 검증 + funnel 설계 (생성-검증 루프)

`TaskCreate`로 game-curator에게 작업 할당:
- 입력: `_workspace/daily/{date}/01_candidates.json`
- 출력: `_workspace/daily/{date}/02_curation.json`

**거절 시 루프**:
- 큐레이터가 `decision: "rejected"` 출력 → 자동으로 financial-analyst에게 `SendMessage`로 사유 전달 + 재요청
- 분석가가 새 후보를 `01_candidates.json`에 덮어쓰기 (`01_candidates_v2.json` 권장 — 감사 추적용)
- 큐레이터 재검증
- **최대 3회 루프**, 그 후엔 큐레이터가 가장 덜 부적합한 후보를 받아들임

큐레이터는 `game-quality-validator` 스킬 사용.

## Phase 3: 작가 — Narrative 작성

`TaskCreate`로 narrative-writer에게 작업 할당:
- 입력: `_workspace/daily/{date}/02_curation.json` + (필요시) `01_candidates.json`
- 출력: `_workspace/daily/{date}/03_narrative.md`

작가는 `event-narrative-writer` 스킬 사용.

## Phase 4: 통합 산출물 생성

3개 산출물을 통합하여 게임 콘텐츠 파일 생성:

`content/daily/{date}.json`:
```json
{
  "date": "2026-05-07",
  "challenge": {
    "ticker": "COST",
    "fiscal_year": "FY2023",
    "industry_options": [...],
    "company_pool": [...],
    "financials": {
      "income_statement": {...},
      "balance_sheet": {...},
      "cash_flow": {...}
    }
  },
  "answer": {
    "company": "Costco Wholesale",
    "industry": "Retail / Wholesale Club"
  },
  "scoring": {
    "industry_distance": {...}
  },
  "narrative": "...(03_narrative.md 내용)"
}
```

`financials` 데이터는 FMP MCP에서 직접 가져와서 통합. 회사명/세그먼트명 익명화 처리 (Phase 1 후보 추출 시 분석가가 익명화 가능 여부 표시).

## Phase 5: 팀 정리

`TeamDelete`로 팀 해체. `_workspace/daily/{date}/`는 보존 (감사/재호출 대비).

## 데이터 전달 프로토콜

- **태스크 기반**: TaskCreate/TaskUpdate로 작업 할당 + 진행상황
- **메시지 기반**: 큐레이터 → 분석가 거절/재요청 (SendMessage)
- **파일 기반**: 모든 중간 산출물은 `_workspace/daily/{date}/` 하위에 저장

파일명 컨벤션: `{phase}_{agent}_{artifact}.{ext}`
- `01_candidates.json`
- `02_curation.json`
- `03_narrative.md`

## 에러 핸들링

| 에러 | 대응 |
|------|------|
| FMP API 호출 실패 (분석가) | 1회 재시도. 재실패 시 해당 회사 제외 후 다른 후보로 진행. |
| 큐레이터가 3회 거절 | 가장 덜 부적합한 후보 채택, 산출물에 사유 기록. |
| 작가가 그 해 사건 확인 실패 | narrative 짧게 작성 (단서 해설 위주). 추측 금지. |
| 통합 산출물 생성 실패 | `_workspace/daily/{date}/`는 보존, 사용자에게 사유 보고. |

## 테스트 시나리오

**정상 흐름**:
1. 사용자: "오늘 daily challenge 출제해줘"
2. Phase 0: `_workspace/daily/2026-05-07/` 미존재 확인 → 초기 실행
3. Phase 1: 분석가가 COST/FY2023, NVDA/FY2024, BA/FY2019 3개 후보 제출
4. Phase 2: 큐레이터가 COST/FY2023 승인 + funnel 설계
5. Phase 3: 작가가 narrative 작성
6. Phase 4: `content/daily/2026-05-07.json` 생성

**에러 흐름** (큐레이터 반복 거절):
1. 분석가가 후보 3개 제출 — 모두 빅테크 SaaS
2. 큐레이터: "유니크성 부족, distinctive 재무지문 회사로" 거절
3. 분석가가 v2 제출 — Costco, Tesla, Boeing
4. 큐레이터: COST 승인
5. 정상 흐름 진행

**부분 재실행 흐름**:
1. 사용자: "오늘 daily의 narrative만 다시 작성해줘, 톤이 너무 딱딱해"
2. Phase 0: `_workspace/daily/2026-05-07/` 존재 → 부분 재실행
3. narrative-writer만 호출, 톤 가이드 강조해서 재작성
4. `content/daily/2026-05-07.json`의 narrative 필드만 갱신
