export function fmtMoney(n: number | null | undefined, currency = 'USD'): string {
  if (n === null || n === undefined || n === 0) return '—';
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = `${(n / 1_000_000_000).toFixed(2)}B`;
  } else if (abs >= 1_000_000) {
    formatted = `${(n / 1_000_000).toFixed(1)}M`;
  } else {
    formatted = n.toLocaleString();
  }
  return currency === 'USD' ? `$${formatted.replace('-', '–')}` : formatted;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
