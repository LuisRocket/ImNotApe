# ImNotApe

Financial Statement GeoGuessr — 재무제표 단서로 회사를 추리하는 niche 게임. 한국 투자 커뮤니티 타깃, S&P 500 기반 Daily Challenge.

**Live**: https://luischung4336.github.io/ImNotApe/ *(Pages 활성화 후)*

## 지금 어디까지 됐나

- ✅ 콘텐츠 파이프라인 (Claude Code 기반 harness): financial-analyst → game-curator → narrative-writer
- ✅ 첫 Daily Challenge 1개: Costco FY2024
- ✅ SvelteKit 정적 사이트 (투자 뉴스레터 톤)
- ✅ 산업·회사 funnel + 부분점수 + 정답 narrative 표시
- ⏳ 카탈로그 빌드 (B 하이브리드 — 데이터 일괄 + 코드 선택)
- ⏳ localStorage 통계
- ⏳ Hard Mode (연도 숨김)

## 개발 워크플로우

```bash
# 로컬 개발
npm install
npm run dev          # http://localhost:5173

# 빌드 검증
npm run build
npm run preview      # http://localhost:4173

# 타입 체크
npm run check
```

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드해서 GitHub Pages에 배포한다.

**최초 1회 셋업**:
1. Repo → Settings → Pages → **Source: GitHub Actions** 선택
2. `git push origin main` 하면 Actions 탭에 배포 워크플로우 표시
3. 완료되면 `https://luischung4336.github.io/ImNotApe/` 에서 접속

## 데이터 레이어 (S&P 500 재무제표 일괄 수집)

지속적으로 Daily Challenge를 출제하려면 카탈로그가 필요하고, 카탈로그를 쌓으려면 재무 데이터가 먼저 있어야 한다. `scripts/fetch-financials.mjs`가 큐레이션된 ~100개 회사 × 10년치 IS/BS/CF/KeyMetrics/Ratios를 FMP API에서 받아 `data/financials/{TICKER}.json`에 저장한다.

```bash
# 최초 1회: FMP 키 셋업
cp .env.example .env
# .env 열어서 FMP_API_KEY=your_actual_key 입력

# 큐레이션 ~108개만 (빠른 시작용)
npm run fetch:financials

# S&P 500 전체 ~503개 (FMP에서 동적으로 명단 받아서)
npm run fetch:financials -- --all

# 일부만 다시 받기
npm run fetch:financials -- --tickers=AAPL,MSFT,COST

# 30일 이내 캐시도 무시하고 강제 refetch
npm run fetch:financials -- --force --all

# 커스텀 회사 리스트 파일 사용
npm run fetch:financials -- --companies=data/my-list.json
```

`--all`은 FMP의 `/stable/sp500-constituent`에서 명단을 받아 `data/sp500.json`에 캐시 (30일). 503개 × 5 endpoint = ~2,500 API 콜, 유료 키면 5~10분.

수집된 `data/financials/`는 git에 커밋한다 (분기 1회 갱신 → diff로 변화 확인 + 다른 사람이 clone만으로 빌드 가능).

## 콘텐츠 추가 워크플로우

새 Daily Challenge 추가 = 새 JSON 파일 1개 추가 + push.

```bash
# Claude Code 세션에서:
# /daily-challenge-pipeline   ← 자동 출제 (analyst·curator·writer 파이프라인, 데이터 레이어 활용)
# 또는 수동으로 content/daily/{YYYY-MM-DD}.json 작성

git add content/daily/2026-05-08.json
git commit -m "Add daily challenge: 2026-05-08"
git push
# → Actions 자동 배포 → 페이지 갱신
```

페이지는 `content/daily/*.json` 중 *가장 최신 날짜*를 자동으로 보여줌 (filename 기준 정렬).

## 디렉토리 구조

```
.claude/
  agents/             ← harness 전문 에이전트 정의
  skills/             ← harness 스킬
scripts/
  fetch-financials.mjs ← FMP 일괄 수집 스크립트
data/
  companies.json      ← 큐레이션된 ~100개 ticker 리스트
  financials/         ← 회사별 10년치 재무제표 (커밋)
  metadata.json       ← 마지막 fetch 정보
src/
  routes/             ← SvelteKit 페이지
  lib/                ← 컴포넌트, 타입, 포매터
  app.css             ← 투자 뉴스레터 톤 디자인 토큰
content/
  daily/{date}.json   ← 매일의 게임 데이터 (정답 포함)
.github/workflows/
  deploy.yml          ← GitHub Pages 자동 배포
CLAUDE.md             ← harness 트리거 규칙 + 변경 이력
```

## 디자인 결정 (변경 이력)

- **2026-05-07**: MVP 초기 구성 — Daily Challenge 단일 모드, 산업→회사 2단계 funnel, 연도 표시 ON, S&P 500 한정
- **2026-05-07**: Architecture B (하이브리드) 채택 — 카탈로그 사전 빌드 + 런타임 코드 선택 (현재는 단일 challenge MVP, 카탈로그 미구현)
