<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  let { children } = $props();
</script>

<div class="page">
  <header class="masthead">
    <a class="brand" href="{base}/">
      <span class="brand-mark">ImNotApe</span>
      <span class="brand-tag">재무제표로 회사 추리하기</span>
    </a>
  </header>
  <main>
    {@render children()}
  </main>
  <footer class="colophon">
    <span>S&amp;P 500 · 랜덤 챌린지 · MVP</span>
  </footer>
</div>

<style>
  .page {
    max-width: var(--max-w);
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }

  .masthead {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 1rem;
    margin-bottom: 2rem;
  }

  .brand {
    display: inline-flex;
    align-items: baseline;
    gap: 0.75rem;
    text-decoration: none;
    color: inherit;
  }

  .brand-mark {
    font-family: var(--serif);
    font-style: italic;
    font-weight: 600;
    font-size: 1.45rem;
    color: var(--ink);
    letter-spacing: -0.02em;
  }

  .brand-tag {
    font-size: 0.85rem;
    color: var(--ink-mute);
    letter-spacing: 0.01em;
  }

  main {
    min-height: 60vh;
  }

  .colophon {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
    font-size: 0.78rem;
    color: var(--ink-mute);
    text-align: center;
    letter-spacing: 0.04em;
  }
</style>
