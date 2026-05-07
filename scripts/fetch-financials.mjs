#!/usr/bin/env node
/**
 * Bulk fetch financial statements for curated S&P 500 subset.
 *
 * 입력: data/companies.json
 * 출력: data/financials/{TICKER}.json (회사별 1 파일)
 *       data/metadata.json (마지막 fetch 정보)
 *
 * 환경변수: FMP_API_KEY (필수, .env에 둘 것)
 *
 * 실행: npm run fetch:financials
 *       npm run fetch:financials -- --force      (이미 받은 회사도 다시)
 *       npm run fetch:financials -- --tickers=AAPL,MSFT  (일부만)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.FMP_API_KEY;
if (!API_KEY) {
  console.error(
    'ERROR: FMP_API_KEY 환경변수가 없습니다.\n' +
      '       .env 파일에 다음과 같이 추가하세요:\n' +
      '       FMP_API_KEY=your_api_key_here'
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const TICKERS_FLAG = argv.find((a) => a.startsWith('--tickers='));
const TICKERS_FILTER = TICKERS_FLAG
  ? TICKERS_FLAG.split('=')[1].split(',').map((s) => s.trim().toUpperCase())
  : null;

const ROOT = process.cwd();
const COMPANIES_PATH = path.join(ROOT, 'data', 'companies.json');
const OUTPUT_DIR = path.join(ROOT, 'data', 'financials');
const METADATA_PATH = path.join(ROOT, 'data', 'metadata.json');

const YEARS = 10;
const BASE = 'https://financialmodelingprep.com/api/v3';

// fetch 한 번에 가져올 endpoints — 회사 1곳당 5콜
const ENDPOINTS = [
  { key: 'incomeStatement', path: 'income-statement' },
  { key: 'balanceSheet', path: 'balance-sheet-statement' },
  { key: 'cashFlow', path: 'cash-flow-statement' },
  { key: 'keyMetrics', path: 'key-metrics' },
  { key: 'ratios', path: 'ratios' }
];

async function fetchJson(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    if (res.status === 429) {
      // rate limit — wait and retry
      const delay = 2000 * (attempt + 1);
      console.warn(`    rate limited, retrying after ${delay}ms`);
      await sleep(delay);
      continue;
    }
    if (attempt === retries) {
      throw new Error(`HTTP ${res.status}: ${url.replace(API_KEY, '***')}`);
    }
    await sleep(500 * (attempt + 1));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTicker(ticker) {
  const result = {
    ticker,
    fetchedAt: new Date().toISOString(),
    years: YEARS
  };
  for (const ep of ENDPOINTS) {
    const url = `${BASE}/${ep.path}/${ticker}?period=annual&limit=${YEARS}&apikey=${API_KEY}`;
    const data = await fetchJson(url);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`${ep.key}: empty response`);
    }
    result[ep.key] = data;
    await sleep(50); // gentle pace
  }
  return result;
}

async function shouldSkip(ticker) {
  if (FORCE) return false;
  const filePath = path.join(OUTPUT_DIR, `${ticker}.json`);
  try {
    const stat = await fs.stat(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 30) return true; // 30일 이내 fetch는 skip
  } catch {
    return false;
  }
  return false;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const companiesRaw = JSON.parse(await fs.readFile(COMPANIES_PATH, 'utf-8'));
  let companies = companiesRaw.companies;

  if (TICKERS_FILTER) {
    companies = companies.filter((c) => TICKERS_FILTER.includes(c.ticker));
    console.log(`Filtered to ${companies.length} ticker(s): ${TICKERS_FILTER.join(', ')}`);
  }

  const total = companies.length;
  console.log(`Fetching ${total} companies × ${YEARS} years × ${ENDPOINTS.length} endpoints...`);
  console.log(`Estimated API calls: ${total * ENDPOINTS.length}`);
  console.log('');

  const stats = { fetched: 0, skipped: 0, failed: [] };
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const company = companies[i];
    const ticker = company.ticker;
    const progress = `[${(i + 1).toString().padStart(3)}/${total}]`;

    if (await shouldSkip(ticker)) {
      console.log(`${progress} ${ticker.padEnd(6)} ⊙ skipped (cached <30d, use --force to refetch)`);
      stats.skipped++;
      continue;
    }

    try {
      const data = await fetchTicker(ticker);
      const outPath = path.join(OUTPUT_DIR, `${ticker}.json`);
      await fs.writeFile(outPath, JSON.stringify(data, null, 2));
      const yearCount = data.incomeStatement.length;
      console.log(`${progress} ${ticker.padEnd(6)} ✓ ${yearCount} years (${company.sector})`);
      stats.fetched++;
    } catch (err) {
      console.error(`${progress} ${ticker.padEnd(6)} ✗ ${err.message}`);
      stats.failed.push({ ticker, error: err.message });
    }
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  // metadata 갱신
  await fs.writeFile(
    METADATA_PATH,
    JSON.stringify(
      {
        lastFetchAt: new Date().toISOString(),
        years: YEARS,
        totalCompanies: total,
        fetched: stats.fetched,
        skipped: stats.skipped,
        failedCount: stats.failed.length,
        failed: stats.failed,
        endpoints: ENDPOINTS.map((e) => e.key)
      },
      null,
      2
    )
  );

  console.log('');
  console.log(`Done in ${elapsedSec}s — ${stats.fetched} fetched, ${stats.skipped} skipped, ${stats.failed.length} failed`);
  if (stats.failed.length > 0) {
    console.log('Failed tickers:', stats.failed.map((f) => f.ticker).join(', '));
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
