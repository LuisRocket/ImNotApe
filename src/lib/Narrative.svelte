<script lang="ts">
  let { markdown }: { markdown: string } = $props();

  // 가벼운 markdown 렌더링 — 외부 의존성 없이 # / ** / - 만 처리
  function render(md: string): string {
    const lines = md.split('\n');
    const out: string[] = [];
    let inList = false;
    for (const line of lines) {
      if (line.startsWith('# ')) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(`<h2 class="n-h1">${esc(line.slice(2))}</h2>`);
      } else if (line.startsWith('## ')) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(`<h3 class="n-h2">${esc(line.slice(3))}</h3>`);
      } else if (line.startsWith('- ')) {
        if (!inList) {
          out.push('<ul class="n-list">');
          inList = true;
        }
        out.push(`<li>${inline(line.slice(2))}</li>`);
      } else if (line.trim() === '') {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
      } else {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s: string): string {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  let html = $derived(render(markdown));
</script>

<div class="narrative">
  {@html html}
</div>

<style>
  .narrative {
    background: var(--bg-card);
    border-left: 3px solid var(--accent);
    padding: 1.5rem 1.75rem;
    border-radius: 0 var(--radius) var(--radius) 0;
    color: var(--ink-soft);
  }
  .narrative :global(.n-h1) {
    font-family: var(--serif);
    font-size: 1.3rem;
    color: var(--ink);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--rule);
  }
  .narrative :global(.n-h2) {
    font-family: var(--serif);
    font-size: 1.05rem;
    color: var(--accent);
    margin: 1.25rem 0 0.4rem;
    font-weight: 600;
  }
  .narrative :global(p) {
    margin: 0.6rem 0;
    line-height: 1.75;
  }
  .narrative :global(.n-list) {
    margin: 0.4rem 0 0.8rem;
    padding-left: 1.2rem;
  }
  .narrative :global(.n-list li) {
    margin: 0.25rem 0;
  }
  .narrative :global(strong) {
    color: var(--ink);
    font-weight: 600;
  }
  .narrative :global(em) {
    font-style: italic;
    color: var(--accent);
  }
</style>
