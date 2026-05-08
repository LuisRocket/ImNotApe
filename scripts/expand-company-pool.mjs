#!/usr/bin/env node
// 카탈로그의 company_pool을 5개 → 8개로 확장.
// 각 회사별 추가 미끼 3개를 hand-curated. 정답 회사 + 기존 미끼 4 + 추가 3.
// 미끼 원칙:
//   - 같은 산업 우선, 인접 산업 1~2개 섞어서 변별력 유지
//   - 정답 시기(FY)에 존재했던 회사
//   - 정답 unique 유지 — 추가 미끼들은 정답과 *그럴듯하게 헷갈리되 명백히 다른* 회사
//
// idempotent — 이미 8개 이상인 풀은 건드리지 않음.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG_DIR = 'content/catalog';

// slug → 추가할 미끼 3개
const EXTRA_DECOYS = {
  'AAL-FY2020': ['JetBlue Airways', 'Alaska Air Group', 'FedEx'],
  'ABNB-FY2020': ['Hilton Worldwide', 'Hyatt Hotels', 'DoorDash'],
  'APO-FY2021': ['Ares Management', 'T. Rowe Price', 'BlackRock'],
  'BA-FY2024': ['Northrop Grumman', 'General Dynamics', 'L3Harris Technologies'],
  'CAH-FY2022': ['CVS Health', 'Walgreens Boots Alliance', 'Patterson Companies'],
  'CCL-FY2020': ['Wynn Resorts', 'MGM Resorts', 'Marriott International'],
  'CHK-FY2020': ['Cabot Oil & Gas', 'ConocoPhillips', 'Devon Energy'],
  'COIN-FY2022': ['Interactive Brokers', 'MarketAxess', 'Tradeweb Markets'],
  'CVNA-FY2021': ['Penske Automotive', 'Lithia Motors', 'Sonic Automotive'],
  'DD-FY2017': ['Eastman Chemical', 'PPG Industries', 'Air Products & Chemicals'],
  'DISCK-FY2022': ['Roku', 'Spotify', 'Fox Corporation'],
  'ESRX-FY2012': ['Medco Health Solutions', 'Catamaran', 'AmerisourceBergen'],
  'HES-FY2016': ['Anadarko Petroleum', 'Pioneer Natural Resources', 'EOG Resources'],
  'HOOD-FY2022': ['LPL Financial', 'Tradeweb Markets', 'StoneX Group'],
  'INTC-FY2024': ['Qualcomm', 'Broadcom', 'Marvell Technology'],
  'LUV-FY2020': ['Delta Air Lines', 'United Airlines', 'Allegiant Travel'],
  'LVS-FY2020': ['Penn Entertainment', 'Boyd Gaming', 'Carnival'],
  'MRNA-FY2023': ['Vertex Pharmaceuticals', 'Gilead Sciences', 'AstraZeneca'],
  'MU-FY2023': ['SK Hynix', 'Lam Research', 'Seagate Technology'],
  'NCLH-FY2021': ['Marriott International', 'Wynn Resorts', 'Booking Holdings'],
  'NVDA-FY2026': ['Marvell Technology', 'Arista Networks', 'Palantir Technologies'],
  'PARA-FY2019': ['Netflix', 'Roku', 'Sirius XM'],
  'PCG-FY2020': ['Southern Company', 'NextEra Energy', 'Dominion Energy'],
  'PXD-FY2021': ['Marathon Oil', 'Devon Energy', 'Chesapeake Energy'],
  'SEDG-FY2024': ['Bloom Energy', 'ChargePoint Holdings', 'Plug Power'],
  'SMCI-FY2024': ['Pure Storage', 'NetApp', 'Cisco Systems'],
  'TDG-FY2019': ['Spirit AeroSystems', 'Hexcel', 'Moog Inc'],
  'TMUS-FY2020': ['Sprint Corporation', 'U.S. Cellular', 'Lumen Technologies'],
  'TSLA-FY2017': ['Toyota Motor', 'Volkswagen', 'BMW'],
  'UBER-FY2019': ['Grubhub', 'Expedia Group', 'Snap']
};

const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.json') && f !== '_index.json');

let updated = 0;
let skipped = 0;
let missing = [];

for (const file of files) {
  const slug = file.replace('.json', '');
  const path = join(CATALOG_DIR, file);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const pool = data.challenge.company_pool;

  if (pool.length >= 8) {
    skipped++;
    continue;
  }

  const extras = EXTRA_DECOYS[slug];
  if (!extras) {
    missing.push(slug);
    continue;
  }

  // 중복 제거
  const seen = new Set(pool);
  const newDecoys = extras.filter((d) => !seen.has(d));
  data.challenge.company_pool = [...pool, ...newDecoys];

  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  updated++;
  console.log(`${slug}: ${pool.length} → ${data.challenge.company_pool.length}`);
}

console.log(`\nupdated: ${updated}, skipped: ${skipped}, missing: ${missing.length}`);
if (missing.length) console.log('missing slugs:', missing);
