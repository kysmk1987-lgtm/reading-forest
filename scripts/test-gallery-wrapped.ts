/**
 * Offline tests for quote-card blur logic, page → % conversion, translation quota
 * and the 독서 DNA (Wrapped) aggregation + persona rules.
 * Run: npm run test:gallery
 */
import assert from 'node:assert/strict';

import { cardProgress, findEntryForCard, pageToPercent, shouldBlur, viewerProgressOf } from '../src/features/gallery/blur';
import { remainingTranslations } from '../src/features/gallery/quota';
import { activitiesByDay, markersOf } from '../src/features/records/aggregate';
import { bucketOf, categoryLabel, computeWrapped, isEmptyWrapped, longestStreak, wrappedBannerPeriod, type WrappedStats } from '../src/features/wrapped/compute';
import { koreanHour, personaTagline, pickPersona, withObjectParticle } from '../src/features/wrapped/personas';
import { sampleWrappedInput } from '../src/features/wrapped/sample';
import type { LibraryEntry, ReadingLog } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('page → %');
test('pageToPercent rounds and clamps', () => {
  assert.equal(pageToPercent(120, 392), 31);
  assert.equal(pageToPercent(0, 300), 0);
  assert.equal(pageToPercent(500, 300), 100);
  assert.equal(pageToPercent(10, undefined), null);
  assert.equal(pageToPercent(10, 0), null);
});
test('cardProgress by page needs total pages for %', () => {
  assert.deepEqual(cardProgress({ unit: 'page', page: 150, totalPages: 300 }), { percent: 50, page: 150 });
  assert.deepEqual(cardProgress({ unit: 'page', page: 150 }), { percent: null, page: 150 });
  assert.deepEqual(cardProgress({ unit: 'page' }), { percent: null, page: null });
});
test('cardProgress by percent derives page when possible', () => {
  assert.deepEqual(cardProgress({ unit: 'percent', percent: 25, totalPages: 200 }), { percent: 25, page: 50 });
  assert.deepEqual(cardProgress({ unit: 'percent', percent: 140 }), { percent: 100, page: null });
  assert.deepEqual(cardProgress({ unit: 'percent' }), { percent: null, page: null });
});

console.log('smart blur');
const base = { mine: false, revealed: false, cardProgress: 60, blurUnowned: false };
test('blurs when the viewer is behind the card', () => {
  assert.equal(shouldBlur({ ...base, viewerProgress: 30 }), true);
  assert.equal(shouldBlur({ ...base, viewerProgress: 60 }), false);
  assert.equal(shouldBlur({ ...base, viewerProgress: 90 }), false);
});
test('own and revealed cards are never blurred', () => {
  assert.equal(shouldBlur({ ...base, mine: true, viewerProgress: 0 }), false);
  assert.equal(shouldBlur({ ...base, revealed: true, viewerProgress: 0 }), false);
});
test('unowned books follow the setting (default off)', () => {
  assert.equal(shouldBlur({ ...base, viewerProgress: null }), false);
  assert.equal(shouldBlur({ ...base, viewerProgress: null, blurUnowned: true }), true);
});

const entry = (over: Partial<LibraryEntry> & { pages?: number }): LibraryEntry =>
  ({
    id: 'e1',
    book: { id: 'kr_9788936434120', source: 'kakao', title: '소년이 온다', authors: ['한강'], isbn13: '9788936434120', pageCount: over.pages ?? 200 },
    status: 'reading',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as LibraryEntry;

test('viewer progress mirrors the SQL mapping', () => {
  assert.equal(viewerProgressOf(undefined), null);
  assert.equal(viewerProgressOf(entry({ status: 'read' })), 100);
  assert.equal(viewerProgressOf(entry({ currentPage: 50 })), 25);
  assert.equal(viewerProgressOf(entry({ progressUnit: 'percent', currentPercent: 70 })), 70);
});
test('findEntryForCard matches ISBN first, then book id', () => {
  const entries = { e1: entry({}) };
  assert.equal(findEntryForCard(entries, { isbn13: '9788936434120', book_id: null })?.id, 'e1');
  assert.equal(findEntryForCard(entries, { isbn13: null, book_id: 'kr_9788936434120' })?.id, 'e1');
  assert.equal(findEntryForCard(entries, { isbn13: '9790000000000', book_id: 'x' }), undefined);
});

console.log('translation quota');
test('10 per day for free users, resets daily, unlimited for premium', () => {
  assert.equal(remainingTranslations('', 0, '2026-10-06', false, 10), 10);
  assert.equal(remainingTranslations('2026-10-06', 4, '2026-10-06', false, 10), 6);
  assert.equal(remainingTranslations('2026-10-06', 12, '2026-10-06', false, 10), 0);
  assert.equal(remainingTranslations('2026-10-05', 10, '2026-10-06', false, 10), 10);
  assert.equal(remainingTranslations('2026-10-06', 99, '2026-10-06', true, 10), Infinity);
});

console.log('wrapped aggregation');
test('helpers', () => {
  assert.equal(longestStreak(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-03']), 3);
  assert.equal(longestStreak([]), 0);
  assert.equal(bucketOf(2), 'dawn');
  assert.equal(bucketOf(9), 'morning');
  assert.equal(bucketOf(23), 'night');
  assert.equal(categoryLabel('국내도서>소설/시/희곡>한국소설'), '소설/시/희곡');
  assert.equal(categoryLabel(undefined), null);
  assert.equal(wrappedBannerPeriod(new Date(2026, 11, 3))?.kind, 'year');
  assert.equal(wrappedBannerPeriod(new Date(2026, 9, 26))?.kind, 'month');
  assert.equal(wrappedBannerPeriod(new Date(2026, 9, 6)), null);
});

const log = (date: string, pages: number, over: Partial<ReadingLog> = {}): ReadingLog => ({
  id: `l_${date}_${pages}`,
  entryId: 'e1',
  bookId: 'b',
  date,
  kind: 'progress',
  pagesDelta: pages,
  createdAt: new Date(`${date}T14:00:00`).getTime(),
  ...over,
});

test('computeWrapped counts only the chosen month', () => {
  const s = computeWrapped(
    {
      entries: [entry({ status: 'read', endDate: '2026-10-12', rating: 5, createdAt: new Date(2026, 9, 2).getTime() })],
      logs: [log('2026-10-01', 30), log('2026-10-02', 20), log('2026-09-30', 99)],
      sessions: [
        { endedAt: new Date(2026, 9, 3, 2, 30).getTime(), minutes: 40, sounds: ['rain'], room: 'rainy-bookstore' },
        { endedAt: new Date(2026, 8, 3, 2, 30).getTime(), minutes: 99, sounds: ['cafe'], room: null },
      ],
      cards: [{ createdAt: new Date(2026, 9, 5).getTime() }, { createdAt: new Date(2025, 9, 5).getTime() }],
    },
    { kind: 'month', year: 2026, month: 10 },
  );
  assert.equal(s.booksFinished, 1);
  assert.equal(s.pages, 50);
  assert.equal(s.focusMinutes, 40);
  assert.equal(s.treesPlanted, 1);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.favoriteSound, 'rain');
  assert.equal(s.favoriteRoom, 'rainy-bookstore');
  assert.equal(s.topHour, 2);
  assert.equal(s.bestBook?.title, '소년이 온다');
  assert.equal(s.quoteCards, 1);
  assert.equal(isEmptyWrapped(s), false);
});
test('empty period is detected', () => {
  const s = computeWrapped({ entries: [], logs: [], sessions: [], cards: [] }, { kind: 'year', year: 2026 });
  assert.equal(isEmptyWrapped(s), true);
  assert.equal(pickPersona(s).id, 'seedling');
});

console.log('personas');
const stats = (over: Partial<WrappedStats>): WrappedStats => ({
  period: { kind: 'month', year: 2026, month: 10 },
  booksFinished: 0,
  finishedBooks: [],
  pages: 0,
  focusMinutes: 0,
  sessions: 0,
  treesPlanted: 0,
  readingDays: 0,
  longestStreak: 0,
  topHour: null,
  topBucket: null,
  favoriteSound: null,
  favoriteRoom: null,
  topCategory: null,
  topAuthor: null,
  bestBook: null,
  quoteCards: 0,
  ...over,
});
test('rules pick the expected persona', () => {
  assert.equal(pickPersona(stats({ topHour: 2, topBucket: 'dawn', booksFinished: 9 })).id, 'nightThinker');
  assert.equal(pickPersona(stats({ topHour: 23, topBucket: 'night' })).id, 'nightThinker');
  assert.equal(pickPersona(stats({ topHour: 6, topBucket: 'morning' })).id, 'dawnWalker');
  assert.equal(pickPersona(stats({ topHour: 14, topBucket: 'afternoon', booksFinished: 4 })).id, 'marathoner');
  assert.equal(pickPersona(stats({ topHour: 14, topBucket: 'afternoon', focusMinutes: 700 })).id, 'deepDiver');
  assert.equal(pickPersona(stats({ topHour: 14, topBucket: 'afternoon', quoteCards: 3 })).id, 'quoteCollector');
  assert.equal(pickPersona(stats({ topHour: 14, topBucket: 'afternoon', longestStreak: 8 })).id, 'steadyGardener');
  assert.equal(pickPersona(stats({ topHour: 14, topBucket: 'afternoon' })).id, 'sunnyWanderer');
  assert.equal(pickPersona(stats({})).id, 'seedling');
});
test('yearly thresholds are scaled', () => {
  const year = { period: { kind: 'year', year: 2026 } as const, topHour: 14, topBucket: 'afternoon' as const };
  assert.equal(pickPersona(stats({ ...year, booksFinished: 4 })).id, 'sunnyWanderer');
  assert.equal(pickPersona(stats({ ...year, booksFinished: 32 })).id, 'marathoner');
});
test('Korean tagline with correct particles', () => {
  assert.equal(koreanHour(2), '새벽 2시');
  assert.equal(koreanHour(15), '오후 3시');
  assert.equal(koreanHour(23), '밤 11시');
  assert.equal(withObjectParticle('빗소리'), '빗소리를');
  assert.equal(withObjectParticle('도서관'), '도서관을');
  assert.equal(personaTagline({ name: '심야의 사색가', hour: 2, sound: '빗소리' }), "새벽 2시에 빗소리를 들으며 읽는 '심야의 사색가'");
  assert.equal(personaTagline({ name: '새싹 탐험가', hour: null, sound: null }), "천천히 자라는 '새싹 탐험가'");
});
test('sample report is a night thinker with ~42 trees a year', () => {
  const s = computeWrapped(sampleWrappedInput({ kind: 'year', year: 2026 }), { kind: 'year', year: 2026 });
  assert.equal(pickPersona(s).id, 'nightThinker');
  assert.equal(s.favoriteSound, 'rain');
  assert.ok(s.treesPlanted >= 30 && s.treesPlanted <= 55, `trees ${s.treesPlanted}`);
  assert.ok(s.booksFinished > 5 && s.pages > 1000);
  const m = computeWrapped(sampleWrappedInput({ kind: 'month', year: 2026, month: 10 }), { kind: 'month', year: 2026, month: 10 });
  assert.equal(isEmptyWrapped(m), false);
});

console.log('calendar markers');
const calLog = (over: Partial<ReadingLog>): ReadingLog =>
  ({ id: Math.random().toString(36), entryId: 'e1', bookId: 'b', date: '2026-10-07', kind: 'progress', pagesDelta: 0, createdAt: 0, ...over }) as ReadingLog;
test('all mode shows start and finish days (no wishlist days); complete mode only finish days', () => {
  const entries = {
    a: entry({ id: 'a', status: 'reading', startDate: '2026-10-03' }),
    w: entry({ id: 'w', status: 'want', createdAt: new Date(2026, 9, 5, 12).getTime() }),
    r: entry({ id: 'r', status: 'read', startDate: '2026-10-01', endDate: '2026-10-07' }),
  };
  const logs = [
    calLog({ entryId: 'a', kind: 'add', date: '2026-10-07', pagesDelta: 2 }),
    calLog({ entryId: 'r', kind: 'complete', date: '2026-10-07', pagesDelta: 300 }),
  ];
  const all = activitiesByDay(logs, entries, 2026, 10, false);
  assert.deepEqual(markersOf(all.get('2026-10-03') ?? []), ['add']);
  assert.equal(all.has('2026-10-05'), false);
  assert.deepEqual([...all.keys()].sort(), ['2026-10-01', '2026-10-03', '2026-10-07']);
  assert.ok([...all.values()].flat().every((x) => x.entry.id !== 'w'));
  assert.deepEqual(markersOf(all.get('2026-10-01') ?? []), ['add']);
  const oct7 = all.get('2026-10-07') ?? [];
  assert.deepEqual(markersOf(oct7), ['complete']);
  assert.equal(oct7[0].entry.id, 'r');
  assert.equal(oct7.find((x) => x.entry.id === 'a')?.kind, 'progress');
  const done = activitiesByDay(logs, entries, 2026, 10, true);
  assert.deepEqual([...done.keys()], ['2026-10-07']);
  assert.deepEqual(done.get('2026-10-07')?.map((x) => x.entry.id), ['r']);
});
test('finish day follows an edited end date', () => {
  const entries = { r: entry({ id: 'r', status: 'read', endDate: '2026-11-02' }) };
  const logs = [calLog({ entryId: 'r', kind: 'complete', date: '2026-10-07' })];
  assert.equal(activitiesByDay(logs, entries, 2026, 10, true).size, 0);
  assert.deepEqual(markersOf(activitiesByDay(logs, entries, 2026, 11, true).get('2026-11-02') ?? []), ['complete']);
});

console.log(`\n${passed} tests passed`);
