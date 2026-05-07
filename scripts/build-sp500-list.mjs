#!/usr/bin/env node
/**
 * Build comprehensive S&P 500 list spanning the last N years.
 *
 * 목적: 현재 SP500 + 지난 N년간 편출된 종목까지 합쳐서 한 파일로 정리.
 *       game은 *과거의 재무제표*도 다루므로, 현재 지수에 없는 회사도
 *       그 시기에 SP500이었으면 후보 풀에 포함되어야 함.
 *
 * 출력: data/sp500.json
 *   {
 *     description, builtAt, windowYears,
 *     currentCount, historicalCount, totalCount,
 *     companies: [
 *       {
 *         ticker, name, sector, subsector,
 *         status: "current" | "historical",
 *         dateFirstAdded?, dateRemoved?, removedReason?, ...
 *       }
 *     ]
 *   }
 *
 * 환경변수: FMP_API_KEY
 *
 * 실행: npm run build:sp500-list
 *       npm run build:sp500-list -- --window=10   (default 10년)
 *       npm run build:sp500-list -- --window=15
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.FMP_API_KEY;
if (!API_KEY) {
  console.error('ERROR: FMP_API_KEY 환경변수가 없습니다 (.env 확인).');
  process.exit(1);
}

const argv = process.argv.slice(2);
const WINDOW_FLAG = argv.find((a) => a.startsWith('--window='));
const WINDOW_YEARS = WINDOW_FLAG ? parseInt(WINDOW_FLAG.split('=')[1], 10) : 10;

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'data', 'sp500.json');
const BASE = 'https://financialmodelingprep.com/stable';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(
      `HTTP ${res.status}: ${url.replace(API_KEY, '***')}\n  Response: ${body.slice(0, 300)}`
    );
  }
  return await res.json();
}

async function main() {
  console.log(`Building SP500 list for last ${WINDOW_YEARS} years...`);

  // 1) 현재 구성 종목
  console.log('  Fetching current constituents...');
  const current = await fetchJson(`${BASE}/sp500-constituent?apikey=${API_KEY}`);
  if (!Array.isArray(current) || current.length === 0) {
    throw new Error('Current constituents: empty response');
  }
  console.log(`    → ${current.length} current companies`);

  // 2) 과거 변동사항 (편출/편입 이력)
  console.log('  Fetching historical changes...');
  const historicalChanges = await fetchJson(
    `${BASE}/historical-sp500-constituent?apikey=${API_KEY}`
  );
  if (!Array.isArray(historicalChanges)) {
    throw new Error('Historical changes: unexpected response');
  }
  console.log(`    → ${historicalChanges.length} change records (1957~now)`);

  // 3) 윈도우 필터: 지난 N년 이내의 변동만
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - WINDOW_YEARS);
  const recentChanges = historicalChanges.filter((c) => {
    const d = new Date(c.date);
    return !isNaN(d.getTime()) && d >= cutoff;
  });
  console.log(
    `    → ${recentChanges.length} changes within last ${WINDOW_YEARS} years (since ${cutoff.toISOString().slice(0, 10)})`
  );

  // 4) 회사 풀 빌드
  const tickerMap = new Map();

  // 4-1) 현재 종목들 등록
  for (const c of current) {
    tickerMap.set(c.symbol, {
      ticker: c.symbol,
      name: c.name,
      sector: c.sector || 'Unknown',
      subsector: c.subSector || '',
      status: 'current',
      headQuarter: c.headQuarter || '',
      dateFirstAdded: c.dateFirstAdded || '',
      cik: c.cik || '',
      founded: c.founded || ''
    });
  }

  // 4-2) 지난 N년간 편출된 종목들 추가 (현재 풀에 없는 경우만)
  let addedHistorical = 0;
  for (const change of recentChanges) {
    const removed = change.removedTicker;
    if (!removed) continue; // 어떤 변경은 추가만 있을 수도
    if (tickerMap.has(removed)) continue; // 이미 현재 풀에 있음 (재진입)

    tickerMap.set(removed, {
      ticker: removed,
      name: change.removedSecurity || '',
      sector: 'Unknown', // 편출 데이터엔 sector 없음
      subsector: '',
      status: 'historical',
      dateRemoved: change.date || '',
      removedReason: change.reason || '',
      replacedBy: change.symbol || ''
    });
    addedHistorical++;
  }
  console.log(`    → ${addedHistorical} historical companies (편출, 현재 풀에 없는)`);

  // 5) 정렬 + 출력
  const companies = Array.from(tickerMap.values()).sort((a, b) =>
    a.ticker.localeCompare(b.ticker)
  );

  const output = {
    description: `S&P 500 회사 풀 — 현재 구성 + 지난 ${WINDOW_YEARS}년간 편출된 종목들. ImNotApe Daily Challenge 후보 풀.`,
    builtAt: new Date().toISOString(),
    source: 'FMP /stable/sp500-constituent + /stable/historical-sp500-constituent',
    windowYears: WINDOW_YEARS,
    cutoffDate: cutoff.toISOString().slice(0, 10),
    currentCount: current.length,
    historicalCount: addedHistorical,
    totalCount: companies.length,
    companies
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log('');
  console.log(`✓ Wrote ${OUTPUT_PATH}`);
  console.log(`  Total: ${output.totalCount} companies`);
  console.log(`    Current:    ${output.currentCount}`);
  console.log(`    Historical: ${output.historicalCount} (편출됨, 지난 ${WINDOW_YEARS}년 내)`);
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
