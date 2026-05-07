---
name: financial-statement-extractor
description: S&P 500 회사의 재무제표를 FMP MCP로 가져오고, 시대 시그널과 식별 가능한 재무 지문을 추출한다. ImNotApe Daily Challenge 후보 발굴, 재무제표 분석, 시대 추론 단서 탐지 작업에 사용. financial-analyst 에이전트가 호출.
---

# Financial Statement Extractor

S&P 500 회사의 재무제표에서 *Daily Challenge로 게임화 가치가 있는 단서*를 추출하는 스킬. 단순 데이터 dump가 아니라 *추리 단서로의 변환*이 목적.

## 핵심 원칙

**왜 이게 중요한가**: ImNotApe는 사용자가 재무제표 단서로 회사를 추리하는 게임이다. 따라서 후보 회사의 가치는 단순 매출 규모가 아니라 *얼마나 distinctive한 재무 지문을 가졌는가* 로 결정된다. 평범한 회사를 dump하면 게임이 지루해진다.

## FMP MCP 사용 패턴

### 1단계: 후보 풀 정의

```
mcp__claude_ai_FMP__getSP500Constituents
```

전체 503개. 매번 전수 분석은 비효율 — 카테고리별로 distinctive한 회사들을 미리 학습해두고 그 안에서 픽.

### 2단계: 재무제표 3종 + 비율

특정 ticker + period에 대해 병렬 호출:
- `getIncomeStatement` — IS
- `getBalanceSheetStatement` — BS
- `getCashFlowStatement` — CF
- `getKeyMetrics` — 핵심 비율 (margin, ROE, ROIC 등)
- `getRatios` — 더 세분화된 비율
- `getRevenueProductSegmentation` + `getRevenueGeographicSegmentation` — 세그먼트 (강력한 단서원)

### 3단계: 시대 시그널 확인

- `getStockNews` — 그 해 주요 사건 (제한적, 풍부한 데이터 아님)
- `getEarningsTranscript` — 더 풍부한 컨텍스트 (옵션)

## 시대 시그널 카탈로그

각 시대의 재무제표에서 자주 보이는 패턴:

| 시그널 | 의미 |
|--------|------|
| SBC가 매출 대비 큰 비중 (>5%) | 2010년대 후반~ 테크 회사 |
| ASC 606 도입 영향 (2018) | 2018 회계연도 변곡 |
| ASC 842 (lease) 도입 (2019) | 2019 BS에 거대 lease asset/liability |
| Goodwill 급증 | M&A 직후 (해당 분기) |
| Inventory 급증 + AR 정상 | 수요 misjudge / 공급망 회복 (2022-2023 리테일) |
| FCF 음수 + capex 거대 | 반도체/통신/클라우드 인프라 투자 사이클 |
| 매출 급증 (2020) + normalization (2021-2022) | COVID 수혜주 |
| R&D > 매출 50% | 임상 단계 바이오텍 |
| Membership/Deferred revenue | 구독·멤버십 모델 |
| 매출원가 = 매출의 ~85% + AP 거대 | 리테일/유통 |
| Interest income > Interest expense | 현금 부자 빅테크 |
| Goodwill impairment 발생 | M&A 실패 인정 |
| Stock buyback 거대 (FCF의 50%+) | 성숙기 현금창출 + 성장 둔화 |
| Inventory turnover 매우 높음 (>10) | Costco 같은 wholesale club |
| Gross margin > 70% + 낮은 capex | 소프트웨어/SaaS |
| 리스크 자산 / 보험 충당금 | 보험사 |
| Net interest margin / 대출 portfolio | 은행 |
| Backlog 거대 + FCF 변동성 큼 | 항공우주/방산 |
| Content amortization | 미디어/스트리밍 |

## 재무 지문 강한 회사 가이드

게임 가치가 높은 회사 카테고리 (예시, 이 외에도 많음):

- **유니크 BM**: Costco (membership), Visa/Mastercard (interchange), Berkshire (보험+투자)
- **시대 변곡점**: Tesla (흑자 전환 2020), Meta (Reality Labs 손실), Boeing (737 MAX/COVID)
- **사건 기반**: Enron-style이 S&P 500엔 거의 없지만 Wells Fargo (2016 fake account 영향), GE (2018 다이베스트)
- **사이클 강함**: 항공사 (LUV, DAL), 에너지 (XOM, CVX), 반도체 (AMD, NVDA, INTC)
- **AI boom**: NVDA FY2024 (매출 폭발), AVGO (VMware 인수)

## 추출 산출물 형식

JSON. financial-analyst의 출력 프로토콜 그대로:

```json
{
  "ticker": "COST",
  "company": "Costco Wholesale",
  "fiscal_year": "FY2023",
  "industry": "Retail / Wholesale Club",
  "key_signals": ["...", "...", "..."],
  "era_signal": "...",
  "uniqueness_argument": "...",
  "difficulty_estimate": "easy | medium | hard"
}
```

## 익명화 가이드 (게임 출제용)

후보 데이터에 회사명/세그먼트명이 *그대로 노출되면 게임 성립 안 됨*. 분석 시 익명화 처리 가능 여부를 표시:
- IS/BS/CF 자체는 회사명만 가리면 OK
- 세그먼트명이 회사 식별 가능 (예: "AWS", "iPhone") → 가려야 함. 가렸을 때도 단서가 충분한지 확인.

## 부적합 회사 판정

다음 회사는 후보에서 제외:
- 결산월이 일반과 다른 회사 (Apple FY는 9월 종료) — 연도 매핑 혼란
- 최근 IPO (3년치 미만 데이터) — 비교 단서 부족
- 합병/분할 직후 (재무제표 비교 어려움)
- 동종업계와 거의 차이 없는 평범한 회사
