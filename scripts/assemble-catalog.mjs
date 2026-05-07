#!/usr/bin/env node
/**
 * Catalog assembler — Phase 4 of catalog-builder-pipeline.
 *
 * 입력:
 *   _workspace/catalog/{batch-id}/02_curated.json    (30개 challenge meta)
 *   _workspace/catalog/{batch-id}/narratives/*.md     (30개 narrative)
 *   data/financials/{TICKER}.json                     (재무제표 raw)
 *
 * 출력:
 *   content/catalog/{TICKER}-{FY}.json                (30개 게임 콘텐츠)
 *
 * 실행: npm run assemble:catalog -- --batch=2026-05-08
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const BATCH_FLAG = argv.find((a) => a.startsWith('--batch='));
const BATCH_ID = BATCH_FLAG ? BATCH_FLAG.split('=')[1] : null;
if (!BATCH_ID) {
  console.error('ERROR: --batch=YYYY-MM-DD 필수');
  process.exit(1);
}

const ROOT = process.cwd();
const WORKSPACE = path.join(ROOT, '_workspace', 'catalog', BATCH_ID);
const FINANCIALS = path.join(ROOT, 'data', 'financials');
const OUTPUT_DIR = path.join(ROOT, 'content', 'catalog');

function pickFiscalYearData(arr, fy) {
  if (!Array.isArray(arr)) return null;
  return arr.find((x) => x.fiscalYear === fy || `FY${x.fiscalYear}` === fy) || null;
}

function fyEndHint(date) {
  if (!date) return '';
  const month = parseInt(date.slice(5, 7), 10);
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  return `회계연도 종료: ${monthNames[month - 1]} 말`;
}

function div(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null;
  return a / b;
}

function buildIncome(is) {
  return {
    revenue: is.revenue,
    costOfRevenue: is.costOfRevenue,
    grossProfit: is.grossProfit,
    grossMargin: div(is.grossProfit, is.revenue),
    researchAndDevelopmentExpenses: is.researchAndDevelopmentExpenses || 0,
    sellingGeneralAndAdministrativeExpenses: is.sellingGeneralAndAdministrativeExpenses || 0,
    operatingIncome: is.operatingIncome,
    operatingMargin: div(is.operatingIncome, is.revenue),
    interestIncome: is.interestIncome || 0,
    interestExpense: is.interestExpense || 0,
    netInterestIncome: is.netInterestIncome || ((is.interestIncome || 0) - (is.interestExpense || 0)),
    depreciationAndAmortization: is.depreciationAndAmortization || 0,
    ebitda: is.ebitda,
    incomeBeforeTax: is.incomeBeforeTax,
    incomeTaxExpense: is.incomeTaxExpense,
    netIncome: is.netIncome,
    netMargin: div(is.netIncome, is.revenue),
    epsDiluted: is.epsDiluted,
    weightedAverageSharesDiluted: is.weightedAverageShsOutDil
  };
}

function buildBalance(bs) {
  return {
    cashAndCashEquivalents: bs.cashAndCashEquivalents,
    shortTermInvestments: bs.shortTermInvestments,
    accountsReceivables: bs.accountsReceivables ?? bs.netReceivables,
    inventory: bs.inventory,
    totalCurrentAssets: bs.totalCurrentAssets,
    propertyPlantEquipmentNet: bs.propertyPlantEquipmentNet,
    goodwill: bs.goodwill,
    totalAssets: bs.totalAssets,
    accountPayables: bs.accountPayables,
    accruedExpenses: bs.accruedExpenses,
    shortTermDebt: bs.shortTermDebt,
    otherCurrentLiabilities: bs.otherCurrentLiabilities,
    totalCurrentLiabilities: bs.totalCurrentLiabilities,
    longTermDebt: bs.longTermDebt,
    capitalLeaseObligationsNonCurrent: bs.capitalLeaseObligationsNonCurrent,
    totalNonCurrentLiabilities: bs.totalNonCurrentLiabilities,
    totalLiabilities: bs.totalLiabilities,
    retainedEarnings: bs.retainedEarnings,
    totalStockholdersEquity: bs.totalStockholdersEquity,
    totalDebt: bs.totalDebt,
    netDebt: bs.netDebt
  };
}

function buildCashFlow(cf) {
  return {
    netIncome: cf.netIncome,
    depreciationAndAmortization: cf.depreciationAndAmortization,
    stockBasedCompensation: cf.stockBasedCompensation,
    changeInInventory: cf.inventory,
    changeInAccountsPayable: cf.accountsPayables,
    changeInWorkingCapital: cf.changeInWorkingCapital,
    operatingCashFlow: cf.operatingCashFlow,
    capitalExpenditure: cf.capitalExpenditure,
    freeCashFlow: cf.freeCashFlow,
    acquisitionsNet: cf.acquisitionsNet,
    commonStockRepurchased: cf.commonStockRepurchased,
    commonDividendsPaid: cf.commonDividendsPaid,
    netCashProvidedByFinancingActivities: cf.netCashProvidedByFinancingActivities,
    interestPaid: cf.interestPaid,
    incomeTaxesPaid: cf.incomeTaxesPaid
  };
}

function buildRatios(km, ratios) {
  // FMP의 keyMetrics + ratios에서 게임에 의미있는 것만
  const out = {};
  if (km) {
    out.returnOnEquity = km.returnOnEquity ?? null;
    out.dividendPayoutRatio = km.dividendPayoutRatio ?? null;
  }
  if (ratios) {
    out.inventoryTurnover = ratios.inventoryTurnover ?? null;
    out.daysInventoryOutstanding = ratios.daysOfInventoryOnHand ?? null;
    out.cashConversionCycleDays = ratios.cashConversionCycle ?? null;
    out.currentRatio = ratios.currentRatio ?? null;
    out.fcfMargin = ratios.freeCashFlowToRevenueRatio ?? null;
  }
  return out;
}

async function main() {
  const curated = JSON.parse(
    await fs.readFile(path.join(WORKSPACE, '02_curated.json'), 'utf-8')
  );
  const challenges = curated.challenges;
  console.log(`Assembling ${challenges.length} catalog entries...`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let assembled = 0;
  let failed = 0;
  const failures = [];

  for (const c of challenges) {
    const ticker = c.ticker;
    const fy = c.fiscalYear; // "FY2024" 형태
    const fyNumber = fy.replace(/^FY/, '');

    try {
      // 재무 데이터 로드
      const finPath = path.join(FINANCIALS, `${ticker}.json`);
      const fin = JSON.parse(await fs.readFile(finPath, 'utf-8'));

      const is = pickFiscalYearData(fin.incomeStatement, fyNumber);
      const bs = pickFiscalYearData(fin.balanceSheet, fyNumber);
      const cf = pickFiscalYearData(fin.cashFlow, fyNumber);
      const km = pickFiscalYearData(fin.keyMetrics, fyNumber);
      const ratios = pickFiscalYearData(fin.ratios, fyNumber);

      if (!is || !bs || !cf) {
        throw new Error(`fiscal year ${fyNumber} 결손 (is=${!!is}, bs=${!!bs}, cf=${!!cf})`);
      }

      // narrative 로드
      const narrativePath = path.join(WORKSPACE, 'narratives', `${ticker}-${fy}.md`);
      const narrative = await fs.readFile(narrativePath, 'utf-8');

      // 통합 객체
      const output = {
        slug: `${ticker}-${fy}`,
        challenge: {
          fiscal_year: fy,
          fiscal_year_end_hint: fyEndHint(is.date),
          reported_currency: is.reportedCurrency || 'USD',
          industry_options: c.funnel.industry_options,
          company_pool: c.funnel.company_pool,
          financials: {
            income_statement: buildIncome(is),
            balance_sheet: buildBalance(bs),
            cash_flow_statement: buildCashFlow(cf)
          },
          derived_ratios: buildRatios(km, ratios)
        },
        answer: {
          company: c.name,
          ticker: c.ticker,
          industry: c.funnel.industry_options[0] // 정답 산업 = 첫 옵션 컨벤션
        },
        scoring: {
          industry_distance: c.scoring_hints.industry_distance,
          company_pool_distractor_rationale: c.distractor_rationale || {}
        },
        narrative,
        metadata: {
          difficulty: c.difficulty_estimate || c.difficulty,
          era_signal: c.era_signal,
          uniqueness_argument: c.uniqueness_argument,
          game_value: c.game_value,
          source: c.source || 'catalog-builder-pipeline',
          builtAt: new Date().toISOString().slice(0, 10),
          batchId: BATCH_ID
        }
      };

      const outPath = path.join(OUTPUT_DIR, `${ticker}-${fy}.json`);
      await fs.writeFile(outPath, JSON.stringify(output, null, 2));
      console.log(`  ✓ ${ticker}-${fy}`);
      assembled++;
    } catch (err) {
      console.error(`  ✗ ${ticker}-${fy}: ${err.message}`);
      failures.push({ slug: `${ticker}-${fy}`, error: err.message });
      failed++;
    }
  }

  console.log('');
  console.log(`Assembled ${assembled}/${challenges.length} (failed ${failed})`);

  // 카탈로그 인덱스 갱신
  const indexPath = path.join(OUTPUT_DIR, '_index.json');
  const allFiles = (await fs.readdir(OUTPUT_DIR)).filter(
    (f) => f.endsWith('.json') && f !== '_index.json'
  );
  const index = {
    builtAt: new Date().toISOString(),
    count: allFiles.length,
    slugs: allFiles.map((f) => f.replace(/\.json$/, '')).sort()
  };
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  console.log(`  Index: content/catalog/_index.json (${index.count} entries)`);

  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log(`  ${f.slug}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
