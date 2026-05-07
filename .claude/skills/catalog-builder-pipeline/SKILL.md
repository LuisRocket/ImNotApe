---
name: catalog-builder-pipeline
description: ImNotApe 카탈로그 빌더 — outlier-candidates.json (코드 pre-filter 결과)을 입력으로 받아 financial-analyst·game-curator·narrative-writer 3명의 에이전트를 batch 모드로 가동하여 ~100개의 사전 빌드된 Daily Challenge를 한 번에 생성한다. "카탈로그 빌드", "catalog 빌드", "100개 challenge 만들어", "사전 빌드", "쌓아둘 challenge", "다음 분기 카탈로그 갱신" 같은 표현으로 트리거.
---

# Catalog Builder Pipeline — 카탈로그 사전 빌드 오케스트레이터

ImNotApe Daily Challenge의 **사전 빌드 카탈로그**를 만드는 batch 오케스트레이터. `daily-challenge-pipeline`이 *1개씩* 만든다면, 이 스킬은 *N개를 한 번에* 만든다.

## 언제 트리거되나

- 분기 1회 카탈로그 갱신 ("다음 분기 카탈로그 빌드해줘")
- MVP 초기 100개 일괄 생성 ("카탈로그 100개 빌드")
- 새 mode 도입 시 mode별 카탈로그 ("Hard Mode 카탈로그 빌드")

## 실행 모드

**에이전트 팀 + 코드 pre-filter 하이브리드**.

```
Phase 0: 코드가 outlier 후보 추출 (scripts/extract-outlier-candidates.mjs)
       → data/outlier-candidates.json (top 300)
        ↓
Phase 1: financial-analyst (batch) → 200 후보 검토 + ~120 추리기 + era-signal 보강
        ↓
Phase 2: game-curator (batch) → 100개 최종 선정 + 다양성 강제 + funnel·미끼 일괄 설계
        ↓
Phase 3: narrative-writer (batch) → 100개 narrative 일괄 작성
        ↓
Phase 4: 통합 — content/catalog/{TICKER}-{FY}.json 100개 생성
```

## Phase 0: 코드 pre-filter (자동)

스킬 시작 시 `data/outlier-candidates.json`이 존재하고 30일 이내인지 확인:
- 없거나 오래되면: `scripts/extract-outlier-candidates.mjs` 실행 (Bash)
- 있으면 그대로 사용

읽어서 분석가의 입력으로 전달.

## Phase 1: financial-analyst (batch)

**입력**: `data/outlier-candidates.json` 의 top 200 후보 (회사-연도 + 시그널 + snapshot)

**작업**: 코드가 통계적 outlier만 탐지했지만, 분석가는 *왜 그 outlier인지* + *시대 시그널* + *게임 가치*를 평가하여 풍부화한다.
- 각 후보에 대해 `era_signal` 작성 (FY2020 + 매출 -47% → "COVID 록다운 충격")
- 각 후보에 대해 `uniqueness_argument` 작성 (왜 이 회사+연도가 unique한가)
- 부적합 후보 (데이터 품질 X, 너무 generic) 제거
- 200개 → 120개 추림

**출력**: `_workspace/catalog/{batch-id}/01_analyst-enriched.json`

**스킬**: `financial-statement-extractor`의 *시대 시그널 카탈로그* 적극 참조. 각 후보의 시그널을 시대 컨텍스트와 연결.

## Phase 2: game-curator (batch)

**입력**: `01_analyst-enriched.json` (120개)

**작업**:
1. **다양성 강제**: 산업·시대·난이도 분포 균형. 같은 산업에서 5개 이상 안 됨. easy 20%·medium 60%·hard 20%.
2. **유니크성 검증**: 같은 산업에서 비슷한 재무 지문 회사가 둘 이상이면 *둘 중 더 distinctive한 1개만* 채택.
3. **상호 비교**: 120개를 상호 비교하면서 미끼 후보를 *카탈로그 내에서* 찾을 수 있음 (예: COST의 미끼로 BJ가 카탈로그에 있으면 활용도↑).
4. **funnel + 미끼 설계**: 각 승인 후보별로 산업 옵션 7개 + 회사 풀 5개 (정답+미끼 4).

**출력**: `_workspace/catalog/{batch-id}/02_curated.json` — 승인된 100개 + funnel 설계

**스킬**: `game-quality-validator`의 4축 검증, 미끼 선정 원칙. 상호 비교는 *batch만의 추가 기능*.

## Phase 3: narrative-writer (batch)

**입력**: `02_curated.json` (100개)

**작업**: 각 challenge별로 한국어 narrative 작성. 톤·구조 일관성을 위해 batch로 한 번에 작성하되, 회사별 사실 정확도는 개별 검증.

**출력**: 각 challenge에 대해 `_workspace/catalog/{batch-id}/narratives/{TICKER}-{FY}.md`

**스킬**: `event-narrative-writer`의 톤·구조 가이드.

## Phase 4: 통합 + 카탈로그 출력

각 승인 회사-연도에 대해:
1. `data/financials/{TICKER}.json` 에서 해당 fiscal year의 IS/BS/CF/Ratios 추출 (익명화 처리)
2. `02_curated.json`에서 해당 challenge의 funnel·미끼·scoring_hints 가져옴
3. `narratives/{TICKER}-{FY}.md`의 narrative 합침
4. 통합 JSON → `content/catalog/{TICKER}-{FY}.json` (Daily Challenge 동일 스키마)

## 데이터 전달 프로토콜

- 작업 디렉토리: `_workspace/catalog/{YYYY-MM-DD}/`
- 파일 기반 + 태스크 기반 (TaskCreate로 Phase별 진행)
- 메시지 기반 (큐레이터 → 분석가 거절 시 SendMessage로 사유 전달, 단 batch 모드라 거절 빈도 적음 — 큐레이터가 자체 필터링)

## 에러 핸들링

| 에러 | 대응 |
|------|------|
| `data/outlier-candidates.json` 없음 | Phase 0에서 자동 생성 |
| 분석가가 200개 처리 중 컨텍스트 한계 | 배치를 2x100으로 분할 |
| 큐레이터가 100개 미달 (다양성 못 채움) | 분석가에게 추가 후보 요청 (재실행) |
| narrative 작가가 그 해 사건 확인 실패 | 해당 challenge는 *재무 단서 해설*만으로 짧게 마무리, 카탈로그에 포함 |

## 부분 재빌드

`--rebuild=narrative` 같은 플래그로 특정 Phase만 재실행 가능 (예: narrative 톤 변경 후 일괄 재작성).

## 실행 흐름 (사용자 관점)

```
사용자: /catalog-builder-pipeline --count=100
오케스트레이터:
  1. data/outlier-candidates.json 확인 / 생성
  2. TeamCreate(financial-analyst, game-curator, narrative-writer)
  3. Phase 1: 분석가에게 batch 작업 할당 (TaskCreate)
  4. Phase 2: 큐레이터에게 batch 검증 + funnel 설계 할당
  5. Phase 3: 작가에게 batch narrative 할당
  6. Phase 4: 통합 → content/catalog/*.json
  7. 보고: "100개 카탈로그 빌드 완료. 산업·시대 분포: ..."
```

## 테스트 시나리오

**정상 흐름** (초기 카탈로그 빌드):
- outlier-candidates.json 없음 → Phase 0 자동 실행 (top 300 추출)
- 분석가가 top 200 검토, 120개로 추림
- 큐레이터가 다양성 고려해 100개 승인 (산업: Tech 18 / Retail 12 / Energy 11 / Healthcare 10 / Industrial 9 / Financial 9 / Consumer 8 / Travel 7 / Telecom 5 / Media 4 / 기타 7)
- narrative 100개 작성
- content/catalog/*.json 100개 생성

**부분 재실행** (narrative 톤 수정):
- 사용자: "narrative 톤이 너무 격식적, 캐주얼하게 다시 작성해줘"
- 오케스트레이터: Phase 3만 재실행, 기존 narrative 덮어쓰기
- content/catalog/*.json의 narrative 필드만 갱신
