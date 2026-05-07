<script lang="ts">
  import { fmtMoney, fmtPct, fmtNum } from '$lib/format';
  import StatementTable from '$lib/StatementTable.svelte';
  import Narrative from '$lib/Narrative.svelte';

  let { data } = $props();

  // 오늘 날짜 기준 deterministic 선택
  function todayString(): string {
    return new Date().toISOString().slice(0, 10);
  }
  function hashStr(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return h >>> 0;
  }
  const today = todayString();
  const idx = hashStr(today) % data.pool.length;
  const selected = data.pool[idx];
  const c = selected.data;
  const ch = c.challenge;
  const fin = ch.financials;
  const ratios = ch.derived_ratios;
  const challengeId = selected.id;
  const challengeDate = today;

  let pickedIndustry = $state<string | null>(null);
  let pickedCompany = $state<string | null>(null);
  let revealed = $state(false);

  let industryDistance = $derived(
    pickedIndustry ? c.scoring.industry_distance[pickedIndustry] ?? 4 : null
  );
  let industryCorrect = $derived(industryDistance === 0);
  let companyCorrect = $derived(pickedCompany === c.answer.company);

  let score = $derived.by(() => {
    if (!revealed) return 0;
    let s = 0;
    if (industryDistance !== null) {
      s += Math.max(0, 4 - industryDistance) * 250; // 0~1000
    }
    if (companyCorrect) s += 4000;
    return s;
  });

  function submit() {
    if (pickedIndustry && pickedCompany) revealed = true;
  }

  function reset() {
    pickedIndustry = null;
    pickedCompany = null;
    revealed = false;
  }
</script>

<article class="issue">
  <div class="issue-meta">
    <span class="date">{challengeDate}</span>
    <span class="dot">·</span>
    <span>Daily Challenge</span>
    <span class="dot">·</span>
    <span>{ch.fiscal_year}</span>
    <span class="dot">·</span>
    <span class="pool-info">{data.pool.length}개 풀 #{idx + 1}</span>
  </div>

  <h1 class="lede">
    이 회사는 <span class="redact">●●●●●</span>이고,<br />이 해는 <span class="fy"
      >{ch.fiscal_year}</span
    >이다. <span class="who">누구일까?</span>
  </h1>

  <p class="dek">
    아래 재무제표는 S&amp;P 500에 속한 한 회사의 {ch.fiscal_year} 연간 보고서에서 발췌했다.
    회사명·세그먼트·지역 정보는 가렸다. 숫자만 보고 산업과 회사를 좁혀가 보자.
  </p>

  <aside class="hint">
    <span class="hint-label">FY 종료</span>
    <span>{ch.fiscal_year_end_hint}</span>
    <span class="hint-sep">·</span>
    <span class="hint-label">통화</span>
    <span>{ch.reported_currency}</span>
  </aside>

  <section class="statements">
    <StatementTable
      title="손익계산서"
      subtitle="Income Statement"
      rows={[
        { label: '매출 (Revenue)', value: fmtMoney(fin.income_statement.revenue), emphasis: true },
        { label: '매출원가', value: fmtMoney(fin.income_statement.costOfRevenue) },
        {
          label: '매출총이익 (GP)',
          value: fmtMoney(fin.income_statement.grossProfit),
          aux: fmtPct(fin.income_statement.grossMargin)
        },
        { label: 'R&D 비용', value: fmtMoney(fin.income_statement.researchAndDevelopmentExpenses) },
        {
          label: '판관비 (SG&A)',
          value: fmtMoney(fin.income_statement.sellingGeneralAndAdministrativeExpenses)
        },
        {
          label: '영업이익',
          value: fmtMoney(fin.income_statement.operatingIncome),
          aux: fmtPct(fin.income_statement.operatingMargin),
          emphasis: true
        },
        { label: '이자수익', value: fmtMoney(fin.income_statement.interestIncome) },
        { label: '이자비용', value: fmtMoney(fin.income_statement.interestExpense) },
        { label: '순이자수익', value: fmtMoney(fin.income_statement.netInterestIncome) },
        { label: '감가상각비', value: fmtMoney(fin.income_statement.depreciationAndAmortization) },
        { label: 'EBITDA', value: fmtMoney(fin.income_statement.ebitda) },
        {
          label: '순이익',
          value: fmtMoney(fin.income_statement.netIncome),
          aux: fmtPct(fin.income_statement.netMargin),
          emphasis: true
        },
        { label: '희석 EPS', value: `$${fmtNum(fin.income_statement.epsDiluted)}` }
      ]}
    />

    <StatementTable
      title="재무상태표"
      subtitle="Balance Sheet"
      rows={[
        { label: '현금성자산', value: fmtMoney(fin.balance_sheet.cashAndCashEquivalents) },
        { label: '단기투자자산', value: fmtMoney(fin.balance_sheet.shortTermInvestments) },
        { label: '매출채권', value: fmtMoney(fin.balance_sheet.accountsReceivables) },
        { label: '재고자산', value: fmtMoney(fin.balance_sheet.inventory), emphasis: true },
        { label: '유동자산 합계', value: fmtMoney(fin.balance_sheet.totalCurrentAssets) },
        { label: '유형자산', value: fmtMoney(fin.balance_sheet.propertyPlantEquipmentNet) },
        { label: '영업권', value: fmtMoney(fin.balance_sheet.goodwill) },
        { label: '자산 총계', value: fmtMoney(fin.balance_sheet.totalAssets), emphasis: true },
        {
          label: '매입채무 (AP)',
          value: fmtMoney(fin.balance_sheet.accountPayables),
          emphasis: true
        },
        { label: '미지급비용', value: fmtMoney(fin.balance_sheet.accruedExpenses) },
        { label: '단기차입금', value: fmtMoney(fin.balance_sheet.shortTermDebt) },
        { label: '유동부채 합계', value: fmtMoney(fin.balance_sheet.totalCurrentLiabilities) },
        { label: '장기차입금', value: fmtMoney(fin.balance_sheet.longTermDebt) },
        { label: '부채 총계', value: fmtMoney(fin.balance_sheet.totalLiabilities) },
        { label: '이익잉여금', value: fmtMoney(fin.balance_sheet.retainedEarnings) },
        { label: '자본 총계', value: fmtMoney(fin.balance_sheet.totalStockholdersEquity) },
        { label: '총부채 (Debt)', value: fmtMoney(fin.balance_sheet.totalDebt) },
        { label: '순부채', value: fmtMoney(fin.balance_sheet.netDebt) }
      ]}
    />

    <StatementTable
      title="현금흐름표"
      subtitle="Cash Flow Statement"
      rows={[
        { label: '순이익', value: fmtMoney(fin.cash_flow_statement.netIncome) },
        { label: '감가상각', value: fmtMoney(fin.cash_flow_statement.depreciationAndAmortization) },
        { label: 'SBC', value: fmtMoney(fin.cash_flow_statement.stockBasedCompensation) },
        { label: '재고 변동', value: fmtMoney(fin.cash_flow_statement.changeInInventory) },
        { label: '매입채무 변동', value: fmtMoney(fin.cash_flow_statement.changeInAccountsPayable) },
        {
          label: '영업현금흐름',
          value: fmtMoney(fin.cash_flow_statement.operatingCashFlow),
          emphasis: true
        },
        { label: 'CAPEX', value: fmtMoney(fin.cash_flow_statement.capitalExpenditure) },
        {
          label: '잉여현금흐름 (FCF)',
          value: fmtMoney(fin.cash_flow_statement.freeCashFlow),
          emphasis: true
        },
        { label: 'M&A', value: fmtMoney(fin.cash_flow_statement.acquisitionsNet) },
        { label: '자사주 매입', value: fmtMoney(fin.cash_flow_statement.commonStockRepurchased) },
        {
          label: '배당 지급',
          value: fmtMoney(fin.cash_flow_statement.commonDividendsPaid),
          emphasis: true
        }
      ]}
    />

    <StatementTable
      title="파생 지표"
      subtitle="Derived Ratios"
      rows={[
        { label: '재고회전율', value: `${fmtNum(ratios.inventoryTurnover)}x` },
        { label: '재고일수 (DIO)', value: `${fmtNum(ratios.daysInventoryOutstanding, 1)}일` },
        { label: '현금전환주기 (CCC)', value: `${fmtNum(ratios.cashConversionCycleDays, 1)}일` },
        { label: '유동비율', value: fmtNum(ratios.currentRatio) },
        { label: 'ROE', value: fmtPct(ratios.returnOnEquity) },
        { label: '배당성향', value: fmtPct(ratios.dividendPayoutRatio) },
        { label: 'FCF 마진', value: fmtPct(ratios.fcfMargin) }
      ]}
    />
  </section>

  <section class="funnel">
    <h2 class="step-title"><span class="step-num">1.</span> 어느 산업일까?</h2>
    <div class="options">
      {#each ch.industry_options as opt}
        <button
          class="opt"
          class:picked={pickedIndustry === opt}
          disabled={revealed}
          onclick={() => (pickedIndustry = opt)}
        >
          {opt}
        </button>
      {/each}
    </div>

    <h2 class="step-title"><span class="step-num">2.</span> 정확히 어느 회사일까?</h2>
    <div class="options">
      {#each ch.company_pool as opt}
        <button
          class="opt"
          class:picked={pickedCompany === opt}
          disabled={revealed}
          onclick={() => (pickedCompany = opt)}
        >
          {opt}
        </button>
      {/each}
    </div>

    {#if !revealed}
      <button
        class="submit"
        disabled={!pickedIndustry || !pickedCompany}
        onclick={submit}
      >
        제출하기
      </button>
    {/if}
  </section>

  {#if revealed}
    <section class="result">
      <div class="result-card">
        <div class="result-row">
          <span class="result-label">산업</span>
          <span class="result-pick">{pickedIndustry}</span>
          <span class="badge" class:correct={industryCorrect} class:partial={!industryCorrect && industryDistance !== null && industryDistance < 4}>
            {industryCorrect
              ? '정답'
              : industryDistance !== null && industryDistance < 4
                ? `근접 (거리 ${industryDistance})`
                : '오답'}
          </span>
        </div>
        <div class="result-row">
          <span class="result-label">회사</span>
          <span class="result-pick">{pickedCompany}</span>
          <span class="badge" class:correct={companyCorrect} class:partial={!companyCorrect}>
            {companyCorrect ? '정답' : '오답'}
          </span>
        </div>
        <div class="score-row">
          <span class="score-label">오늘의 점수</span>
          <span class="score-value num">{score.toLocaleString()}</span>
          <span class="score-max">/ 5,000</span>
        </div>
        <button class="reset" onclick={reset}>다시 풀어보기</button>
      </div>

      <Narrative markdown={c.narrative} />
    </section>
  {/if}
</article>

<style>
  .issue-meta {
    font-size: 0.8rem;
    color: var(--ink-mute);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }
  .issue-meta .dot {
    margin: 0 0.4rem;
    color: var(--rule);
  }
  .issue-meta .date {
    color: var(--accent);
    font-weight: 600;
  }
  .issue-meta .pool-info {
    color: var(--ink-mute);
    font-size: 0.7rem;
  }

  .lede {
    font-family: var(--serif);
    font-weight: 400;
    font-size: 2rem;
    line-height: 1.3;
    margin: 0 0 0.75rem;
    color: var(--ink);
  }
  .redact {
    background: var(--ink);
    color: var(--ink);
    padding: 0 0.4em;
    border-radius: 2px;
    user-select: none;
    letter-spacing: 0.1em;
  }
  .fy {
    background: var(--highlight);
    padding: 0 0.3em;
    border-radius: 2px;
  }
  .who {
    font-style: italic;
    color: var(--accent);
  }

  .dek {
    color: var(--ink-soft);
    font-size: 1rem;
    margin: 0 0 1.5rem;
    max-width: 60ch;
  }

  .hint {
    background: var(--bg-subtle);
    border-left: 3px solid var(--accent-soft);
    padding: 0.6rem 1rem;
    font-size: 0.88rem;
    color: var(--ink-soft);
    margin-bottom: 2rem;
  }
  .hint-label {
    color: var(--ink-mute);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-right: 0.4rem;
  }
  .hint-sep {
    margin: 0 0.6rem;
    color: var(--rule);
  }

  .statements {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin: 2rem 0;
  }
  @media (max-width: 720px) {
    .statements {
      grid-template-columns: 1fr;
    }
  }

  .funnel {
    margin: 2.5rem 0 0;
    padding-top: 1.5rem;
    border-top: 1px solid var(--rule);
  }
  .step-title {
    font-family: var(--serif);
    font-size: 1.2rem;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .step-num {
    color: var(--accent);
    margin-right: 0.4rem;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .opt {
    background: var(--bg-card);
    border: 1px solid var(--rule);
    padding: 0.55rem 0.9rem;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.92rem;
    color: var(--ink);
    transition: all 0.15s ease;
  }
  .opt:hover:not(:disabled) {
    border-color: var(--accent-soft);
    background: var(--highlight);
  }
  .opt.picked {
    background: var(--ink);
    color: var(--bg-card);
    border-color: var(--ink);
  }
  .opt:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .submit {
    margin-top: 1.5rem;
    padding: 0.75rem 1.75rem;
    background: var(--accent);
    color: var(--bg-card);
    border: 0;
    border-radius: var(--radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.02em;
  }
  .submit:hover:not(:disabled) {
    background: var(--ink);
  }
  .submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .result {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--rule);
  }
  .result-card {
    background: var(--bg-card);
    border: 1px solid var(--rule);
    padding: 1.25rem 1.5rem;
    border-radius: var(--radius);
    margin-bottom: 1.5rem;
  }
  .result-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.4rem 0;
  }
  .result-label {
    color: var(--ink-mute);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 60px;
  }
  .result-pick {
    flex: 1;
    color: var(--ink);
  }
  .badge {
    font-size: 0.78rem;
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
    background: var(--bg-subtle);
    color: var(--ink-mute);
    letter-spacing: 0.04em;
  }
  .badge.correct {
    background: #e6f1e9;
    color: var(--positive);
  }
  .badge.partial {
    background: var(--highlight);
    color: var(--accent);
  }
  .score-row {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0.85rem 0 0;
    padding-top: 0.85rem;
    border-top: 1px dashed var(--rule);
  }
  .score-label {
    color: var(--ink-mute);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .score-value {
    font-family: var(--serif);
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--accent);
  }
  .score-max {
    color: var(--ink-mute);
    font-size: 0.9rem;
  }
  .reset {
    margin-top: 0.85rem;
    background: transparent;
    border: 1px solid var(--rule);
    padding: 0.4rem 0.85rem;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.82rem;
    color: var(--ink-soft);
  }
  .reset:hover {
    background: var(--bg-subtle);
  }
</style>
