import type { LibraryEntry, ReadingLog, ReadingLogKind } from '@/types';

export interface DayActivity {
  entry: LibraryEntry;
  kind: ReadingLogKind;
  pages: number;
}

const KIND_PRIORITY: Record<ReadingLogKind, number> = { focus: 0, progress: 1, add: 2, complete: 3 };

/** Activities per day (`YYYY-MM-DD`) for one month, one row per book (the most notable kind wins). */
export function activitiesByDay(
  logs: ReadingLog[],
  entries: Record<string, LibraryEntry>,
  year: number,
  month: number,
  onlyComplete: boolean,
): Map<string, DayActivity[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const days = new Map<string, Map<string, DayActivity>>();
  for (const log of logs) {
    if (!log.date.startsWith(prefix)) continue;
    if (onlyComplete && log.kind !== 'complete') continue;
    const entry = entries[log.entryId];
    if (!entry) continue;
    const day = days.get(log.date) ?? new Map<string, DayActivity>();
    const prev = day.get(entry.id);
    day.set(entry.id, {
      entry,
      kind: prev && KIND_PRIORITY[prev.kind] > KIND_PRIORITY[log.kind] ? prev.kind : log.kind,
      pages: (prev?.pages ?? 0) + log.pagesDelta,
    });
    days.set(log.date, day);
  }
  return new Map([...days].map(([date, m]) => [date, [...m.values()]]));
}

export interface MonthTotals {
  books: number;
  pages: number;
}

/** Finished books (unique) and pages read per month (index 0 = January). */
export function monthlyTotals(logs: ReadingLog[], year: number): MonthTotals[] {
  const months = Array.from({ length: 12 }, () => ({ books: new Set<string>(), pages: 0 }));
  for (const log of logs) {
    if (!log.date.startsWith(`${year}-`)) continue;
    const m = Number(log.date.slice(5, 7)) - 1;
    if (log.kind === 'complete') months[m].books.add(log.entryId);
    months[m].pages += log.pagesDelta;
  }
  return months.map((m) => ({ books: m.books.size, pages: m.pages }));
}

export function readingDaysInMonth(logs: ReadingLog[], year: number, month: number): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return new Set(logs.filter((l) => l.date.startsWith(prefix)).map((l) => l.date)).size;
}

/** Focused (timer) minutes on one day. */
export function focusMinutesOn(logs: ReadingLog[], day: string) {
  return logs.reduce((sum, l) => (l.date === day && l.kind === 'focus' ? sum + (l.minutes ?? 0) : sum), 0);
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
