export function money(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function signedMoney(value: number, decimals = 0): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${money(Math.abs(value), decimals)}`;
}

/**
 * Abbreviated currency for axis ticks, where a full "$200,000" would collide
 * with its neighbours. Never used for a figure a reader might act on: those
 * stay exact.
 */
export function moneyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

export function percent(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th';
  return `${n}${suffix}`;
}

export function shortHash(hash: string, chars = 12): string {
  return `${hash.slice(0, chars)}…`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
