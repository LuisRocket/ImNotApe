<script lang="ts">
  interface Row {
    label: string;
    values: string[]; // 연도별 값. years 길이와 일치
    aux?: (string | undefined)[]; // 연도별 보조값 (예: %)
    emphasis?: boolean;
  }
  let {
    title,
    subtitle,
    years,
    rows
  }: { title: string; subtitle: string; years: string[]; rows: Row[] } = $props();
</script>

<div class="card">
  <div class="head">
    <h3>{title}</h3>
    <span class="sub">{subtitle}</span>
  </div>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th class="label-h"></th>
          {#each years as y}
            <th class="year">{y.replace(/^FY/, "'")}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as r}
          <tr class:emph={r.emphasis}>
            <td class="label">{r.label}</td>
            {#each r.values as v, i}
              <td class="value num">
                {v}
                {#if r.aux && r.aux[i]}
                  <span class="aux">{r.aux[i]}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .card {
    background: var(--bg-card);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .head {
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--rule);
    background: var(--bg-subtle);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .head h3 {
    margin: 0;
    font-family: var(--serif);
    font-size: 1rem;
    font-weight: 600;
  }
  .sub {
    font-size: 0.72rem;
    color: var(--ink-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.84rem;
  }
  thead th {
    padding: 0.5rem 0.85rem;
    border-bottom: 1px solid var(--rule);
    background: var(--bg-subtle);
    color: var(--ink-mute);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  thead th.year {
    text-align: right;
  }
  td {
    padding: 0.4rem 0.85rem;
    border-bottom: 1px solid var(--rule);
    white-space: nowrap;
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .label,
  .label-h {
    color: var(--ink-soft);
    text-align: left;
  }
  .label {
    min-width: 9.5rem;
  }
  .value {
    text-align: right;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .aux {
    color: var(--ink-mute);
    font-size: 0.76rem;
    margin-left: 0.35rem;
  }
  tr.emph .label,
  tr.emph .value {
    font-weight: 600;
    color: var(--ink);
  }
  tr.emph {
    background: rgba(245, 233, 208, 0.25);
  }
</style>
