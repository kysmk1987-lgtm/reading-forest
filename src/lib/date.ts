/** Today as `YYYY-MM-DD` in local time. */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string | undefined): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `2026-10-06` → `2026. 10. 06` */
export function formatDisplayDate(iso: string | undefined): string {
  if (!iso) return '';
  return iso.replaceAll('-', '. ');
}

export function formatTimestamp(ms: number): string {
  return formatDisplayDate(toISODate(new Date(ms)));
}
