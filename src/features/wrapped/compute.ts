import type { LibraryEntry, ReadingLog } from '@/types';

export type WrappedPeriod = { kind: 'month'; year: number; month: number } | { kind: 'year'; year: number };

export interface WrappedSession {
  endedAt: number;
  minutes: number;
  sounds: string[];
  room: string | null;
}

export interface WrappedInput {
  entries: LibraryEntry[];
  logs: ReadingLog[];
  sessions: WrappedSession[];
  cards: { createdAt: number }[];
}

export type TimeBucket = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface WrappedBook {
  title: string;
  author?: string;
  cover?: string;
  rating?: number;
}

export interface WrappedStats {
  period: WrappedPeriod;
  booksFinished: number;
  finishedBooks: WrappedBook[];
  pages: number;
  focusMinutes: number;
  sessions: number;
  treesPlanted: number;
  readingDays: number;
  longestStreak: number;
  topHour: number | null;
  topBucket: TimeBucket | null;
  favoriteSound: string | null;
  favoriteRoom: string | null;
  topCategory: string | null;
  topAuthor: string | null;
  bestBook: WrappedBook | null;
  quoteCards: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function localISO(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function periodPrefix(p: WrappedPeriod) {
  return p.kind === 'year' ? `${p.year}-` : `${p.year}-${pad(p.month)}-`;
}

export function inPeriod(iso: string | undefined, p: WrappedPeriod) {
  return !!iso && iso.startsWith(periodPrefix(p));
}

export function bucketOf(hour: number): TimeBucket {
  if (hour < 5) return 'dawn';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

/** Longest run of consecutive calendar days in a set of ISO dates. */
export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const iso of sorted) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d) / 86_400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function topKey(weights: Map<string, number>): string | null {
  let best: string | null = null;
  let max = 0;
  for (const [k, w] of weights) {
    if (w > max) {
      max = w;
      best = k;
    }
  }
  return best;
}

function bump(map: Map<string, number>, key: string | null | undefined, w = 1) {
  if (key) map.set(key, (map.get(key) ?? 0) + w);
}

/** `국내도서>소설/시/희곡>한국소설` → `소설/시/희곡`. */
export function categoryLabel(category: string | undefined): string | null {
  if (!category) return null;
  const parts = category.split('>').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 1 ? parts[1] : parts[0];
}

const toBook = (e: LibraryEntry): WrappedBook => ({ title: e.book.title, author: e.book.authors[0], cover: e.book.coverUrl, rating: e.rating });

export function computeWrapped(input: WrappedInput, period: WrappedPeriod): WrappedStats {
  const logs = input.logs.filter((l) => inPeriod(l.date, period));
  const sessions = input.sessions.filter((s) => inPeriod(localISO(s.endedAt), period));
  const finished = input.entries
    .filter((e) => e.status === 'read' && inPeriod(e.endDate, period))
    .sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''));

  const pages = logs.reduce((sum, l) => sum + Math.max(0, l.pagesDelta || 0), 0);
  const sessionMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const logMinutes = logs.filter((l) => l.kind === 'focus').reduce((sum, l) => sum + (l.minutes ?? 0), 0);
  const focusMinutes = Math.max(sessionMinutes, logMinutes);

  const days = new Set<string>([...logs.map((l) => l.date), ...sessions.map((s) => localISO(s.endedAt))]);

  const hours = new Map<string, number>();
  sessions.forEach((s) => bump(hours, String(new Date(s.endedAt - s.minutes * 30_000).getHours()), Math.max(1, s.minutes)));
  logs.filter((l) => l.kind === 'progress' || l.kind === 'complete').forEach((l) => bump(hours, String(new Date(l.createdAt).getHours()), 10));
  const topHourKey = topKey(hours);
  const topHour = topHourKey === null ? null : Number(topHourKey);

  const sounds = new Map<string, number>();
  const rooms = new Map<string, number>();
  if (sessions.length) {
    sessions.forEach((s) => {
      s.sounds.forEach((id) => bump(sounds, id, Math.max(1, s.minutes)));
      bump(rooms, s.room, Math.max(1, s.minutes));
    });
  } else {
    logs.forEach((l) => {
      l.sounds?.forEach((id) => bump(sounds, id, Math.max(1, l.minutes ?? 1)));
      bump(rooms, l.room, Math.max(1, l.minutes ?? 1));
    });
  }

  const touched = input.entries.filter((e) => e.status !== 'want' && (inPeriod(e.endDate, period) || inPeriod(e.startDate, period) || logs.some((l) => l.entryId === e.id)));
  const categories = new Map<string, number>();
  const authors = new Map<string, number>();
  touched.forEach((e) => {
    bump(categories, categoryLabel(e.book.category));
    bump(authors, e.book.authors[0]);
  });
  const topAuthor = topKey(authors);

  const rated = finished.filter((e) => (e.rating ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.endDate ?? '').localeCompare(a.endDate ?? ''));

  return {
    period,
    booksFinished: finished.length,
    finishedBooks: finished.map(toBook),
    pages,
    focusMinutes,
    sessions: sessions.length || logs.filter((l) => l.kind === 'focus').length,
    treesPlanted: input.entries.filter((e) => inPeriod(localISO(e.createdAt), period)).length,
    readingDays: days.size,
    longestStreak: longestStreak(days),
    topHour,
    topBucket: topHour === null ? null : bucketOf(topHour),
    favoriteSound: topKey(sounds),
    favoriteRoom: topKey(rooms),
    topCategory: topKey(categories),
    topAuthor: topAuthor && (authors.get(topAuthor) ?? 0) >= 2 ? topAuthor : null,
    bestBook: rated[0] ? toBook(rated[0]) : null,
    quoteCards: input.cards.filter((c) => inPeriod(localISO(c.createdAt), period)).length,
  };
}

export function isEmptyWrapped(s: WrappedStats) {
  return s.booksFinished === 0 && s.pages === 0 && s.focusMinutes === 0 && s.treesPlanted === 0 && s.readingDays === 0 && s.quoteCards === 0;
}

/** Month-end (25th+) or December → show the home banner for the current period. */
export function wrappedBannerPeriod(now: Date): WrappedPeriod | null {
  if (now.getMonth() === 11) return { kind: 'year', year: now.getFullYear() };
  if (now.getDate() >= 25) return { kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
  return null;
}
