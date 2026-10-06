import { toISODate, todayISO } from '@/lib/date';
import type { LibraryEntry, ReadingLog } from '@/types';

import { currentPageOf } from './growth';

export type ReadingLogDraft = Omit<ReadingLog, 'id' | 'createdAt'>;

function pagesOf(entry: LibraryEntry | undefined) {
  if (!entry || entry.status === 'want') return 0;
  return currentPageOf(entry) ?? 0;
}

/**
 * Reading activities implied by a library change. Adding a "want" book is not reading activity;
 * page corrections downwards are ignored so statistics never go negative.
 */
export function logsForChange(before: LibraryEntry | undefined, after: LibraryEntry, today = todayISO()): ReadingLogDraft[] {
  const base = { entryId: after.id, bookId: after.book.id };
  if (!before) {
    if (after.status === 'want') return [];
    if (after.status === 'read') return [{ ...base, kind: 'complete', date: after.endDate ?? today, pagesDelta: pagesOf(after) }];
    return [{ ...base, kind: 'add', date: today, pagesDelta: pagesOf(after) }];
  }
  const delta = Math.max(0, pagesOf(after) - pagesOf(before));
  if (after.status === 'read' && before.status !== 'read') {
    return [{ ...base, kind: 'complete', date: after.endDate ?? today, pagesDelta: delta }];
  }
  if (before.status === 'want' && after.status !== 'want') return [{ ...base, kind: 'add', date: today, pagesDelta: delta }];
  if (delta > 0) return [{ ...base, kind: 'progress', date: today, pagesDelta: delta }];
  return [];
}

/** Rebuilds a plausible history for data saved before reading logs existed. */
export function backfillLogs(entries: LibraryEntry[]): ReadingLogDraft[] {
  return entries.flatMap((e): ReadingLogDraft[] => {
    const base = { entryId: e.id, bookId: e.book.id, pagesDelta: pagesOf(e) };
    const created = toISODate(new Date(e.createdAt));
    if (e.status === 'read') return [{ ...base, kind: 'complete', date: e.endDate ?? created }];
    if (e.status === 'reading' || e.status === 'stopped') return [{ ...base, kind: 'add', date: e.startDate ?? created }];
    return [];
  });
}
