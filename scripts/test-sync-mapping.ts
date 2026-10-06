/**
 * Offline tests for the local ⇄ Supabase row mapping (no network, no Supabase client).
 * Run: npm run test:sync
 */
import assert from 'node:assert/strict';

import {
  bookToRow,
  entryToRow,
  logToRow,
  planUpload,
  rowToEntry,
  rowToLog,
} from '../src/features/library/syncMapping';
import type { LibraryEntry, ReadingLog } from '../src/types';

const USER = '00000000-0000-4000-8000-000000000001';

const entry: LibraryEntry = {
  id: 'lx1abc',
  book: {
    id: 'kr_9788936434120',
    source: 'kakao',
    title: '소년이 온다',
    authors: ['한강'],
    publisher: '창비',
    pageCount: 216,
    isbn13: '9788936434120',
    coverUrl: 'https://example.com/c.jpg',
  },
  status: 'reading',
  createdAt: Date.UTC(2026, 9, 1, 3),
  updatedAt: Date.UTC(2026, 9, 6, 3),
  startDate: '2026-10-01',
  progressUnit: 'page',
  currentPage: 120,
  rating: 4.5,
  treeSpecies: 'pine',
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

test('entry → row → entry round-trips', () => {
  const row = entryToRow(entry, USER);
  assert.equal(row.user_id, USER);
  assert.equal(row.isbn13, '9788936434120');
  assert.equal(row.total_pages, 216);
  assert.equal(row.current_page, 120);
  assert.equal(row.tree_species, 'pine');
  assert.equal(row.end_date, null);
  assert.equal(row.created_at, '2026-10-01T03:00:00.000Z');
  assert.deepEqual(rowToEntry(row), entry);
});

test('numeric strings and unknown species from the database are normalised', () => {
  const row = { ...entryToRow(entry, USER), rating: '4.5' as unknown as number, current_percent: '33.5' as unknown as number, tree_species: 'oak' };
  const back = rowToEntry(row);
  assert.equal(back.rating, 4.5);
  assert.equal(back.currentPercent, 33.5);
  assert.equal(back.treeSpecies, undefined);
});

test('total_pages fills a missing page count', () => {
  const row = entryToRow({ ...entry, book: { ...entry.book, pageCount: undefined } }, USER);
  assert.equal(row.total_pages, null);
  const back = rowToEntry({ ...row, total_pages: 300 });
  assert.equal(back.book.pageCount, 300);
});

test('books cache only accepts valid ISBN-13', () => {
  assert.equal(bookToRow(entry.book)?.isbn13, '9788936434120');
  assert.equal(bookToRow({ ...entry.book, isbn13: '12345' }), null);
  assert.equal(bookToRow({ ...entry.book, isbn13: undefined }), null);
  assert.equal(entryToRow({ ...entry, book: { ...entry.book, isbn13: undefined } }, USER).isbn13, null);
});

const log: ReadingLog = {
  id: 'lg1',
  entryId: entry.id,
  bookId: entry.book.id,
  date: '2026-10-06',
  kind: 'progress',
  pagesDelta: 40,
  createdAt: Date.UTC(2026, 9, 6, 3),
};

test('log → row → log round-trips and clamps negatives', () => {
  const row = logToRow(log, USER);
  assert.equal(row.user_book_id, entry.id);
  assert.deepEqual(rowToLog(row), log);
  assert.equal(logToRow({ ...log, pagesDelta: -5 }, USER).pages_delta, 0);
});

test('planUpload sends guest-only and newer entries plus their missing logs', () => {
  const older = { ...entry, id: 'old', updatedAt: 1 };
  const remoteOlder = { ...older, updatedAt: 0 };
  const same = { ...entry, id: 'same' };
  const guestOnly = { ...entry, id: 'guest' };
  const plan = planUpload(
    {
      entries: [older, same, guestOnly],
      logs: [
        { ...log, id: 'a', entryId: 'guest' },
        { ...log, id: 'b', entryId: 'same' },
        { ...log, id: 'c', entryId: 'gone' },
      ],
    },
    { entries: [remoteOlder, same], logIds: new Set(['b']) },
  );
  assert.deepEqual(plan.entries.map((e) => e.id), ['old', 'guest']);
  assert.deepEqual(plan.logs.map((l) => l.id), ['a']);
});

console.log(`\nAll ${passed} sync mapping tests passed.`);
