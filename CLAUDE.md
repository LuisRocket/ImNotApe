# ImNotApe

Financial Statement GeoGuessr — 재무제표 단서로 회사를 추리하는 niche 게임. MVP는 Daily Challenge 단일 모드, S&P 500, 2단계 funnel(산업→회사), 연도 표시.

## 하네스: Daily Challenge 콘텐츠 파이프라인

**목표:** S&P 500 회사의 재무제표 기반 Daily Challenge 1문제(재무제표 + funnel 선택지 + 정답 narrative)를 매일 자동 생성한다.

**트리거:**
- 1개씩 출제·수정: `daily-challenge-pipeline` 스킬 ("daily challenge 만들어줘", "narrative 다시", "미끼 다시")
- N개 일괄 빌드: `catalog-builder-pipeline` 스킬 ("카탈로그 빌드", "100개 challenge", "다음 분기 갱신")
- 단순 게임 디자인 질문이나 코드 작업은 직접 응답 가능

**에이전트 팀**: financial-analyst, game-curator, narrative-writer (3명) — daily/catalog 두 모드 모두에서 재사용

**파이프라인 비교**:
- `daily-challenge-pipeline` — 1개씩, 매일 운영 시. 분석가가 FMP MCP로 후보 추출.
- `catalog-builder-pipeline` — N개 일괄, 분기 갱신 시. 코드 outlier extractor가 pre-filter (`data/outlier-candidates.json`), 분석가는 시대 시그널 풍부화에 집중.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-07 | 초기 구성 | 전체 | MVP 콘텐츠 파이프라인 자동화 |
| 2026-05-08 | catalog-builder-pipeline 추가 + 에이전트 batch 모드 가이드 | skills/catalog-builder-pipeline, agents/* | 데이터 풀 (683 회사 × 10년) 확보 후 사전 빌드 카탈로그 도입. 향후 mode 확장 (Hard Mode, What Happened? 등)에 같은 에이전트 재사용. |

## 향후 확장 (로드맵)

- **scoring-designer 에이전트**: 게임 룰/partial credit 시스템 코드 구현 단계에서 추가
- **Hard Mode**: 연도 숨김 + 연도 추측 funnel 추가 시 분석가/큐레이터 스킬 확장
- **추가 모드**: Guess the Industry, What Happened?, Find the Anomaly, Multi-year Story
