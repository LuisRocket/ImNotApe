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

## 콘텐츠 추가 워크플로우

새 Daily Challenge 추가 = 새 JSON 파일 1개 추가 + push.

```bash
# Claude Code 세션에서:
# /daily-challenge-pipeline   ← 자동 출제 (analyst·curator·writer 파이프라인)
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
