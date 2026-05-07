---
name: game-quality-validator
description: ImNotApe Daily Challenge 후보의 게임 적합성을 평가하고, 승인 시 산업/회사 funnel 선택지(미끼 포함)를 설계한다. 난이도 산정, 정답 유니크성 검증, distractor 선정에 사용. game-curator 에이전트가 호출.
---

# Game Quality Validator

financial-analyst가 제출한 후보를 *Daily Challenge로 적합한가* 평가하고, 승인 시 게임 출제용 funnel(산업 옵션 + 회사 풀)을 설계하는 스킬.

## 핵심 원칙

**왜 이게 중요한가**: 분석가는 "재무적으로 흥미로운 회사"를 보지만, 게임 큐레이터는 "사용자가 추리하면서 즐거운가"를 본다. 좋은 재무 분석 후보가 항상 좋은 게임 후보는 아니다. 큐레이터의 거절은 *분석 품질이 아니라 게임 적합성*을 판단하는 것이다.

## 검증 4축

### 1. 난이도

**기준점**: medium = "투자 커뮤니티 평균이 50% 정답률".

| 난이도 | 신호 | 빈도 |
|--------|------|------|
| Too easy | 너무 명백 (Apple, Tesla 정답 빤함) | 거절 |
| Easy | 시그널 강함, 산업도 unique | OK (주 1회 정도) |
| Medium | 추리 가능하지만 헷갈리는 미끼 존재 | **기본** |
| Hard | 전문가도 갸우뚱, 다중 후보 가능 | OK (주 1회 정도) |
| Too hard | 알아챌 단서 부재 | 거절 |

월 단위로 분포 균형: easy 20% / medium 60% / hard 20%.

### 2. 정답 유니크성

같은 재무 지문을 가진 회사가 둘 이상이면 정답이 unique하지 않음 → **거절**.

대표적 거절 사유:
- 빅테크 SaaS (MSFT/ADBE/NOW/CRM 모두 비슷)
- 빅 IB (GS/MS/JPM IB 사업부)
- 메이저 항공사 (DAL/UAL/AAL 비슷한 패턴)
- 인덱스에 가까운 다업종 회사 (3M, GE 시기에 따라)

승인 가능한 케이스:
- 그 해의 *그 회사만의 사건*이 명확히 재무에 반영됨 (예: Boeing FY2020 — 737 MAX + COVID 이중 충격)
- 비즈니스 모델이 industry-of-one (Costco의 membership)

### 3. 단서 풍부성

분석가가 제시한 `key_signals`가 정말 추리 단서로 작동하는가:
- 단서 3개 이상 + 각 단서가 *서로 다른 영역*(IS/BS/CF/세그먼트)에서 와야 좋음
- 단서가 모두 매출 라인 → 단조로움. 거절 또는 보강 요청.

### 4. 흥미도

"왜 이 해의 이 회사가 흥미로운가" 한 줄 스토리가 있어야 함. narrative 작가가 풀 게 없는 후보는 거절.

## Funnel 설계 가이드

### 산업 옵션 (1단계)

**6~8개**. 정답 산업 + *근접 산업* 미끼 위주. 너무 다른 산업은 미끼로 가치 없음.

거리 매트릭스 예시 (Costco 정답 시):
- Distance 0: Retail / Wholesale Club (정답)
- Distance 1: General Merchandise Retail, Discount Retail (가까운 retail)
- Distance 2: Grocery / Supermarket, Specialty Retail
- Distance 3: E-commerce, Department Store
- Distance 4+ (제외): 항공사, 반도체 등 너무 다름

채점 시 distance를 partial credit으로 사용.

### 회사 풀 (2단계)

**5개 = 정답 1 + 미끼 4**. 미끼 선정 원칙:

1. **Top-of-mind misread**: 사용자가 단서 일부만 보고 가장 헷갈릴 회사 (Costco 정답 시 → Walmart)
2. **재무 지문 인접**: 비슷한 마진/규모/산업
3. **시대 인접**: 같은 해에 비슷한 사건을 겪은 회사
4. **Decoy variant**: 같은 회사의 다른 해 (Costco FY2023 정답 시 → Costco FY2020을 미끼로 넣지 *말기*. 연도가 표시되므로 기능 안 함.)

미끼 4개 모두 같은 산업이면 산업 funnel이 무의미. 적당히 *근접한 다른 산업*도 1~2개 섞기.

## 데이터 스키마

승인 출력:
```json
{
  "decision": "approved",
  "selected": {
    "ticker": "COST",
    "fiscal_year": "FY2023",
    "rationale": "왜 이 후보가 게임으로 좋은가 1~2문장"
  },
  "funnel": {
    "industry_options": ["...정답 + 미끼 6~7개..."],
    "company_pool": ["정답", "미끼1", "미끼2", "미끼3", "미끼4"]
  },
  "scoring_hints": {
    "industry_distance": { "산업명": 0~4 }
  }
}
```

거절 출력:
```json
{
  "decision": "rejected",
  "reason": "거절 사유 (4축 중 어느 것에 걸렸는지 명시)",
  "rejected_candidates": ["TICKER-FY"],
  "request_to_analyst": "다음 후보에서 어떤 점을 다르게 할지 구체적 요청"
}
```

## 거절 사유 작성 원칙

분석가가 다음 시도에서 *다른 결과*를 낼 수 있도록 구체적으로 작성:
- 나쁜 예: "유니크성 부족"
- 좋은 예: "MSFT/ADBE/NOW는 모두 70%+ 마진 SaaS로 구분 어려움. distinctive BM (membership, transaction fee, 사이클 강한 산업) 회사 부탁"
