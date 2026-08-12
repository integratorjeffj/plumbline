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
