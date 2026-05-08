#!/usr/bin/env node
/**
 * expand-history — 단일년도 catalog 파일에 4년치 financials_history를 backfill 한다.
 *
 * 입력:
 *   content/catalog/{TICKER}-FY{YYYY}.json  (단일년도)
 *   data/financials/{TICKER}.json           (10년 캐시)
 *
 * 출력:
 *   같은 catalog 파일에 challenge.financials_history 추가 (in-place).
 *   - 오래된 → 최신 순
 *   - 기본 4년 (anchor 포함)
 *
 * 멱등: 이미 financials_history가 존재해도 갱신해서 덮어쓴다.
 *
 * 실행: node scripts/expand-history.mjs [--years=4]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const YEARS = parseInt(argv.find((a) => a.startsWith('--years='))?.split('=')[1] ?? '4', 10);
const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'content', 'catalog');
const FINANCIALS = path.join(ROOT, 'data', 'financials');

function pickFiscalYearData(arr, fy) {
  if (!Array.isArray(arr)) return null;
  return arr.find((x) => x.fiscalYear === fy || `FY${x.fiscalYear}` === fy) || null;
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
    netInterestIncome:
      is.netInterestIncome || (is.interestIncome || 0) - (is.interestExpense || 0),
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

function buildYearBlock(fin, fyNumber) {
  const is = pickFiscalYearData(fin.incomeStatement, fyNumber);
  const bs = pickFiscalYearData(fin.balanceSheet, fyNumber);
  const cf = pickFiscalYearData(fin.cashFlow, fyNumber);
  const km = pickFiscalYearData(fin.keyMetrics, fyNumber);
  const ratios = pickFiscalYearData(fin.ratios, fyNumber);

  if (!is || !bs || !cf) return null;

  return {
    fiscal_year: `FY${fyNumber}`,
    income_statement: buildIncome(is),
    balance_sheet: buildBalance(bs),
    cash_flow_statement: buildCashFlow(cf),
    derived_ratios: buildRatios(km, ratios)
  };
}

async function main() {
  const files = (await fs.readdir(CATALOG))
    .filter((f) => f.endsWith('.json') && f !== '_index.json')
    .sort();
  console.log(`Expanding ${files.length} catalog entries (years=${YEARS})...`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const m = slug.match(/^([A-Z0-9.-]+)-FY(\d+)$/);
    if (!m) {
      console.error(`  ✗ ${slug}: 슬러그 파싱 실패`);
      fail++;
      continue;
    }
    const ticker = m[1];
    const anchor = parseInt(m[2], 10);

    try {
      const finPath = path.join(FINANCIALS, `${ticker}.json`);
      const fin = JSON.parse(await fs.readFile(finPath, 'utf-8'));

      // anchor에서 (years-1) 만큼 거꾸로. 오래된 → 최신.
      const targetYears = [];
      for (let i = YEARS - 1; i >= 0; i--) targetYears.push(anchor - i);

      const blocks = [];
      const missing = [];
      for (const y of targetYears) {
        const block = buildYearBlock(fin, String(y));
        if (block) blocks.push(block);
        else missing.push(y);
      }

      if (blocks.length === 0) {
        throw new Error(`모든 ${YEARS}개 회계연도 결손 (${targetYears.join(', ')})`);
      }
      if (blocks.length < YEARS) {
        // 일부만 결손이면 진행하되 경고
        console.warn(`  ⚠ ${slug}: ${YEARS}년 중 ${blocks.length}년만 가용 (결손: ${missing.join(', ')})`);
      }

      // 카탈로그 파일 갱신
      const catalogPath = path.join(CATALOG, file);
      const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
      catalog.challenge.financials_history = blocks;
      await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));

      console.log(`  ✓ ${slug} (${blocks.map((b) => b.fiscal_year).join(', ')})`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${slug}: ${err.message}`);
      failures.push({ slug, error: err.message });
      fail++;
    }
  }

  console.log('');
  console.log(`Expanded ${ok}/${files.length} (failed ${fail})`);
  if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ${f.slug}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
