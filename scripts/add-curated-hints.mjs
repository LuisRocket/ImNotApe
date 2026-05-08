#!/usr/bin/env node
/**
 * add-curated-hints — 큐레이션 힌트 2개씩 모든 catalog 파일에 일괄 주입.
 *
 * 입력:
 *   content/catalog/{slug}.json (30개)
 *
 * 출력:
 *   같은 파일에 challenge.curated_hints = [{category, body}, {category, body}] 추가 (in-place).
 *
 * 멱등: 이미 있으면 덮어쓴다.
 *
 * 실행: node scripts/add-curated-hints.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'content', 'catalog');

// 슬러그 → [{category, body}, {category, body}]
// 각 challenge의 narrative + era_signal에서 압축한 결정적 단서.
const HINTS = {
  'AAL-FY2020': [
    {
      category: '시대/사건',
      body: '2020 COVID 록다운으로 미국 빅3 항공사 매출 60% 동시 증발. CARES Act 직접지원·대출 수령, AAdvantage 마일리지 프로그램을 담보로 채권 발행.'
    },
    {
      category: '비즈니스 결정타',
      body: '미국 항공 빅3(AAL/DAL/UAL) 중 부채가 가장 무거워 셧다운 충격에 자기자본이 마이너스로 꺾인 회사 — DAL과 매출 17B 동일하지만 자본 부호가 다름.'
    }
  ],
  'ABNB-FY2020': [
    {
      category: '시대/사건',
      body: '2020년 12월 10일 NASDAQ 직상장. 봄 예약 -50%까지 갔으나 교외·소도시 leisure 수요로 회복해 매출 -30% 선에서 멈춤. 상장과 함께 RSU 베스팅 트리거.'
    },
    {
      category: '비즈니스 결정타',
      body: '호스트 수수료 BM (객실 직접 운영 X) — GM 74%, 호텔 체인과 결정적으로 다른 자산경 플랫폼. Booking은 매출 6.8B + GM 86%로 분리.'
    }
  ],
  'APO-FY2021': [
    {
      category: '시대/사건',
      body: '2021년 3월 Athene Holding 11B 합병 발표 — PE 운용사가 어뉴이티 보험사 흡수해 영구자본(permanent capital) 풀 확보. Leon Black CEO 사임 후 Marc Rowan 체제.'
    },
    {
      category: '비즈니스 결정타',
      body: 'PE 운용보수 + carry 모델로 GM 87% — 보험 통합 시작으로 자산 사이드가 polarized된 alternative asset manager. KKR도 Global Atlantic 인수로 동일 길.'
    }
  ],
  'BA-FY2024': [
    {
      category: '시대/사건',
      body: '2024년 1월 Alaska 1282편 도어플러그 사고로 737 MAX 9 운항정지 + IAM 노조 53일 파업으로 737/777/767 생산 중단. Calhoun→Ortberg CEO 교체, 24B mixed offering.'
    },
    {
      category: '비즈니스 결정타',
      body: '미국 *유일* 상용기 OEM (Airbus와 듀오폴리). 음의 자기자본 누적에도 commercial backlog 500B+가 회사를 떠받침. Lockheed는 흑자·양의 자본으로 정반대.'
    }
  ],
  'CAH-FY2022': [
    {
      category: '시대/사건',
      body: '2021년 7월 발표된 미국 주·지방정부 opioid 합의(빅3 합산 21B 25년 분할납부) 충당 누적 + Medical 사업부 글로벌 PPE 가격 정상화 손상으로 자기자본 음수 진입.'
    },
    {
      category: '비즈니스 결정타',
      body: '미국 의약품 유통 빅3 중 유일한 *6월 결산* — McKesson(3월)·AmerisourceBergen(9월)과 결산일로 분리. GM 3%대 박마진 + 거대 working capital BM.'
    }
  ],
  'CCL-FY2020': [
    {
      category: '시대/사건',
      body: '2020년 3월 글로벌 크루즈 산업 *동시 운항 중단* — 한 척이라도 출항하면 floating outbreak로 헤드라인. 부채와 신주 동시 발행으로 28B 유동성 확보.'
    },
    {
      category: '비즈니스 결정타',
      body: '글로벌 *최대* 크루즈 사업자(빅3 1위, RCL/NCLH보다 큼). 11월 결산이라 셧다운이 한 회계연도에 깔끔히 담김 — RCL은 12월 결산.'
    }
  ],
  'CHK-FY2020': [
    {
      category: '시대/사건',
      body: '2020년 6월 28일 Chapter 11 파산 신청 — 미국 셰일가스 1세대 대표주자(Aubrey McClendon 유산) 몰락. 2024년 Southwestern과 합병해 Expand Energy(EXE)로 변경.'
    },
    {
      category: '비즈니스 결정타',
      body: '셰일 *천연가스* 단일 BM (Marcellus·Haynesville·Eagle Ford). EQT(매출 2.7B)보다 컸던 미국 가스 1순위 파산회사 — 9B 부채 정리.'
    }
  ],
  'COIN-FY2022': [
    {
      category: '시대/사건',
      body: 'Crypto Winter — 5월 Luna/UST 붕괴, 6월 3AC 파산, 7월 Celsius 동결, 11월 FTX 폭발. 거래량 사라지며 매출 7.8B → 3.2B 반토막. 18% 인력감축 두 차례.'
    },
    {
      category: '비즈니스 결정타',
      body: '미국 *상장* 암호화폐 거래소 단독 — 거래수수료 단일 BM(GM 80%대), 자산운용·이자수익 없음. Schwab(매출 21B)은 자산운용으로 이자 수익이 있음.'
    }
  ],
  'CVNA-FY2021': [
    {
      category: '시대/사건',
      body: '2021년 미국 중고차 가격 *사상 최고* 매달 갱신 (반도체 부족으로 신차 공급 차단). Manheim 지수 +40%. ADESA US 22억 경매장 인수 발표(2022.5 마무리).'
    },
    {
      category: '비즈니스 결정타',
      body: '온라인 *자판기* 중고차 BM — 자동차 직접 매입·재컨디셔닝·딜리버리. 매출 13B 옆에 재고 3.1B + FCF -2.3B. CarMax(매출 33B, 2월 결산)와 분리.'
    }
  ],
  'DD-FY2017': [
    {
      category: '시대/사건',
      body: '2017년 9월 1일 Dow-DuPont 130B 메가머저 완료로 한시적 모회사 DowDuPont(DWDP) 출범. 18개월 후 3사(Dow/Corteva/DuPont) 분사 예정 — *합병 자체가 해체 도구*.'
    },
    {
      category: '비즈니스 결정타',
      body: '매출 62B 다업종 화학 메이저 + 합병 직후 Goodwill +44B 폭증. BASF(독일 상장, EUR)·3M(매출 31B)과 시그니처 분리.'
    }
  ],
  'DISCK-FY2022': [
    {
      category: '시대/사건',
      body: '2022년 4월 8일 AT&T로부터 WarnerMedia 분사 + Discovery 합병으로 Warner Bros Discovery 출범. CEO David Zaslav, "Batgirl" 등 콘텐츠 손상충당, HBO Max+Discovery+ → Max 통합.'
    },
    {
      category: '비즈니스 결정타',
      body: '합병 직후 *첫 회계연도* 매출 34B — 거대 콘텐츠 amortization + purchase accounting 무형자산. Disney(82B)보다 작고 Paramount(FY2019 정답)와 시기로 분리.'
    }
  ],
  'ESRX-FY2012': [
    {
      category: '시대/사건',
      body: '2012년 4월 2일 Medco Health Solutions 29B 인수 마무리 — 미국 *최대* PBM 탄생, 처방약 청구 1/3 처리. 2018 Cigna가 67B에 인수해 상장폐지.'
    },
    {
      category: '비즈니스 결정타',
      body: 'PBM 단독 BM — 처방약 매출 grossful + 약값 매출원가 1:1 pass-through로 GM 7.8%. 약국 통합 없음(CVS-Caremark 매출 124B + 약국과 차이).'
    }
  ],
  'HES-FY2016': [
    {
      category: '시대/사건',
      body: '2014~16년 OPEC 셰일 가격전쟁 *바닥* (WTI 26달러). 2015년 5월 Guyana Stabroek 블록 Liza-1 발견 발표 (XOM 운영자, HES 30%). 2025년 Chevron 53B 인수 마무리.'
    },
    {
      category: '비즈니스 결정타',
      body: 'Bakken + Gulf of Mexico + Guyana 30% 지분 — 셰일 + offshore + 미발견 자산 트리플 포트폴리오. Apache(Permian/Egypt)·Marathon(Bakken/Eagle Ford)과 다름.'
    }
  ],
  'HOOD-FY2022': [
    {
      category: '시대/사건',
      body: 'Fed 빅스텝 금리인상으로 meme stock 광풍 종료 + crypto winter로 retail 거래량 동시 절벽. SEC Gensler가 PFOF 규제 검토 본격 거론, 정책 리스크가 주가 짓누름.'
    },
    {
      category: '비즈니스 결정타',
      body: '무수수료 거래 + PFOF (Payment for Order Flow) 매출 의존 — Citadel Securities 등 시장조성자 리베이트가 매출 비중. mobile-first retail 브로커리지.'
    }
  ],
  'INTC-FY2024': [
    {
      category: '시대/사건',
      body: 'AI 슈퍼사이클에 NVDA에 데이터센터 물량 빼앗기고 18A 양산 지연. 12월 Pat Gelsinger 사임. CHIPS Act 7.86B 보조금 + Intel Foundry Services 분리 검토.'
    },
    {
      category: '비즈니스 결정타',
      body: '한때 GM 60%대였던 미국 대표 *IDM* (자체 fab 보유 반도체) — GM 32%까지 추락. fabless AMD(GM 50%대)·순수 파운드리 TSMC(대만 상장)와 시그니처 정반대.'
    }
  ],
  'LUV-FY2020': [
    {
      category: '시대/사건',
      body: '1973년부터의 *50년 흑자 기록*이 COVID 록다운에 끊어진 해. 빅3와 달리 양(+)의 자본 유지하며 더 빠른 회복 — 미국 항공사 중 *유일* 투자등급 신용.'
    },
    {
      category: '비즈니스 결정타',
      body: '단일 기종(737)만 운영하는 LCC, 점대점(point-to-point) 노선망, secondary 공항 활용 — 50년 변하지 않은 *부채 가벼운 자본구조*. JetBlue(매출 2.9B)·빅3(15~17B)와 규모 분리.'
    }
  ],
  'LVS-FY2020': [
    {
      category: '시대/사건',
      body: '2020 마카오·싱가포르 IR(integrated resort) 셧다운 — Macau는 zero-COVID 정책 visa 제한 한 해 유지. 2021년 1월 Sheldon Adelson 사망 → 2022 라스베가스 자산 매각.'
    },
    {
      category: '비즈니스 결정타',
      body: "'Las Vegas' Sands라는 이름과 달리 매출 사실상 전부 *Macau + 싱가포르* (The Venetian Macao, Marina Bay Sands) — Macau visa 정책 한 줄에 손익 좌우. WYNN/MGM과 지역으로 구분."
    }
  ],
  'MRNA-FY2023': [
    {
      category: '시대/사건',
      body: 'COVID 백신 수요 절벽 — Spikevax 매출 18B → 6.7B (-64%). 미국·유럽 정부 비축 계약 만료 + 미사용 백신 폐기 충당. RSV·인플루엔자·MRK 협업 암 백신 R&D 확장.'
    },
    {
      category: '비즈니스 결정타',
      body: 'mRNA 플랫폼 *상장* 단독 회사 (BNTX 비상장, Pfizer는 빅파마 매출 58B). Spikevax 단일 제품 사이클 직후로 매출 절벽인데 R&D는 4B대 그대로 유지.'
    }
  ],
  'MU-FY2023': [
    {
      category: '시대/사건',
      body: 'DRAM·NAND 가격 *사상 최악* 폭락 (한 분기 30%씩) — PC·스마트폰·데이터센터 동시 재고조정. CHIPS Act 발효로 NY/Idaho fab 투자 결정 + HBM이 다음 사이클 무기로 등장.'
    },
    {
      category: '비즈니스 결정타',
      body: '미국 *메모리(DRAM/NAND)* 단일 BM 메이커 — 8월 결산. 노드 전환 capex를 사이클 바닥에서도 끊을 수 없음. Samsung(KRW)·Western Digital(6월결산, 12B)과 분리.'
    }
  ],
  'NCLH-FY2021': [
    {
      category: '시대/사건',
      body: '2021년 크루즈 재개 시도가 Delta·Omicron 변이로 두 번 좌절 — 빅3 점유율 회복 2019 대비 30%↓. 추가 채권·신주 발행 반복으로 buy-time 현금 모음.'
    },
    {
      category: '비즈니스 결정타',
      body: '글로벌 크루즈 빅3 중 *가장 작은* 사업자 — 매출 0.65B로 함대 유지비도 못 메움, GM -148%/NM -695%. CCL(매출 5.6B)·RCL(1.5B)와 규모로 분리.'
    }
  ],
  'NVDA-FY2026': [
    {
      category: '시대/사건',
      body: 'AI 데이터센터 GPU 수요 정점. Blackwell B200/GB200 본격 양산. MSFT/META/GOOG/AMZN 4사 합산 capex 350B+ 대부분이 NVDA로 전환 — 한 회사가 산업 capex 사이클을 통째 흡수.'
    },
    {
      category: '비즈니스 결정타',
      body: '*1월 결산* + GM 71% + 영업이익률 60%+ — fabless GPU + NVLink/CUDA *시스템 마진*으로 SaaS급. AMD(GM 50%대, 12월결산)·Broadcom(10월결산, 매출 51B)과 분리.'
    }
  ],
  'PARA-FY2019': [
    {
      category: '시대/사건',
      body: '2019년 12월 4일 Viacom-CBS *재합병* 완료 — 2006년 분사 후 13년만에. Sumner Redstone의 딸 Shari Redstone 주도. 2022년 Paramount Global로 사명 변경.'
    },
    {
      category: '비즈니스 결정타',
      body: '방송망(CBS) + 영화 스튜디오(Paramount Pictures) + 케이블(Showtime/MTV/Nickelodeon/BET) 통합 첫 회계연도 — 매출 28B. Disney(70B + Fox 인수 직후)와 규모·방향 정반대.'
    }
  ],
  'PCG-FY2020': [
    {
      category: '시대/사건',
      body: '2020년 7월 1일 Chapter 11 출빠 — 2017-18 California Wildfire(Camp Fire 88명 사망 등) 13.5B 합의금 + 25.5B 채무재조정 BS 일괄 반영. FCF -26.8B는 자본구조 재편.'
    },
    {
      category: '비즈니스 결정타',
      body: '캘리포니아 *최대* 전력 유틸리티 (regulated). 매출 18B로 Edison International(매출 14B, Ch.11 부재)·Sempra(가스통합, 매출 11B)와 규모·BM 분리.'
    }
  ],
  'PXD-FY2021': [
    {
      category: '시대/사건',
      body: '2021년 1월 Parsley Energy 7.6B + 5월 DoublePoint 6.4B 인수로 Permian basin 통합 완성. 미국 셰일 *처음으로 변동배당(variable dividend) 도입* — capital discipline 모드 전환의 표지석. 2024.5 XOM 60B 인수 마무리.'
    },
    {
      category: '비즈니스 결정타',
      body: 'Permian basin *단일 지역* pure-play E&P + 매출 18B — Diamondback(6.7B)·EOG/COP(다지역 포트폴리오)와 분리.'
    }
  ],
  'SEDG-FY2024': [
    {
      category: '시대/사건',
      body: '미국·유럽 주거용 태양광 시장 채널 재고 과다 + 미국 고금리로 ROI 악화 + CA NEM 3.0 발효. 채널에 쌓인 인버터 재고가 역풍 → inventory write-down 분기마다 누적.'
    },
    {
      category: '비즈니스 결정타',
      body: '*이스라엘* 본사, 글로벌 주거용 인버터 1위 단일 BM — Enphase(마이크로인버터, GM 47% 양수)와 비교해 인벤토리 정책 차이로 GM -97% 침몰. First Solar(박막)와 카테고리 다름.'
    }
  ],
  'SMCI-FY2024': [
    {
      category: '시대/사건',
      body: 'NVDA H100/H200 GPU 호황으로 매출 7.1B → 15B 두 배. 8월 Hindenburg Research 회계 의혹 보고 + 10-K 지연 + Ernst & Young 감사인 사임 → NASDAQ 상폐 카운트다운, 주가 80%↓.'
    },
    {
      category: '비즈니스 결정타',
      body: 'AI 서버 ODM (NVDA GPU를 박스에 끼움) — GM 13.7%로 NVDA(71%)와 정반대. 6월 결산. Dell(매출 88B, 1월결산)·HPE와 결산일·마진으로 분리.'
    }
  ],
  'TDG-FY2019': [
    {
      category: '시대/사건',
      body: '2019년 8월 한 주당 30달러 *특별배당* 단행 — 부채 발행으로 거대 환원하는 LBO형 자본정책 반복. 누적되며 자기자본 음수 지속 (의도된 자본구조).'
    },
    {
      category: '비즈니스 결정타',
      body: 'FAA 인증 단조부품 중 *유일 공급자* SKU만 모은 항공 aftermarket — 9월 결산 + GM 51%(SaaS급) + 음의 자본 모두 만족하는 미국 상장사 단 하나. HEICO(GM 39%, 양의 자본, 10월결산)와 분리.'
    }
  ],
  'TMUS-FY2020': [
    {
      category: '시대/사건',
      body: '2020년 4월 1일 Sprint 26B 합병 완료 — 2018년 발표 후 반독점 심사 2년, DOJ 합의로 Dish에 보라색 대역 매각. 미국 통신 빅3(VZ/T/TMUS) 재편 + 5G mid-band 망 통합 capex.'
    },
    {
      category: '비즈니스 결정타',
      body: '합병 직후 *통합 첫 9개월*만 반영된 매출 68B — 빅3 중 가장 작음. AT&T(172B)·Verizon(128B)과 매출 규모로 명확히 분리.'
    }
  ],
  'TSLA-FY2017': [
    {
      category: '시대/사건',
      body: "2017년 7월 28일 Model 3 첫 인도 — 'production hell' 시작. Fremont 자동화 라인 실패로 Q4 1,550대만 인도. 2016년 11월 SolarCity 26억 인수 첫 통합 회계연도."
    },
    {
      category: '비즈니스 결정타',
      body: '미국 *EV pure-play* 상장사 단독 — Rivian/Lucid 비상장, BYD는 중국 상장 + EV 비중 낮음. Gigafactory 1·Fremont 라인 증설 capex 폭발 + SBC 폭발.'
    }
  ],
  'UBER-FY2019': [
    {
      category: '시대/사건',
      body: '2019년 5월 10일 NYSE IPO — 가격 45달러, 첫날 7.6%↓. 비공개 RSU 베스팅 가속으로 SBC 4.6B 폭발(영업손실 절반이 비현금). Lyft 가격전쟁 + DoorDash 음식배달 경쟁.'
    },
    {
      category: '비즈니스 결정타',
      body: '글로벌 라이드쉐어 1위 (Lyft 매출 4B의 3배+) — 운전자 인센티브를 매출 차감으로 처리해 GM 53%, 플랫폼치곤 낮은 이유. Airbnb(GM 74%)와 BM 분리.'
    }
  ]
};

async function main() {
  const files = (await fs.readdir(CATALOG))
    .filter((f) => f.endsWith('.json') && f !== '_index.json')
    .sort();

  console.log(`Adding curated_hints to ${files.length} catalog entries...`);

  let ok = 0;
  let missing = 0;
  const missingSlugs = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const hints = HINTS[slug];
    if (!hints) {
      console.warn(`  ⚠ ${slug}: 힌트 정의 없음`);
      missing++;
      missingSlugs.push(slug);
      continue;
    }
    if (hints.length !== 2) {
      throw new Error(`${slug}: 힌트는 정확히 2개여야 함 (현재 ${hints.length})`);
    }

    const catalogPath = path.join(CATALOG, file);
    const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
    catalog.challenge.curated_hints = hints;
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
    console.log(`  ✓ ${slug}`);
    ok++;
  }

  console.log('');
  console.log(`Updated ${ok}/${files.length} (missing ${missing})`);
  if (missingSlugs.length > 0) {
    console.log('Missing definitions:');
    for (const s of missingSlugs) console.log(`  ${s}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
