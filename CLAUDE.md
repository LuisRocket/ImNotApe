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
| 2026-05-07 | 초기 구성 (3 에이전트 + 4 스킬) | 전체 | MVP 콘텐츠 파이프라인 자동화 |
| 2026-05-07 | 첫 테스트 런 (Costco FY2024) | content/daily/2026-05-07.json | 파이프라인 검증 — 4 phase 모두 작동 |
| 2026-05-08 | 데이터 레이어 추가 (683 회사 × 10년) | data/financials/, sp500.json | 매일 LLM이 FMP 호출하는 비효율 제거. 향후 카탈로그·코드 outlier의 입력 |
| 2026-05-08 | 코드 outlier extractor | scripts/extract-outlier-candidates.mjs | 18개 시그널 룰로 6,830 후보 → top 300. 분석가의 batch 입력 pre-filter |
| 2026-05-08 | catalog-builder-pipeline 추가 + 에이전트 batch 모드 가이드 | skills/catalog-builder-pipeline, agents/* | Stage 4 아키텍처 결정 — 하네스를 daily용 1개 + catalog용 1개로 운영. 향후 mode 확장 시 같은 에이전트 재사용 (docs/HARNESS_JOURNAL.md 참조) |
| 2026-05-08 | 첫 카탈로그 빌드 (30개) | content/catalog/ | catalog-builder-pipeline 검증 — 4 phase 모두 작동, ~30분, daily 30번 대비 ~10x 효율 |
| 2026-05-08 | Harness Journal 추가 | docs/HARNESS_JOURNAL.md | 결정 *왜* + 교훈 narrative 기록. 변경 이력은 *무엇*을, journal은 *왜*를. |

## 향후 확장 (로드맵)

- **scoring-designer 에이전트**: 게임 룰/partial credit 시스템 코드 구현 단계에서 추가
- **Hard Mode**: 연도 숨김 + 연도 추측 funnel 추가 시 분석가/큐레이터 스킬 확장
- **추가 모드**: Guess the Industry, What Happened?, Find the Anomaly, Multi-year Story
