# ImNotApe

Financial Statement GeoGuessr — 재무제표 단서로 회사를 추리하는 niche 게임. MVP는 Daily Challenge 단일 모드, S&P 500, 2단계 funnel(산업→회사), 연도 표시.

## 하네스: Daily Challenge 콘텐츠 파이프라인

**목표:** S&P 500 회사의 재무제표 기반 Daily Challenge 1문제(재무제표 + funnel 선택지 + 정답 narrative)를 매일 자동 생성한다.

**트리거:** Daily Challenge 출제·재출제·부분 수정(narrative만 다시, 미끼 다시 등) 요청 시 `daily-challenge-pipeline` 스킬을 사용하라. 단순 게임 디자인 질문이나 코드 작업은 직접 응답 가능.

**에이전트 팀**: financial-analyst, game-curator, narrative-writer (3명, 생성-검증 루프 + 파이프라인 하이브리드)

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-07 | 초기 구성 | 전체 | MVP 콘텐츠 파이프라인 자동화 |

## 향후 확장 (로드맵)

- **scoring-designer 에이전트**: 게임 룰/partial credit 시스템 코드 구현 단계에서 추가
- **Hard Mode**: 연도 숨김 + 연도 추측 funnel 추가 시 분석가/큐레이터 스킬 확장
- **추가 모드**: Guess the Industry, What Happened?, Find the Anomaly, Multi-year Story
