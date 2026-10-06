/**
 * Offline tests for 옮겨 심기 (garden layout, move/swap), review aggregation and the page-count fallback.
 * Run: npm run test:garden
 */
import assert from 'node:assert/strict';

import { parsePageCount } from '../api/_lib/pages';
import { GARDEN_MAX, gardenSize, layoutGarden, tileAt, transplant, validGardenCoord } from '../src/features/forest/layout';
import { defaultProgressUnit, pagesDisplay } from '../src/features/library/pages';
import { entryToRow, rowToEntry, withoutGardenColumns } from '../src/features/library/syncMapping';
import { cleanReviewBody, distributionPercents, normalizeRating, summarize } from '../src/features/reviews/aggregate';
import type { LibraryEntry } from '../src/types';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const trees = (n: number, extra: Partial<Record<number, { gardenX: number; gardenY: number }>> = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, createdAt: i, ...extra[i] }));

console.log('garden layout');
test('automatic size leaves room and every tree gets a unique tile', () => {
  assert.equal(gardenSize(0), 3);
  assert.equal(gardenSize(7), 3);
  assert.equal(gardenSize(8), 4);
  const { n, positions } = layoutGarden(trees(14));
  assert.equal(n, 4);
  const keys = Object.values(positions).map((t) => `${t.c}:${t.r}`);
  assert.equal(keys.length, 14);
  assert.equal(new Set(keys).size, 14);
});
test('first tree sits in the centre', () => {
  assert.deepEqual(layoutGarden(trees(1)).positions.t0, { c: 1, r: 1 });
});
test('saved tiles are kept, clashes resolved by age, others fill the rest', () => {
  const { positions } = layoutGarden(trees(3, { 1: { gardenX: 0, gardenY: 0 }, 2: { gardenX: 0, gardenY: 0 } }));
  assert.deepEqual(positions.t1, { c: 0, r: 0 });
  assert.notDeepEqual(positions.t2, { c: 0, r: 0 });
  assert.notDeepEqual(positions.t0, { c: 0, r: 0 });
});
test('garden grows to fit saved tiles and the 땅 넓히기 extra, capped at GARDEN_MAX', () => {
  assert.equal(layoutGarden(trees(1, { 0: { gardenX: 5, gardenY: 2 } })).n, 6);
  assert.equal(layoutGarden(trees(2), 2).n, 5);
  assert.equal(layoutGarden(trees(2), 99).n, GARDEN_MAX);
});
test('invalid coordinates are ignored', () => {
  assert.equal(validGardenCoord(-1), false);
  assert.equal(validGardenCoord(GARDEN_MAX), false);
  assert.equal(validGardenCoord(1.5), false);
  assert.equal(validGardenCoord(3), true);
  const { positions } = layoutGarden([{ id: 'a', createdAt: 0, gardenX: 40, gardenY: 1 }]);
  assert.deepEqual(positions.a, { c: 1, r: 1 });
});

console.log('move / swap');
const base = { a: { c: 0, r: 0 }, b: { c: 1, r: 0 }, c: { c: 2, r: 2 } };
test('moving to an empty tile pins every tree', () => {
  const next = transplant(base, 'a', { c: 0, r: 2 }, 3)!;
  assert.deepEqual(next.a, { c: 0, r: 2 });
  assert.deepEqual(next.b, base.b);
  assert.deepEqual(next.c, base.c);
});
test('moving onto another tree swaps them', () => {
  const next = transplant(base, 'a', { c: 2, r: 2 }, 3)!;
  assert.deepEqual(next.a, { c: 2, r: 2 });
  assert.deepEqual(next.c, { c: 0, r: 0 });
  assert.deepEqual(base.a, { c: 0, r: 0 }, 'input is not mutated');
});
test('no-ops: same tile, unknown tree, outside the garden', () => {
  assert.equal(transplant(base, 'a', { c: 0, r: 0 }, 3), null);
  assert.equal(transplant(base, 'zzz', { c: 1, r: 1 }, 3), null);
  assert.equal(transplant(base, 'a', { c: 3, r: 0 }, 3), null);
});
test('a moved layout survives the next layout pass', () => {
  const next = transplant(layoutGarden(trees(3)).positions, 't0', { c: 0, r: 0 }, 3)!;
  const pinned = trees(3).map((t) => ({ ...t, gardenX: next[t.id].c, gardenY: next[t.id].r }));
  const again = layoutGarden([...pinned, { id: 'new', createdAt: 9 }]).positions;
  for (const t of pinned) assert.deepEqual(again[t.id], next[t.id]);
  assert.ok(again.new && !pinned.some((t) => t.gardenX === again.new.c && t.gardenY === again.new.r));
});
test('tileAt maps a point to the diamond under it', () => {
  const dims = { tw: 84, th: 42, head: 96 };
  // Centre of tile (c, r): x = W/2 + (c - r) * tw/2, y = head + (c + r + 1) * th/2.
  const centre = (c: number, r: number, n: number) => [(n * 84) / 2 + ((c - r) * 84) / 2, 96 + ((c + r + 1) * 42) / 2] as const;
  for (const [c, r] of [[0, 0], [2, 1], [3, 3]] as const) {
    const [x, y] = centre(c, r, 4);
    assert.deepEqual(tileAt(x, y, 4, dims), { c, r });
  }
  assert.equal(tileAt(0, 0, 4, dims), null);
});
test('garden tiles sync through user_books.garden_x/garden_y', () => {
  const entry = { id: 'e', book: { id: 'kr_1', source: 'kakao', title: 'x', authors: [] }, status: 'read', createdAt: 0, updatedAt: 0 } as LibraryEntry;
  assert.equal('garden_x' in entryToRow(entry, 'u'), false, 'unplaced trees send no garden columns');
  const row = entryToRow({ ...entry, gardenX: 2, gardenY: 4 }, 'u');
  assert.equal(row.garden_x, 2);
  assert.equal(row.garden_y, 4);
  assert.equal('garden_x' in withoutGardenColumns(row), false);
  const back = rowToEntry(row);
  assert.equal(back.gardenX, 2);
  assert.equal(back.gardenY, 4);
  assert.equal(rowToEntry({ ...row, garden_x: 99 }).gardenX, undefined);
});

console.log('review aggregation');
test('ratings snap to half stars within 0.5–5', () => {
  assert.equal(normalizeRating(4.3), 4.5);
  assert.equal(normalizeRating(4.2), 4);
  assert.equal(normalizeRating(0.1), 0.5);
  assert.equal(normalizeRating(9), 5);
  assert.equal(normalizeRating(0), null);
  assert.equal(normalizeRating(undefined), null);
});
test('summary: count, average, distribution (half stars round up)', () => {
  const s = summarize([5, 4.5, 4, 3.5, 1, 0]);
  assert.equal(s.count, 5);
  assert.equal(s.average, 3.6);
  assert.deepEqual(s.dist, [1, 0, 0, 2, 2]);
  assert.deepEqual(summarize([]), { count: 0, average: 0, dist: [0, 0, 0, 0, 0] });
});
test('distribution bars are relative to the busiest bucket', () => {
  assert.deepEqual(distributionPercents(summarize([5, 5, 4])), [0, 0, 0, 50, 100]);
  assert.deepEqual(distributionPercents(summarize([])), [0, 0, 0, 0, 0]);
});
test('review text is trimmed and capped at 500', () => {
  assert.equal(cleanReviewBody('  좋아요  '), '좋아요');
  assert.equal(cleanReviewBody('가'.repeat(600)).length, 500);
  assert.equal(cleanReviewBody(undefined), '');
});

console.log('page count fallback');
test('library API PAGE strings are parsed', () => {
  assert.equal(parsePageCount('321 p.'), 321);
  assert.equal(parsePageCount('xii, 321 p. ; 21 cm'), 321);
  assert.equal(parsePageCount('321쪽'), 321);
  assert.equal(parsePageCount('1책(280면)'), 280);
  assert.equal(parsePageCount('412'), 412);
  assert.equal(parsePageCount(256), 256);
  assert.equal(parsePageCount('21 cm'), undefined);
  assert.equal(parsePageCount(''), undefined);
  assert.equal(parsePageCount(null), undefined);
  assert.equal(parsePageCount('0 p.'), undefined);
});
test('record sheet: known pages → page mode + 전체 N쪽; unknown → percent + 직접 입력', () => {
  assert.equal(defaultProgressUnit(321), 'page');
  assert.equal(defaultProgressUnit(undefined), 'percent');
  assert.equal(defaultProgressUnit(0), 'percent');
  assert.equal(defaultProgressUnit(undefined, 'page'), 'page', 'a saved unit wins');
  assert.deepEqual(pagesDisplay(321, ''), { total: 321, fallback: false });
  assert.deepEqual(pagesDisplay(undefined, ''), { total: undefined, fallback: true });
  assert.deepEqual(pagesDisplay(undefined, '280'), { total: 280, fallback: true });
});

console.log(`\n${passed} garden/review/page tests passed`);
