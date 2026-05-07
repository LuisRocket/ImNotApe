# Harness Journal — ImNotApe

CLAUDE.md의 변경 이력 테이블이 *무엇을* 바꿨는지를 기록한다면, 이 문서는 *왜* 그렇게 결정했고 *무엇을 배웠는지*를 남긴다. 새 세션이 와도 같은 결정을 다시 헤매지 않도록, 그리고 나중에 우리가 잘못된 가정을 발견했을 때 어디서부터 되짚어야 할지 보이도록.

> 형식: 시간순 stage. 각 stage마다 *컨텍스트 → 결정 → 결과 → 교훈*.

---

## Stage 1 — 초기 하네스 구축 (2026-05-07)

### 컨텍스트
ImNotApe = 재무제표 단서로 회사를 추리하는 게임. MVP 스코프는 Daily Challenge 단일 모드, S&P 500 한정, 산업→회사 2단계 funnel. 초기엔 *데이터 레이어 없음* — 매일 LLM이 FMP MCP를 직접 호출해 후보를 발굴하는 시나리오 가정.

### 결정
- **3-에이전트 팀** (`financial-analyst` → `game-curator` → `narrative-writer`)
- 패턴: *생성-검증 루프*(분석가↔큐레이터) + *파이프라인*(큐레이터→작가) 하이브리드
- **에이전트 팀 모드** (서브 에이전트 아님) — 큐레이터가 거절 시 분석가에게 직접 SendMessage 가능
- 4개 스킬: `daily-challenge-pipeline` (orchestrator) + 도메인 3개

### 결과
완전한 1회용 파이프라인 1개. `/daily-challenge-pipeline` 트리거 시 4 phase 자동 실행.

### 교훈
이 시점엔 "데이터를 LLM이 그때그때 가져온다"고 가정했는데, 이게 나중에 비용·일관성 문제로 재검토 대상이 됨. **초기에 데이터 레이어 자리를 미리 그려놨더라면** 하네스를 처음부터 batch-friendly하게 설계할 수 있었을 것.

---

## Stage 2 — 첫 테스트 런 (Costco FY2024, 2026-05-07)

### 컨텍스트
하네스 구축 직후 검증을 위한 최초 실행.

### 실행
- **Phase 1 (분석가)**: FMP MCP로 후보 3개 추출 → BA/COST/NVDA FY2024. 18 tool 호출, 2분 16초.
- **Phase 2 (큐레이터)**: 4 호출, 38초. COST 선정 (BA/NVDA는 "easy 난이도, 첫 daily엔 즉답 위험"). 거절 루프는 안 발동.
- **Phase 3 (작가)**: 5 호출, 30초. "회원이 가격 협상력을 Costco에게 위임" — 정확하고 풍부한 narrative.
- **Phase 4 (오케스트레이터)**: FMP에서 재무 데이터 직접 가져와 통합. 1개 challenge 산출.

### 결과
`content/daily/2026-05-07.json` 1개 — 게임에 실제로 사용 가능한 품질.

### 교훈
1. ✅ **하네스 구조 자체는 작동**. 4 phase 모두 의도대로 진행.
2. ✅ **품질 우수**. narrative는 추측 없이 fact만, 톤 일관, 길이 적절.
3. ⚠️ **거절 루프 미테스트** — 분석가 첫 시도에서 강한 후보가 나와 큐레이터 거절이 발동 안 됨. 진짜 거절 흐름은 추후 테스트 필요.
4. ⚠️ **단일 challenge에 ~25 tool 호출 + 데이터 fetch**. 매일 운영 시 비용·시간 누적 ↑.

---

## Stage 3 — 데이터 레이어 추가 (2026-05-07~08)

### 컨텍스트
사용자 제기: "지속 출제하려면 S&P 500 재무 데이터를 미리 모아둘 필요 있음 + 코드로 회사·연도 선택하면 어때?"

이 질문이 결국 카탈로그 아키텍처로 이어짐.

### 결정 (단계적)
1. **수집 범위**: 단계적 — 큐레이션 100개 먼저, 그 다음 SP500 전체로 확장
2. **시간 범위**: 10년
3. **저장**: 회사별 JSON 파일, git 커밋
4. **명단**: 현재 SP500 + 지난 10년 편출 종목까지 (survivor bias 회피)

### 빌드한 도구
- `scripts/fetch-financials.mjs` — FMP REST 호출 (5 endpoint × 10년 = 회사당 5콜)
- `scripts/build-sp500-list.mjs` — 현재 503 + 편출 190 = 693 회사 명단

### 결과
- 683 / 693 회사의 10년치 IS/BS/CF/KeyMetrics/Ratios 확보 (약 70MB)
- 16 회사 실패 — 모두 인수합병으로 ticker 사라진 회사 (YHOO, EMC, CA, DPS, GGP, ANDV, ...). FMP가 delisted M&A 타깃 데이터는 보존 안 함.

### 만난 이슈
1. **FMP v3 API deprecation** (2025-08-31자). 새 키는 `/stable/` 엔드포인트만 가능. 모든 스크립트 수정.
2. **`.env` vs `.env.example` 혼동**. 사용자가 실제 키를 `.env.example`에 넣은 케이스 발견. 보안 경고 + 파일 분리 가이드 추가.
3. **`/stable/` 401 (placeholder)** — `.env`에 placeholder 텍스트가 남아있어서 키처럼 전송됨. 디버깅 시 `.env` 길이·바이트 검사로 발견.

### 교훈
1. **데이터 레이어가 들어오면 LLM 호출 빈도가 *근본적으로* 바뀐다**. Stage 1의 가정이 무너짐 — 분석가가 매번 FMP를 칠 필요가 없어짐.
2. **Survivor bias 위험을 처음부터 인지해야 한다**. 게임이 *과거의 재무제표*를 다루므로, 현재 SP500만 가져오면 그 시기 SP500이었지만 지금은 사라진 회사가 빠짐. `historical-sp500-constituent`로 보강.
3. **API 키는 placeholder 검증을 두는 게 좋다** (스크립트가 길이/형식 체크 후 실행하면 401 디버깅 시간 절약).

---

## Stage 4 — 아키텍처 재검토: Daily vs Catalog (2026-05-08)

### 컨텍스트
데이터 레이어 + 코드 선택이 가능해진 시점에서 사용자 제기: "출제를 매일 LLM으로 할 필요 있나? 데이터 모아두고 코드로 회사·연도 선택하면 어때?"

핵심 질문: **하네스 자체가 redundant한가?**

### 검토한 옵션
| 옵션 | 다양성 | 품질 | LLM 비용 | 작업량 |
|------|--------|------|---------|--------|
| A. 순수 코드 (outlier만 + LLM 없음) | ⭐⭐ | ⭐ | 0 | 적음 |
| B. 카탈로그 (코드 outlier + LLM 큐레이션·narrative) | ⭐⭐⭐ | ⭐⭐⭐ | 작음 | 중 |
| C. 매일 LLM (현재 daily) | ⭐⭐⭐ | ⭐⭐⭐ | 큼 | 0 |

### 1차 결정 (잘못된 결정)
B를 채택하면서 *"하네스의 90%는 불필요"* 라고 결론. 순수 코드 outlier extraction + LLM 1회 narrative만으로 충분하다고 판단.

### 사용자 push back
"확장이 필요하다면 하네스는 유지해야 하지 않을까?"

이 한 문장이 분석을 다시 엎음.

### 2차 (최종) 결정
**하네스 유지**. 이유:
- 향후 mode (Hard Mode·What Happened?·Multi-year Story·Find the Anomaly) 중 일부는 *판단 집약적*이라 코드로 못 풀림. Especially:
  - **What Happened?**: 변화 *원인* 추론 — world knowledge 필수
  - **Multi-year Story**: 3년치 추이의 서사화 — LLM 필수
- 같은 3 에이전트 + 다른 orchestrator skill 패턴이 mode 확장에 깔끔
- 카탈로그 빌더가 *daily용 lean 변형*이지 *대체*가 아님

### 교훈
**현재 mode만 보고 압축하면 곧 다시 빌드해야 한다**. 하네스는 *플랫폼*으로 봐야 함 — 한 mode에 맞게 쪼그리지 말고, 여러 mode가 공유하는 에이전트 패턴으로 유지.

또한 사용자의 "확장이 필요하다면" 질문이 *결정의 시야를 한 단계 위로 끌어올린* 좋은 예시. 비슷한 결정을 내릴 때는 "이 결정이 내년에도 옳을까?" 자문할 가치가 있음.

---

## Stage 5 — Catalog Builder Pipeline 추가 (2026-05-08)

### 컨텍스트
Stage 4 결정 후 즉시 실행. *daily 1개씩*과 *catalog N개씩* 을 같은 에이전트로 처리하기 위한 batch 모드 도입.

### 빌드한 것
1. `scripts/extract-outlier-candidates.mjs` — 18개 시그널 룰 (negative GP, YoY revenue extreme, special dividend, equity raise, goodwill explosion/impairment, biotech R&D, SaaS GM+capex, wholesale-club AP/inventory, capex cycle, SBC heavy, cash-rich, massive buyback, negative FCF, negative equity, inventory explosion, massive loss). 6,830 회사-연도 → 상위 300 추출.
2. `.claude/skills/catalog-builder-pipeline/SKILL.md` — 새 batch orchestrator
3. `.claude/agents/{analyst,curator,writer}.md` — 각 파일에 `## Batch 모드` 섹션 추가

### 핵심 디자인
- 같은 에이전트 정의를 두 모드 모두에서 사용 (모드별로 행동 분기)
- 코드 outlier extractor가 *분석가의 입력*을 미리 줄여줌 — 분석가는 시대 시그널 풍부화에 집중
- 큐레이터의 batch 모드는 *상호 비교* 가능 (다양성 강제)

### 교훈
**기존 .md 파일을 새로 만들지 않고 섹션 추가**한 게 좋았음. 두 모드 모두에서 같은 에이전트 정체성·기본 원칙·출력 프로토콜이 일관됨. 모드 분기는 행동 가이드 수준으로만.

---

## Stage 6 — 첫 카탈로그 빌드 (2026-05-08)

### 실행
`/catalog-builder-pipeline` (목표 30개)

| Phase | 입력 | 출력 | 시간 | tool 호출 |
|-------|------|------|------|----------|
| 0. 코드 outlier | 6,830 후보 | top 300 | 즉시 | 0 |
| 1. 분석가 batch | 100 | 50 enriched | 12.5분 | 13 |
| 2. 큐레이터 batch | 50 | 30 + funnel/미끼 | 8.8분 | 21 |
| 3. 작가 batch | 30 | 30 narrative | 9.1분 | 39 |
| 4. 코드 assembler | 30 + 데이터 + narrative | 30 challenge JSON | 즉시 | 0 |

총 ~30분, ~73 tool 호출.

### 비용 비교
- daily-challenge-pipeline 30번 = 30 × ~25 콜 = ~750 콜
- catalog-builder-pipeline (이번) = ~73 콜
- → **10배 효율적**

### 산출 품질 점검
- ✅ 30 narrative 모두 fact-based (M&A 이름·날짜·CEO 정확)
- ✅ 다양성 (산업 ≤6 each, 시대 분산, 난이도 9/15/6)
- ✅ Top picks 모두 실제 distinctive 모먼트 (CCL FY2020 크루즈 셧다운, BA FY2024 negative equity, INTC FY2024 emergency raise, COIN FY2022 crypto winter, SMCI FY2024 Hindenburg, NVDA FY2026 AI 정점)
- ⚠️ Costco-FY2024 (Stage 2의 첫 daily)는 *카탈로그에 포함 안 됨* — 이번 outlier 추출 룰이 special dividend는 잡지만 *전체 점수에서 다른 후보들에 밀림*. 의도된 분포지만 *카탈로그 다양성 룰*은 추후 다시 검토할 수 있음.

### 교훈
1. **batch 모드의 다양성 강제**가 진짜 가치를 발휘했음 — daily 1개씩 30번 돌렸으면 비슷한 산업/시대 중복이 났을 것.
2. **narrative 작가가 30개를 한 번에**도 톤 일관을 유지함 (skill에 명시한 "한 번에 출력하지 말고 파일로 즉시 저장" 규칙 덕).
3. **분석가 12.5분, 큐레이터 8.8분** — 시간 분배가 예상과 비슷. batch 100~200개도 비슷한 비율로 스케일 추정 가능.
4. **컨텍스트 윈도우 부담은 명시적으로 막아야 함**. 30개 narrative을 messages로 출력했으면 폭발했을 것 — skill에 "Write 도구로 즉시 저장" 가이드가 결정적.

---

## 현재 상태 (2026-05-08 EOD)

### 디렉토리 구조
```
.claude/
  agents/                    ← 3 에이전트 (각 .md에 daily + batch 모드 가이드)
    financial-analyst.md
    game-curator.md
    narrative-writer.md
  skills/
    daily-challenge-pipeline/ ← 1개씩 출제 (보조)
    catalog-builder-pipeline/ ← N개 batch 빌드 (주력)
    financial-statement-extractor/  ← 분석가 도메인 가이드
    game-quality-validator/         ← 큐레이터 도메인 가이드
    event-narrative-writer/         ← 작가 도메인 가이드
data/
  companies.json             ← 큐레이션 108
  sp500.json                 ← 693 (현재 503 + 편출 190)
  financials/                ← 683 회사 × 10년 × 5 statement
  outlier-candidates.json    ← top 300 (코드 시그널 기반)
  metadata.json              ← fetch 로그
content/
  daily/2026-05-07.json      ← 첫 테스트 (Costco)
  catalog/                    ← 30 challenge + _index.json
scripts/
  fetch-financials.mjs
  build-sp500-list.mjs
  extract-outlier-candidates.mjs
  assemble-catalog.mjs
src/                          ← SvelteKit 게임 frontend
```

### 살아있는 두 파이프라인
| 파이프라인 | 사용 케이스 | 빈도 |
|-----------|------------|------|
| `daily-challenge-pipeline` | 1개씩 즉석 출제 (이벤트성) | 필요할 때 |
| `catalog-builder-pipeline` | N개 일괄 (콘텐츠 비축) | 분기 1회 |

---

## Open Questions / 향후 진화 트리거

1. **카탈로그 확장**: 30 → 100~300. 어떤 시그널 룰이 부족한지 (예: 회계기준 변경, segment 변동 같은 *질적* 시그널은 코드로 안 잡힘) 검토 필요.
2. **Hard Mode 파이프라인**: 연도 추측까지 — 큐레이터 스킬에 *시대 시그널 평가 축* 추가 필요. 지금 큐레이터는 산업·회사만 평가.
3. **새 mode들**: Guess the Industry (lean), What Happened? (LLM 집약), Find the Anomaly (cross-year 비교), Multi-year Story (3년 stitch). 각각 새 orchestrator skill로 추가, 같은 3 에이전트 재사용.
4. **QA 에이전트 부재**: 현재 산출물 품질 검증이 없음. 카탈로그 100개 이상 빌드 시 자동 정합성 체크 필요할 수 있음 (예: 미끼 풀 회사가 실제 데이터 있는지, narrative 사실 검증 등).
5. **데이터 레이어 갱신 주기**: 분기 1회로 가정했는데 실제 운영하면서 결정 필요. 새 회계연도 발표 시점에 맞춰?
6. **delisted 회사 데이터 보강**: FMP는 16개 인수된 회사 데이터를 보존 안 함. 다른 출처 (SEC 직접) 또는 게임에서 그 시기 빼고 진행.

---

## 자기 점검 — 무엇을 다르게 했을까

- **Stage 1에서 데이터 레이어 자리를 미리 그렸어야** — Stage 3에서 데이터 레이어 들어오면서 하네스 가정이 무너졌고, Stage 4에서 redundancy 의심까지 갔음. 처음부터 "데이터는 외부에 있고, 하네스는 그 위의 *판단 레이어*"로 정체성 잡았으면 더 깔끔.
- **Stage 4의 1차 결정에서 너무 빨리 압축하려 했음**. 사용자 push back으로 회복했지만, 미래 시야 (다른 mode들)를 처음에 더 명시적으로 검토할 가치가 있었음.
- **초기 거절 루프 테스트 누락**. Stage 2에서 큐레이터 거절이 발동 안 한 채로 진행했는데, edge case 검증을 별도 시나리오로 돌려봤으면 좋았을 것.

---

## 갱신 규칙

이 문서는 *큰 결정·교훈*만 기록한다. 다음 경우에 추가:
- 새 에이전트·스킬 도입
- 새 mode orchestrator 추가
- 아키텍처 결정 (이번 Stage 4처럼)
- 운영 중 발견한 의외의 패턴/제약

작은 코드 수정·버그 수정은 git log로 충분. 이 문서는 *"왜 그렇게 됐는지"* 가 사라지지 않게 하는 곳.
