<script lang="ts">
  import { onMount } from 'svelte';
  import { fmtMoney, fmtPct, fmtNum } from '$lib/format';
  import StatementTable from '$lib/StatementTable.svelte';
  import MultiYearTable from '$lib/MultiYearTable.svelte';
  import Narrative from '$lib/Narrative.svelte';

  let { data } = $props();

  // 방문 시마다 랜덤 1개. 0번이 prerender HTML에 박히는 걸 막으려고 onMount에서 다시 뽑는다.
  let selectedIdx = $state(0);
  let pickedIndustry = $state<string | null>(null);
  let pickedCompany = $state<string | null>(null);
  let revealed = $state(false);

  function randomIdx(exclude: number | null = null): number {
    if (data.pool.length <= 1) return 0;
    let next: number;
    do {
      next = Math.floor(Math.random() * data.pool.length);
    } while (next === exclude);
    return next;
  }

  onMount(() => {
    selectedIdx = randomIdx();
  });

  let selected = $derived(data.pool[selectedIdx]);
  let c = $derived(selected.data);
  let ch = $derived(c.challenge);
  let fin = $derived(ch.financials);
  let ratios = $derived(ch.derived_ratios);
  let challengeId = $derived(selected.id);

  let history = $derived(ch.financials_history ?? []);
  let multiYear = $derived(history.length >= 2);
  let years = $derived(history.map((h) => h.fiscal_year));
  let yearRangeLabel = $derived(
    multiYear ? `${years[0]}–${years[years.length - 1]}` : ch.fiscal_year
  );

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

  function nextChallenge() {
    selectedIdx = randomIdx(selectedIdx);
    pickedIndustry = null;
    pickedCompany = null;
    revealed = false;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
</script>

<article class="issue">
  <div class="issue-meta">
    <span class="date">랜덤 챌린지</span>
    <span class="dot">·</span>
    <span>{multiYear ? `${years.length}년 트렌드 · ${yearRangeLabel}` : ch.fiscal_year}</span>
    <span class="dot">·</span>
    <span class="pool-info">{data.pool.length}개 풀 #{selectedIdx + 1}</span>
    <button class="reroll" onclick={nextChallenge} aria-label="다른 문제 뽑기">↻ 다른 문제</button>
  </div>

  <h1 class="lede">
    이 회사는 <span class="redact">●●●●●</span>이고,<br />
    {#if multiYear}
      <span class="fy">{yearRangeLabel}</span>의 {years.length}년치 재무제표다.
    {:else}
      이 해는 <span class="fy">{ch.fiscal_year}</span>이다.
    {/if}
    <span class="who">누구일까?</span>
  </h1>

  <p class="dek">
    {#if multiYear}
      아래는 S&amp;P 500에 속한 한 회사의 {yearRangeLabel} {years.length}개 회계연도 재무제표다.
      회사명·세그먼트·지역 정보는 가렸다. 시간에 따른 변화를 보고 산업과 회사를 좁혀가 보자.
    {:else}
      아래 재무제표는 S&amp;P 500에 속한 한 회사의 {ch.fiscal_year} 연간 보고서에서 발췌했다.
      회사명·세그먼트·지역 정보는 가렸다. 숫자만 보고 산업과 회사를 좁혀가 보자.
    {/if}
  </p>

  <aside class="hint">
    <span class="hint-label">FY 종료</span>
    <span>{ch.fiscal_year_end_hint}</span>
    <span class="hint-sep">·</span>
    <span class="hint-label">통화</span>
    <span>{ch.reported_currency}</span>
  </aside>

  {#if multiYear}
    <section class="statements multi">
      <MultiYearTable
        title="손익계산서"
        subtitle="Income Statement"
        years={years}
        rows={[
          { label: '매출 (Revenue)', values: history.map((h) => fmtMoney(h.income_statement.revenue)), emphasis: true },
          { label: '매출원가', values: history.map((h) => fmtMoney(h.income_statement.costOfRevenue)) },
          {
            label: '매출총이익 (GP)',
            values: history.map((h) => fmtMoney(h.income_statement.grossProfit)),
            aux: history.map((h) => fmtPct(h.income_statement.grossMargin))
          },
          { label: 'R&D 비용', values: history.map((h) => fmtMoney(h.income_statement.researchAndDevelopmentExpenses)) },
          { label: '판관비 (SG&A)', values: history.map((h) => fmtMoney(h.income_statement.sellingGeneralAndAdministrativeExpenses)) },
          {
            label: '영업이익',
            values: history.map((h) => fmtMoney(h.income_statement.operatingIncome)),
            aux: history.map((h) => fmtPct(h.income_statement.operatingMargin)),
            emphasis: true
          },
          { label: '이자수익', values: history.map((h) => fmtMoney(h.income_statement.interestIncome)) },
          { label: '이자비용', values: history.map((h) => fmtMoney(h.income_statement.interestExpense)) },
          { label: '감가상각비', values: history.map((h) => fmtMoney(h.income_statement.depreciationAndAmortization)) },
          { label: 'EBITDA', values: history.map((h) => fmtMoney(h.income_statement.ebitda)) },
          {
            label: '순이익',
            values: history.map((h) => fmtMoney(h.income_statement.netIncome)),
            aux: history.map((h) => fmtPct(h.income_statement.netMargin)),
            emphasis: true
          },
          { label: '희석 EPS', values: history.map((h) => `$${fmtNum(h.income_statement.epsDiluted)}`) }
        ]}
      />

      <MultiYearTable
        title="재무상태표"
        subtitle="Balance Sheet"
        years={years}
        rows={[
          { label: '현금성자산', values: history.map((h) => fmtMoney(h.balance_sheet.cashAndCashEquivalents)) },
          { label: '단기투자자산', values: history.map((h) => fmtMoney(h.balance_sheet.shortTermInvestments)) },
          { label: '매출채권', values: history.map((h) => fmtMoney(h.balance_sheet.accountsReceivables)) },
          { label: '재고자산', values: history.map((h) => fmtMoney(h.balance_sheet.inventory)), emphasis: true },
          { label: '유동자산 합계', values: history.map((h) => fmtMoney(h.balance_sheet.totalCurrentAssets)) },
          { label: '유형자산', values: history.map((h) => fmtMoney(h.balance_sheet.propertyPlantEquipmentNet)) },
          { label: '영업권', values: history.map((h) => fmtMoney(h.balance_sheet.goodwill)) },
          { label: '자산 총계', values: history.map((h) => fmtMoney(h.balance_sheet.totalAssets)), emphasis: true },
          { label: '매입채무 (AP)', values: history.map((h) => fmtMoney(h.balance_sheet.accountPayables)) },
          { label: '단기차입금', values: history.map((h) => fmtMoney(h.balance_sheet.shortTermDebt)) },
          { label: '유동부채 합계', values: history.map((h) => fmtMoney(h.balance_sheet.totalCurrentLiabilities)) },
          { label: '장기차입금', values: history.map((h) => fmtMoney(h.balance_sheet.longTermDebt)) },
          { label: '부채 총계', values: history.map((h) => fmtMoney(h.balance_sheet.totalLiabilities)) },
          { label: '이익잉여금', values: history.map((h) => fmtMoney(h.balance_sheet.retainedEarnings)) },
          { label: '자본 총계', values: history.map((h) => fmtMoney(h.balance_sheet.totalStockholdersEquity)) },
          { label: '총부채 (Debt)', values: history.map((h) => fmtMoney(h.balance_sheet.totalDebt)) },
          { label: '순부채', values: history.map((h) => fmtMoney(h.balance_sheet.netDebt)) }
        ]}
      />

      <MultiYearTable
        title="현금흐름표"
        subtitle="Cash Flow Statement"
        years={years}
        rows={[
          { label: '순이익', values: history.map((h) => fmtMoney(h.cash_flow_statement.netIncome)) },
          { label: '감가상각', values: history.map((h) => fmtMoney(h.cash_flow_statement.depreciationAndAmortization)) },
          { label: 'SBC', values: history.map((h) => fmtMoney(h.cash_flow_statement.stockBasedCompensation)) },
          {
            label: '영업현금흐름',
            values: history.map((h) => fmtMoney(h.cash_flow_statement.operatingCashFlow)),
            emphasis: true
          },
          { label: 'CAPEX', values: history.map((h) => fmtMoney(h.cash_flow_statement.capitalExpenditure)) },
          {
            label: '잉여현금흐름 (FCF)',
            values: history.map((h) => fmtMoney(h.cash_flow_statement.freeCashFlow)),
            emphasis: true
          },
          { label: 'M&A', values: history.map((h) => fmtMoney(h.cash_flow_statement.acquisitionsNet)) },
          { label: '자사주 매입', values: history.map((h) => fmtMoney(h.cash_flow_statement.commonStockRepurchased)) },
          {
            label: '배당 지급',
            values: history.map((h) => fmtMoney(h.cash_flow_statement.commonDividendsPaid)),
            emphasis: true
          }
        ]}
      />

      <MultiYearTable
        title="파생 지표"
        subtitle="Derived Ratios"
        years={years}
        rows={[
          { label: '재고회전율', values: history.map((h) => `${fmtNum(h.derived_ratios.inventoryTurnover)}x`) },
          { label: '재고일수 (DIO)', values: history.map((h) => `${fmtNum(h.derived_ratios.daysInventoryOutstanding, 1)}일`) },
          { label: '현금전환주기 (CCC)', values: history.map((h) => `${fmtNum(h.derived_ratios.cashConversionCycleDays, 1)}일`) },
          { label: '유동비율', values: history.map((h) => fmtNum(h.derived_ratios.currentRatio)) },
          { label: 'ROE', values: history.map((h) => fmtPct(h.derived_ratios.returnOnEquity)) },
          { label: '배당성향', values: history.map((h) => fmtPct(h.derived_ratios.dividendPayoutRatio)) },
          { label: 'FCF 마진', values: history.map((h) => fmtPct(h.derived_ratios.fcfMargin)) }
        ]}
      />
    </section>
  {:else}
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
  {/if}

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
          <span class="score-label">점수</span>
          <span class="score-value num">{score.toLocaleString()}</span>
          <span class="score-max">/ 5,000</span>
        </div>
        <div class="result-actions">
          <button class="primary" onclick={nextChallenge}>다음 문제 →</button>
          <button class="reset" onclick={reset}>이 문제 다시</button>
        </div>
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
  .reroll {
    margin-left: 0.6rem;
    background: transparent;
    border: 1px solid var(--rule);
    color: var(--ink-soft);
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: none;
    cursor: pointer;
  }
  .reroll:hover {
    border-color: var(--accent-soft);
    color: var(--accent);
    background: var(--highlight);
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
  .statements.multi {
    grid-template-columns: 1fr;
    gap: 1rem;
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
  .result-actions {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin-top: 0.85rem;
    flex-wrap: wrap;
  }
  .result-actions .primary {
    padding: 0.55rem 1.25rem;
    background: var(--accent);
    color: var(--bg-card);
    border: 0;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .result-actions .primary:hover {
    background: var(--ink);
  }
  .reset {
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
