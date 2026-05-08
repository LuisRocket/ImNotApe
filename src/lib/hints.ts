import type { Challenge } from './types';

export interface Hint {
  id: number;
  label: string; // 힌트 카테고리 (UI 라벨)
  body: string; // 공개 시 보여줄 텍스트
  cost: number; // 점수 차감
  tier: 'auto' | 'curated'; // 자동 파생 vs 큐레이션
}

export const HINT_COST = 500;
export const CURATED_HINT_COST = 1000;

function revenueBand(rev: number): string {
  const abs = Math.abs(rev);
  if (abs < 1_000_000_000) return '$1B 미만';
  if (abs < 5_000_000_000) return '$1B–$5B';
  if (abs < 10_000_000_000) return '$5B–$10B';
  if (abs < 50_000_000_000) return '$10B–$50B';
  if (abs < 100_000_000_000) return '$50B–$100B';
  if (abs < 250_000_000_000) return '$100B–$250B';
  return '$250B+';
}

function marginBand(om: number | null | undefined): string {
  if (om === null || om === undefined) return '판단 어려움';
  if (om < -0.2) return '큰 폭 적자(-20% 이하)';
  if (om < 0) return '적자(0~-20%)';
  if (om < 0.05) return '거의 손익분기(0~5%)';
  if (om < 0.15) return '저~중 마진(5~15%)';
  if (om < 0.3) return '중~고 마진(15~30%)';
  return '고마진(30%+)';
}

function dominantCost(is: {
  revenue: number;
  costOfRevenue: number;
  researchAndDevelopmentExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
}): string {
  const rev = is.revenue || 0;
  if (rev === 0) return '판단 어려움';
  const ratios: Array<[string, number]> = [
    ['매출원가', (is.costOfRevenue || 0) / rev],
    ['R&D', (is.researchAndDevelopmentExpenses || 0) / rev],
    ['판관비(SG&A)', (is.sellingGeneralAndAdministrativeExpenses || 0) / rev]
  ];
  ratios.sort((a, b) => b[1] - a[1]);
  const [name, share] = ratios[0];
  if (share <= 0) return '판단 어려움';
  return `${name} 비중이 가장 큼 (매출의 ${(share * 100).toFixed(0)}%)`;
}

function capitalIntensity(bs: { propertyPlantEquipmentNet: number; totalAssets: number }): string {
  const ppe = bs.propertyPlantEquipmentNet || 0;
  const ta = bs.totalAssets || 0;
  if (ta === 0) return '판단 어려움';
  const share = ppe / ta;
  if (share >= 0.5) return '자본집약형 (유형자산이 자산의 50%↑)';
  if (share >= 0.25) return '중간 자본집약 (유형자산 25~50%)';
  if (share >= 0.1) return '경자산형 (유형자산 10~25%)';
  return '극경자산형 (유형자산 10% 미만)';
}

function capitalAllocation(cf: {
  commonDividendsPaid: number;
  commonStockRepurchased: number;
}): string {
  const div = Math.abs(cf.commonDividendsPaid || 0);
  const buyback = Math.abs(cf.commonStockRepurchased || 0);
  const hasDiv = div > 0;
  const hasBuyback = buyback > 0;
  if (hasDiv && hasBuyback) return '배당 + 자사주 매입 모두 시행';
  if (hasDiv) return '배당 지급 (자사주 매입 없음)';
  if (hasBuyback) return '자사주 매입 (배당 없음)';
  return '배당·자사주 모두 없음';
}

function trendLine(history: NonNullable<Challenge['challenge']['financials_history']>): string {
  if (history.length < 2) return '';
  const rev = history.map((h) => h.income_statement.revenue || 0);
  const first = rev[0];
  const last = rev[rev.length - 1];
  const yoyLast =
    rev.length >= 2 && rev[rev.length - 2] !== 0
      ? (last - rev[rev.length - 2]) / rev[rev.length - 2]
      : null;
  const years = history.length;
  const cagr = first > 0 && years >= 2 ? Math.pow(last / first, 1 / (years - 1)) - 1 : null;

  const parts: string[] = [];
  if (cagr !== null) {
    const sign = cagr >= 0 ? '+' : '';
    parts.push(`${years}년 매출 CAGR ${sign}${(cagr * 100).toFixed(0)}%`);
  }
  if (yoyLast !== null) {
    const sign = yoyLast >= 0 ? '+' : '';
    parts.push(`직전년 대비 ${sign}${(yoyLast * 100).toFixed(0)}%`);
  }
  return parts.join(' · ');
}

export function deriveHints(challenge: Challenge): Hint[] {
  const ch = challenge.challenge;
  const fin = ch.financials;
  const is = fin.income_statement;
  const bs = fin.balance_sheet;
  const cf = fin.cash_flow_statement;
  const history = ch.financials_history ?? [];

  const hint1Body = `${capitalIntensity(bs)} · ${dominantCost(is)}`;

  const hint2Body = `매출 ${revenueBand(is.revenue)} · 영업이익률 ${marginBand(is.operatingMargin)}`;

  const allocBody = capitalAllocation(cf);
  const trendBody = trendLine(history);
  const hint3Body = trendBody ? `${allocBody} · ${trendBody}` : allocBody;

  const auto: Hint[] = [
    { id: 1, label: '비즈니스 모델', body: hint1Body, cost: HINT_COST, tier: 'auto' },
    { id: 2, label: '규모와 수익성', body: hint2Body, cost: HINT_COST, tier: 'auto' },
    { id: 3, label: '자본 배분 · 추세', body: hint3Body, cost: HINT_COST, tier: 'auto' }
  ];

  const curated: Hint[] = (ch.curated_hints ?? []).map((h, i) => ({
    id: 4 + i,
    label: h.category,
    body: h.body,
    cost: CURATED_HINT_COST,
    tier: 'curated' as const
  }));

  return [...auto, ...curated];
}
