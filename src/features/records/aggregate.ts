import type { LibraryEntry, ReadingLog, ReadingLogKind } from '@/types';

export interface DayActivity {
  entry: LibraryEntry;
  /** The most notable kind for this book on this day. */
  kind: ReadingLogKind;
  /** Every kind for this book on this day, most notable first. */
  kinds: ReadingLogKind[];
  pages: number;
}

const KIND_PRIORITY: Record<ReadingLogKind, number> = { focus: 0, progress: 1, add: 2, complete: 3 };
const byPriority = (a: ReadingLogKind, b: ReadingLogKind) => KIND_PRIORITY[b] - KIND_PRIORITY[a];

/** Kinds shown as small markers on calendar days (읽기 시작 · 완독). */
export const MARKER_KINDS = ['add', 'complete'] as const satisfies readonly ReadingLogKind[];
export type MarkerKind = (typeof MARKER_KINDS)[number];

/**
 * Activities per day (`YYYY-MM-DD`) for one month, one row per book.
 * Start days come from `startDate`, finish days from `endDate` (falling back to the log date).
 * Wishlist (`want`) books are not shown. `onlyComplete` keeps finish days only.
 */
export function activitiesByDay(
  logs: ReadingLog[],
  entries: Record<string, LibraryEntry>,
  year: number,
  month: number,
  onlyComplete: boolean,
): Map<string, DayActivity[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const days = new Map<string, Map<string, DayActivity>>();
  const add = (date: string, entry: LibraryEntry, kind: ReadingLogKind, pages: number) => {
    if (!date.startsWith(prefix) || (onlyComplete && kind !== 'complete')) return;
    const day = days.get(date) ?? new Map<string, DayActivity>();
    const prev = day.get(entry.id);
    const kinds = prev ? (prev.kinds.includes(kind) ? prev.kinds : [...prev.kinds, kind].sort(byPriority)) : [kind];
    day.set(entry.id, { entry, kind: kinds[0], kinds, pages: (prev?.pages ?? 0) + pages });
    days.set(date, day);
  };

  const completed = new Set<string>();
  for (const log of logs) {
    const entry = entries[log.entryId];
    if (!entry) continue;
    if (log.kind === 'complete') {
      completed.add(entry.id);
      add(entry.status === 'read' && entry.endDate ? entry.endDate : log.date, entry, 'complete', log.pagesDelta);
    } else if (log.kind === 'add' && entry.startDate && entry.status !== 'want' && log.date !== entry.startDate) {
      // Added on a different day than the chosen start date: the start marker goes on `startDate` below.
      if (log.pagesDelta > 0) add(log.date, entry, 'progress', log.pagesDelta);
    } else {
      add(log.date, entry, log.kind, log.pagesDelta);
    }
  }
  for (const entry of Object.values(entries)) {
    if (entry.status === 'want') continue;
    if (entry.startDate) add(entry.startDate, entry, 'add', 0);
    if (entry.status === 'read' && entry.endDate && !completed.has(entry.id)) add(entry.endDate, entry, 'complete', 0);
  }
  return new Map(
    [...days].map(([date, m]) => [date, [...m.values()].sort((a, b) => byPriority(a.kind, b.kind))]),
  );
}

/** Distinct marker kinds on one day, in `MARKER_KINDS` order. */
export function markersOf(items: DayActivity[]): MarkerKind[] {
  return MARKER_KINDS.filter((k) => items.some((a) => a.kinds.includes(k)));
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
