export function formatRands(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}R${formatted}`;
}

export function formatRandsShort(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    return `${sign}R${(abs / 1000).toLocaleString('en-ZA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}k`;
  }
  return `${sign}R${abs.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().split('T')[0];
}

export function daysUntil(targetISO: string, fromISO: string): number {
  const a = new Date(fromISO + 'T00:00:00').getTime();
  const b = new Date(targetISO + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}
