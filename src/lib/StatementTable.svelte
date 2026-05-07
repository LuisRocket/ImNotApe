<script lang="ts">
  interface Row {
    label: string;
    value: string;
    aux?: string;
    emphasis?: boolean;
  }
  let {
    title,
    subtitle,
    rows
  }: { title: string; subtitle: string; rows: Row[] } = $props();
</script>

<div class="card">
  <div class="head">
    <h3>{title}</h3>
    <span class="sub">{subtitle}</span>
  </div>
  <table>
    <tbody>
      {#each rows as r}
        <tr class:emph={r.emphasis}>
          <td class="label">{r.label}</td>
          <td class="value num">
            {r.value}
            {#if r.aux}
              <span class="aux">{r.aux}</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
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
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
  }
  td {
    padding: 0.4rem 1rem;
    border-bottom: 1px solid var(--rule);
  }
  tr:last-child td {
    border-bottom: 0;
  }
  .label {
    color: var(--ink-soft);
    width: 60%;
  }
  .value {
    text-align: right;
    color: var(--ink);
  }
  .aux {
    color: var(--ink-mute);
    font-size: 0.8rem;
    margin-left: 0.5rem;
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
