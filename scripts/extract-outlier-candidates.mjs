#!/usr/bin/env node
/**
 * Outlier candidate extractor — 683 회사 × 10년 = ~6,830 후보 중 *재무적으로 distinctive*한
 * 회사-연도 조합을 통계 시그널로 자동 추출. 카탈로그 빌더의 1차 pre-filter.
 *
 * 출력: data/outlier-candidates.json
 *   각 후보: { ticker, fiscalYear, signals: [{type, value, weight, note}], score, snapshot: {...} }
 *
 * 입력: data/financials/{TICKER}.json (이미 fetch된 데이터)
 *       data/sp500.json (sector 메타)
 *
 * 실행: npm run extract:outliers
 *       npm run extract:outliers -- --top=300  (default 300)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const TOP_FLAG = argv.find((a) => a.startsWith('--top='));
const TOP_N = TOP_FLAG ? parseInt(TOP_FLAG.split('=')[1], 10) : 300;

const ROOT = process.cwd();
const FINANCIALS_DIR = path.join(ROOT, 'data', 'financials');
const SP500_PATH = path.join(ROOT, 'data', 'sp500.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'outlier-candidates.json');

// 시그널 검출 룰 — 각 룰은 회사-연도 조합 1개에 대해 평가
const SIGNAL_RULES = [
  {
    name: 'negative_gross_profit',
    weight: 8,
    detect: ({ is }) => {
      if (!is.revenue || !is.grossProfit) return null;
      const gm = is.grossProfit / is.revenue;
      if (gm < 0) return { value: gm, note: `매출원가 > 매출 (GM ${(gm * 100).toFixed(1)}%) — 거의 없음` };
      return null;
    }
  },
  {
    name: 'extreme_revenue_growth',
    weight: 7,
    detect: ({ is, is_prev }) => {
      if (!is_prev?.revenue || !is.revenue) return null;
      const yoy = (is.revenue - is_prev.revenue) / is_prev.revenue;
      if (yoy > 0.6 && is.revenue > 5_000_000_000) {
        return { value: yoy, note: `매출 +${(yoy * 100).toFixed(0)}% YoY (전년 ${(is_prev.revenue / 1e9).toFixed(0)}B → ${(is.revenue / 1e9).toFixed(0)}B)` };
      }
      return null;
    }
  },
  {
    name: 'revenue_collapse',
    weight: 6,
    detect: ({ is, is_prev }) => {
      if (!is_prev?.revenue || !is.revenue) return null;
      const yoy = (is.revenue - is_prev.revenue) / is_prev.revenue;
      if (yoy < -0.2) {
        return { value: yoy, note: `매출 ${(yoy * 100).toFixed(0)}% YoY (전년 ${(is_prev.revenue / 1e9).toFixed(0)}B → ${(is.revenue / 1e9).toFixed(0)}B)` };
      }
      return null;
    }
  },
  {
    name: 'massive_dividend_spike',
    weight: 6,
    detect: ({ cf, cf_prev }) => {
      if (!cf?.commonDividendsPaid || !cf_prev?.commonDividendsPaid) return null;
      const cur = Math.abs(cf.commonDividendsPaid);
      const prev = Math.abs(cf_prev.commonDividendsPaid);
      if (prev === 0) return null;
      if (cur > prev * 2.5 && cur > 1_000_000_000) {
        return { value: cur / prev, note: `배당 ${(cur / 1e9).toFixed(1)}B (전년 ${(prev / 1e9).toFixed(1)}B의 ${(cur / prev).toFixed(1)}배) — special dividend 가능성` };
      }
      return null;
    }
  },
  {
    name: 'massive_equity_raise',
    weight: 6,
    detect: ({ cf, is }) => {
      if (!cf || !is?.revenue) return null;
      // commonStockIssuance가 있는 경우 (감소가 아닌 발행)
      const issued = cf.commonStockIssuance || 0;
      if (issued > 5_000_000_000 && issued > is.revenue * 0.1) {
        return { value: issued, note: `보통주 발행 ${(issued / 1e9).toFixed(1)}B (매출의 ${((issued / is.revenue) * 100).toFixed(0)}%) — 긴급 자본 조달 시그널` };
      }
      return null;
    }
  },
  {
    name: 'goodwill_explosion',
    weight: 5,
    detect: ({ bs, bs_prev }) => {
      if (!bs?.goodwill || !bs_prev?.goodwill) return null;
      const cur = bs.goodwill;
      const prev = bs_prev.goodwill;
      if (cur > prev * 1.5 && cur - prev > 5_000_000_000) {
        return { value: cur - prev, note: `Goodwill +${((cur - prev) / 1e9).toFixed(1)}B (${(prev / 1e9).toFixed(1)}B → ${(cur / 1e9).toFixed(1)}B) — 대형 M&A` };
      }
      return null;
    }
  },
  {
    name: 'goodwill_impairment',
    weight: 6,
    detect: ({ bs, bs_prev }) => {
      if (!bs?.goodwill || !bs_prev?.goodwill) return null;
      const drop = bs_prev.goodwill - bs.goodwill;
      if (drop > 2_000_000_000) {
        return { value: drop, note: `Goodwill –${(drop / 1e9).toFixed(1)}B (${(bs_prev.goodwill / 1e9).toFixed(1)}B → ${(bs.goodwill / 1e9).toFixed(1)}B) — impairment` };
      }
      return null;
    }
  },
  {
    name: 'biotech_signature',
    weight: 4,
    detect: ({ is }) => {
      if (!is?.revenue || !is?.researchAndDevelopmentExpenses) return null;
      const ratio = is.researchAndDevelopmentExpenses / is.revenue;
      if (ratio > 0.5) {
        return { value: ratio, note: `R&D ${(ratio * 100).toFixed(0)}% of revenue — 임상 단계 바이오텍 시그널` };
      }
      return null;
    }
  },
  {
    name: 'saas_signature',
    weight: 3,
    detect: ({ is, cf }) => {
      if (!is?.revenue || !is?.grossProfit || !cf?.capitalExpenditure) return null;
      const gm = is.grossProfit / is.revenue;
      const capexRatio = Math.abs(cf.capitalExpenditure) / is.revenue;
      if (gm > 0.7 && capexRatio < 0.05 && is.revenue > 1_000_000_000) {
        return { value: gm, note: `GM ${(gm * 100).toFixed(0)}% + CAPEX ${(capexRatio * 100).toFixed(1)}% — SaaS 시그널` };
      }
      return null;
    }
  },
  {
    name: 'wholesale_club_signature',
    weight: 5,
    detect: ({ is, bs }) => {
      if (!is?.revenue || !is?.grossProfit || !bs?.inventory || !bs?.accountPayables) return null;
      const gm = is.grossProfit / is.revenue;
      const apToInv = bs.accountPayables / bs.inventory;
      if (gm < 0.16 && apToInv > 1.0 && is.revenue > 30_000_000_000) {
        return { value: apToInv, note: `GM ${(gm * 100).toFixed(1)}% + AP ${(bs.accountPayables / 1e9).toFixed(1)}B > Inventory ${(bs.inventory / 1e9).toFixed(1)}B — wholesale club 시그널` };
      }
      return null;
    }
  },
  {
    name: 'massive_capex_cycle',
    weight: 4,
    detect: ({ is, cf }) => {
      if (!is?.revenue || !cf?.capitalExpenditure) return null;
      const ratio = Math.abs(cf.capitalExpenditure) / is.revenue;
      if (ratio > 0.2 && is.revenue > 10_000_000_000) {
        return { value: ratio, note: `CAPEX ${(ratio * 100).toFixed(0)}% of revenue — capital cycle 강한 산업 (반도체/통신/에너지)` };
      }
      return null;
    }
  },
  {
    name: 'sbc_heavy',
    weight: 3,
    detect: ({ is, cf }) => {
      if (!is?.revenue || !cf?.stockBasedCompensation) return null;
      const ratio = cf.stockBasedCompensation / is.revenue;
      if (ratio > 0.08) {
        return { value: ratio, note: `SBC ${(ratio * 100).toFixed(1)}% of revenue — 테크 플랫폼 시그널` };
      }
      return null;
    }
  },
  {
    name: 'cash_rich_low_debt',
    weight: 3,
    detect: ({ is, bs }) => {
      if (!bs?.cashAndCashEquivalents || !bs?.totalDebt || !is?.revenue) return null;
      if (bs.cashAndCashEquivalents > bs.totalDebt * 2 && bs.cashAndCashEquivalents > 20_000_000_000) {
        return { value: bs.cashAndCashEquivalents - bs.totalDebt, note: `현금 ${(bs.cashAndCashEquivalents / 1e9).toFixed(0)}B vs 부채 ${(bs.totalDebt / 1e9).toFixed(0)}B — 현금부자 빅테크 시그널` };
      }
      return null;
    }
  },
  {
    name: 'massive_buyback',
    weight: 3,
    detect: ({ cf, is }) => {
      if (!cf?.commonStockRepurchased || !is?.revenue) return null;
      const buyback = Math.abs(cf.commonStockRepurchased);
      const fcf = cf.freeCashFlow || 0;
      if (buyback > 30_000_000_000 || (fcf > 0 && buyback > fcf * 0.7 && buyback > 10_000_000_000)) {
        return { value: buyback, note: `자사주 매입 ${(buyback / 1e9).toFixed(1)}B — 성숙기 현금환원 시그널` };
      }
      return null;
    }
  },
  {
    name: 'negative_fcf_growth_phase',
    weight: 4,
    detect: ({ cf, is }) => {
      if (!cf?.freeCashFlow || !is?.revenue) return null;
      if (cf.freeCashFlow < -2_000_000_000 && is.revenue > 5_000_000_000) {
        return { value: cf.freeCashFlow, note: `FCF ${(cf.freeCashFlow / 1e9).toFixed(1)}B (음수) — 대규모 투자/위기 시그널` };
      }
      return null;
    }
  },
  {
    name: 'negative_equity',
    weight: 5,
    detect: ({ bs }) => {
      if (!bs?.totalStockholdersEquity) return null;
      if (bs.totalStockholdersEquity < 0) {
        return { value: bs.totalStockholdersEquity, note: `자본 ${(bs.totalStockholdersEquity / 1e9).toFixed(1)}B (음수) — 매우 드문 case (Boeing 2024 등)` };
      }
      return null;
    }
  },
  {
    name: 'inventory_explosion',
    weight: 3,
    detect: ({ bs, bs_prev, is }) => {
      if (!bs?.inventory || !bs_prev?.inventory || !is?.revenue) return null;
      const growth = (bs.inventory - bs_prev.inventory) / bs_prev.inventory;
      if (growth > 0.3 && bs.inventory > is.revenue * 0.1) {
        return { value: growth, note: `재고 +${(growth * 100).toFixed(0)}% YoY — 수요 misjudge 또는 공급망 회복` };
      }
      return null;
    }
  },
  {
    name: 'massive_loss',
    weight: 4,
    detect: ({ is }) => {
      if (!is?.netIncome || !is?.revenue) return null;
      const margin = is.netIncome / is.revenue;
      if (margin < -0.5 && Math.abs(is.netIncome) > 5_000_000_000) {
        return { value: margin, note: `순이익 ${(is.netIncome / 1e9).toFixed(1)}B (NM ${(margin * 100).toFixed(0)}%) — 대규모 손실` };
      }
      return null;
    }
  }
];

function loadSectorMap() {
  try {
    const sp500 = JSON.parse(require('fs').readFileSync(SP500_PATH, 'utf-8'));
    const map = {};
    for (const c of sp500.companies) {
      map[c.ticker] = { sector: c.sector, name: c.name, status: c.status };
    }
    return map;
  } catch {
    return {};
  }
}

async function loadSectorMapAsync() {
  try {
    const sp500 = JSON.parse(await fs.readFile(SP500_PATH, 'utf-8'));
    const map = {};
    for (const c of sp500.companies) {
      map[c.ticker] = { sector: c.sector, name: c.name, status: c.status };
    }
    return map;
  } catch {
    return {};
  }
}

function indexByYear(arr) {
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const item of arr) {
    const fy = item.fiscalYear || (item.date ? item.date.slice(0, 4) : null);
    if (fy) map[fy] = item;
  }
  return map;
}

function snapshot(is, bs, cf) {
  return {
    revenue: is?.revenue ?? null,
    grossMargin: is?.revenue && is?.grossProfit ? is.grossProfit / is.revenue : null,
    operatingMargin: is?.revenue && is?.operatingIncome ? is.operatingIncome / is.revenue : null,
    netMargin: is?.revenue && is?.netIncome ? is.netIncome / is.revenue : null,
    fcf: cf?.freeCashFlow ?? null,
    fcfMargin: is?.revenue && cf?.freeCashFlow ? cf.freeCashFlow / is.revenue : null,
    totalDebt: bs?.totalDebt ?? null,
    totalEquity: bs?.totalStockholdersEquity ?? null,
    fiscalDate: is?.date ?? bs?.date ?? cf?.date ?? null
  };
}

async function main() {
  const sectorMap = await loadSectorMapAsync();
  const files = (await fs.readdir(FINANCIALS_DIR)).filter((f) => f.endsWith('.json'));
  console.log(`Scanning ${files.length} companies...`);

  const allCandidates = [];

  for (const file of files) {
    const ticker = file.replace('.json', '');
    let data;
    try {
      data = JSON.parse(await fs.readFile(path.join(FINANCIALS_DIR, file), 'utf-8'));
    } catch {
      continue;
    }

    const isMap = indexByYear(data.incomeStatement);
    const bsMap = indexByYear(data.balanceSheet);
    const cfMap = indexByYear(data.cashFlow);

    const years = Object.keys(isMap).sort(); // 오름차순

    for (let i = 0; i < years.length; i++) {
      const fy = years[i];
      const fy_prev = i > 0 ? years[i - 1] : null;
      const is = isMap[fy];
      const bs = bsMap[fy];
      const cf = cfMap[fy];
      const is_prev = fy_prev ? isMap[fy_prev] : null;
      const bs_prev = fy_prev ? bsMap[fy_prev] : null;
      const cf_prev = fy_prev ? cfMap[fy_prev] : null;

      if (!is || !bs || !cf) continue;

      const ctx = { is, bs, cf, is_prev, bs_prev, cf_prev };
      const signals = [];
      let score = 0;

      for (const rule of SIGNAL_RULES) {
        const result = rule.detect(ctx);
        if (result) {
          signals.push({ type: rule.name, weight: rule.weight, ...result });
          score += rule.weight;
        }
      }

      if (signals.length === 0) continue;

      const meta = sectorMap[ticker] || {};
      allCandidates.push({
        ticker,
        name: meta.name || '',
        sector: meta.sector || 'Unknown',
        status: meta.status || 'unknown',
        fiscalYear: `FY${fy}`,
        score,
        signalCount: signals.length,
        signals,
        snapshot: snapshot(is, bs, cf)
      });
    }
  }

  // 스코어 내림차순 정렬
  allCandidates.sort((a, b) => b.score - a.score || b.signalCount - a.signalCount);
  const top = allCandidates.slice(0, TOP_N);

  // 산업·시대 분포 통계
  const sectorDist = {};
  const yearDist = {};
  for (const c of top) {
    sectorDist[c.sector] = (sectorDist[c.sector] || 0) + 1;
    yearDist[c.fiscalYear] = (yearDist[c.fiscalYear] || 0) + 1;
  }

  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        description: `통계 시그널로 추출한 카탈로그 후보. 카탈로그 빌더가 LLM 큐레이션 입력으로 사용.`,
        builtAt: new Date().toISOString(),
        totalCandidates: allCandidates.length,
        topN: top.length,
        signalRules: SIGNAL_RULES.map((r) => ({ name: r.name, weight: r.weight })),
        sectorDistribution: sectorDist,
        yearDistribution: yearDist,
        candidates: top
      },
      null,
      2
    )
  );

  console.log('');
  console.log(`✓ Wrote ${OUTPUT_PATH}`);
  console.log(`  Total candidates with signals: ${allCandidates.length}`);
  console.log(`  Top ${TOP_N} saved`);
  console.log('');
  console.log(`Top 10 by score:`);
  for (const c of top.slice(0, 10)) {
    const top_signal = c.signals.sort((a, b) => b.weight - a.weight)[0];
    console.log(`  ${c.ticker.padEnd(6)} ${c.fiscalYear}  score=${c.score}  signals=${c.signalCount}  • ${top_signal.note.slice(0, 70)}`);
  }
  console.log('');
  console.log(`Sector distribution (top ${TOP_N}):`);
  for (const [s, n] of Object.entries(sectorDist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(28)} ${n}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
