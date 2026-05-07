export function fmtMoney(n: number, currency = 'USD'): string {
  if (n === 0) return '—';
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

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}
