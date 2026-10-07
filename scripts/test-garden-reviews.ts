/**
 * Offline tests for 옮겨 심기 (garden layout, move/swap), review aggregation and the page-count fallback.
 * Run: npm run test:garden
 */
import assert from 'node:assert/strict';

import { parsePageCount } from '../api/_lib/pages';
import { DEFAULT_CRITTERS, effectiveCritters, normalizeCritters, toggleCritter } from '../src/features/forest/critters';
import {
  expandGarden,
  GARDEN_LIMIT,
  GARDEN_MAX,
  GARDEN_MIN,
  gardenSize,
  layoutGarden,
  LEGACY_GARDEN_MAX,
  shrinkGarden,
  tileAt,
  transplant,
  validGardenCoord,
} from '../src/features/forest/layout';
import { AVATAR_IDS, AVATARS, DEFAULT_AVATAR, effectiveAvatar } from '../src/features/profile/avatars';
import { defaultProgressUnit, pagesDisplay } from '../src/features/library/pages';
import { entryToRow, rowToEntry, withLegacyGardenColumns, withoutGardenColumns } from '../src/features/library/syncMapping';
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
test('garden grows to fit saved tiles and the 땅 넓히기 extra, up to GARDEN_LIMIT (20×20)', () => {
  assert.equal(GARDEN_LIMIT, 20);
  assert.equal(layoutGarden(trees(1, { 0: { gardenX: 5, gardenY: 2 } })).n, 6);
  assert.equal(layoutGarden(trees(2), 2).n, 5);
  assert.equal(layoutGarden(trees(2), 7).n, 10, 'beyond the old 6-step limit');
  assert.equal(layoutGarden(trees(2), 17).n, GARDEN_LIMIT);
  assert.equal(layoutGarden(trees(2), 40).n, GARDEN_LIMIT, 'an old, bigger extra is clamped');
  assert.equal(layoutGarden(trees(2), 1e6).n, GARDEN_LIMIT);
  const inner = layoutGarden(trees(2, { 1: { gardenX: 19, gardenY: 3 } }), 40);
  assert.equal(inner.n, GARDEN_LIMIT);
  assert.ok(transplant(inner.positions, 't0', { c: 19, r: 19 }, inner.n), 'moving into the last row works');
});
test('a saved garden bigger than 20×20 keeps every tree where it stands', () => {
  const far = layoutGarden(trees(3, { 1: { gardenX: 30, gardenY: 18 }, 2: { gardenX: 4, gardenY: 24 } }), 40);
  assert.equal(far.n, 31, 'the far tree keeps the garden that big (no relocation)');
  assert.deepEqual(far.positions.t1, { c: 30, r: 18 });
  assert.deepEqual(far.positions.t2, { c: 4, r: 24 });
  assert.equal(expandGarden(trees(3, { 1: { gardenX: 30, gardenY: 18 } }), 40), null, '땅 넓히기 is off beyond the cap');
  assert.equal(shrinkGarden(trees(3, { 1: { gardenX: 30, gardenY: 18 } }), 40), null, 'the far tree blocks 땅 좁히기');
  // Moving the far trees inward lets the garden fall back to the 20×20 cap.
  const moved = transplant(far.positions, 't1', { c: 10, r: 10 }, far.n)!;
  const movedAgain = transplant(moved, 't2', { c: 11, r: 10 }, far.n)!;
  const pinned = trees(3).map((t) => ({ ...t, gardenX: movedAgain[t.id].c, gardenY: movedAgain[t.id].r }));
  assert.equal(layoutGarden(pinned, 40).n, GARDEN_LIMIT);
  assert.equal(layoutGarden(pinned, 0).n, 16, 'without extra it is only as big as the furthest tree (t0 at 15:15)');
});
test('more trees than 20×20 tiles still give every tree a tile', () => {
  const { n, positions } = layoutGarden(trees(GARDEN_LIMIT * GARDEN_LIMIT + 5), 1e6);
  assert.equal(n, 21);
  assert.equal(new Set(Object.values(positions).map((p) => `${p.c}:${p.r}`)).size, GARDEN_LIMIT * GARDEN_LIMIT + 5);
});
test('invalid coordinates are ignored', () => {
  assert.equal(validGardenCoord(-1), false);
  assert.equal(validGardenCoord(GARDEN_MAX), false);
  assert.equal(validGardenCoord(1.5), false);
  assert.equal(validGardenCoord(3), true);
  assert.equal(validGardenCoord(40), true, 'expanded land beyond the old 12×12');
  const { positions } = layoutGarden([{ id: 'a', createdAt: 0, gardenX: GARDEN_MAX + 5, gardenY: 1 }]);
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
  assert.equal(rowToEntry({ ...row, garden_x: 99 }).gardenX, 99, 'expanded land beyond the old 0–11 range syncs back');
  assert.equal(rowToEntry({ ...row, garden_x: GARDEN_MAX }).gardenX, undefined);
});
test('without migration 0006 only tiles beyond 0–11 drop their garden columns', () => {
  const entry = { id: 'e', book: { id: 'kr_1', source: 'kakao', title: 'x', authors: [] }, status: 'read', createdAt: 0, updatedAt: 0 } as LibraryEntry;
  const near = entryToRow({ ...entry, gardenX: LEGACY_GARDEN_MAX - 1, gardenY: 0 }, 'u');
  assert.equal(withLegacyGardenColumns(near).garden_x, LEGACY_GARDEN_MAX - 1);
  const far = entryToRow({ ...entry, gardenX: 3, gardenY: LEGACY_GARDEN_MAX }, 'u');
  assert.equal(far.garden_y, LEGACY_GARDEN_MAX);
  assert.equal('garden_y' in withLegacyGardenColumns(far), false);
  assert.equal(withLegacyGardenColumns(far).status, 'read', 'the rest of the row is still written');
});
test('초기화: pinning the pre-edit layout and the old extra restores the original garden', () => {
  const start = layoutGarden(trees(4), 0);
  const moved = transplant(start.positions, 't0', { c: 0, r: 0 }, start.n)!;
  const pinned = (layout: Record<string, { c: number; r: number }>) => trees(4).map((t) => ({ ...t, gardenX: layout[t.id].c, gardenY: layout[t.id].r }));
  assert.notDeepEqual(layoutGarden(pinned(moved), 2).positions, start.positions);
  const restored = layoutGarden(pinned(start.positions), 0);
  assert.equal(restored.n, start.n);
  assert.deepEqual(restored.positions, start.positions);
});

console.log('땅 넓히기 / 땅 좁히기');
const pinAll = (list: ReturnType<typeof trees>, layout: Record<string, { c: number; r: number }>) =>
  list.map((t) => ({ ...t, gardenX: layout[t.id].c, gardenY: layout[t.id].r }));
test('expanding adds the far row and column, keeps every tree where it stood', () => {
  const start = layoutGarden(trees(2), 0);
  const grown = expandGarden(trees(2), 0)!;
  assert.equal(grown.n, start.n + 1);
  assert.deepEqual(grown.positions, start.positions, 'pinned at the old tiles, nothing re-centres');
  const after = layoutGarden(pinAll(trees(2), grown.positions), grown.extra);
  assert.equal(after.n, start.n + 1);
  assert.deepEqual(after.positions, start.positions);
});
test('expanding always adds visible land, even when a far tile set the size', () => {
  const list = trees(2, { 1: { gardenX: 6, gardenY: 0 } });
  assert.equal(layoutGarden(list, 0).n, 7);
  const grown = expandGarden(list, 0)!;
  assert.equal(grown.n, 8);
  assert.equal(layoutGarden(pinAll(list, grown.positions), grown.extra).n, 8);
});
test('shrinking reverses one expansion step (size and tiles)', () => {
  const start = layoutGarden(trees(3), 0);
  const grown = expandGarden(trees(3), 0)!;
  const grownTrees = pinAll(trees(3), grown.positions);
  const back = shrinkGarden(grownTrees, grown.extra)!;
  assert.ok(back);
  assert.equal(back.n, start.n);
  assert.equal(back.extra, 0);
  const after = layoutGarden(pinAll(trees(3), back.positions), back.extra);
  assert.equal(after.n, start.n);
  assert.deepEqual(after.positions, start.positions);
});
test('shrinking is blocked by a tree on the last row or column', () => {
  const list = trees(2, { 0: { gardenX: 1, gardenY: 1 }, 1: { gardenX: 4, gardenY: 0 } });
  assert.equal(layoutGarden(list, 0).n, 5);
  assert.equal(shrinkGarden(list, 0), null, 'tree on c = n - 1');
  const row = trees(2, { 0: { gardenX: 1, gardenY: 1 }, 1: { gardenX: 0, gardenY: 4 } });
  assert.equal(shrinkGarden(row, 0), null, 'tree on r = n - 1');
  const corner = trees(2, { 0: { gardenX: 1, gardenY: 1 }, 1: { gardenX: 4, gardenY: 4 } });
  assert.equal(shrinkGarden(corner, 0), null, 'tree on the far corner');
  const inner = trees(2, { 0: { gardenX: 1, gardenY: 1 }, 1: { gardenX: 3, gardenY: 3 } });
  const ok = shrinkGarden(inner, 2)!;
  assert.equal(ok.n, 4);
  assert.equal(layoutGarden(pinAll(inner, ok.positions), ok.extra).n, 4);
});
test('shrinking stops at the automatic size', () => {
  assert.equal(shrinkGarden(trees(2), 0), null, 'already the minimum (3×3)');
  assert.equal(shrinkGarden(trees(14), 0), null, 'automatic 4×4 for 14 trees');
  assert.equal(shrinkGarden([], 0), null);
  const one = shrinkGarden(trees(1, { 0: { gardenX: 0, gardenY: 0 } }), 1)!;
  assert.equal(one.n, GARDEN_MIN);
  assert.equal(one.extra, 0);
});
test('repeated expand then shrink returns to the start; 초기화 restores size and tiles', () => {
  let list = trees(4);
  const start = layoutGarden(list, 0);
  let extra = 0;
  for (let i = 0; i < 3; i++) {
    const step = expandGarden(list, extra)!;
    list = pinAll(list, step.positions);
    extra = step.extra;
  }
  assert.equal(layoutGarden(list, extra).n, start.n + 3);
  const moved = transplant(layoutGarden(list, extra).positions, 't0', { c: start.n + 2, r: 0 }, start.n + 3)!;
  list = pinAll(list, moved);
  assert.equal(shrinkGarden(list, extra), null, 'the moved tree blocks shrinking');
  const reset = layoutGarden(pinAll(list, start.positions), 0);
  assert.equal(reset.n, start.n);
  assert.deepEqual(reset.positions, start.positions);
  list = pinAll(list, start.positions);
  extra = 3;
  for (let i = 0; i < 3; i++) {
    const step = shrinkGarden(list, extra)!;
    list = pinAll(list, step.positions);
    extra = step.extra;
  }
  assert.equal(layoutGarden(list, extra).n, start.n);
  assert.equal(shrinkGarden(list, extra), null);
});
test('땅 넓히기 stops at 20×20', () => {
  let list = trees(2);
  let extra = 0;
  let steps = 0;
  for (let step = expandGarden(list, extra); step; step = expandGarden(list, extra)) {
    list = pinAll(list, step.positions);
    extra = step.extra;
    steps++;
  }
  assert.equal(steps, GARDEN_LIMIT - GARDEN_MIN);
  assert.equal(layoutGarden(list, extra).n, GARDEN_LIMIT);
  assert.ok(shrinkGarden(list, extra), '땅 좁히기 still works at the cap');
});

console.log('premium decorations');
test('critters: several at once, 없음 clears, toggles keep chip order', () => {
  assert.deepEqual(toggleCritter([], 'ladybug'), ['ladybug']);
  assert.deepEqual(toggleCritter(['ladybug'], 'butterfly'), ['butterfly', 'ladybug']);
  assert.deepEqual(toggleCritter(['butterfly', 'ladybug'], 'butterfly'), ['ladybug']);
  assert.deepEqual(toggleCritter(['butterfly', 'frog'], 'none'), []);
});
test('critters: the old single value migrates to a list', () => {
  assert.deepEqual(normalizeCritters('frog'), ['frog']);
  assert.deepEqual(normalizeCritters('none'), []);
  assert.deepEqual(normalizeCritters(undefined), [...DEFAULT_CRITTERS]);
  assert.deepEqual(normalizeCritters('dragon'), [...DEFAULT_CRITTERS]);
  assert.deepEqual(normalizeCritters(['bee', 'dragon', 'butterfly', 'bee']), ['butterfly', 'bee'], 'unknown and duplicate entries dropped');
  assert.deepEqual(normalizeCritters([]), []);
});
test('premium critters and avatars fall back to the free default when premium is off', () => {
  assert.deepEqual(effectiveCritters(['butterfly', 'frog', 'bee'], false), ['butterfly'], 'locked ones are dropped');
  assert.deepEqual(effectiveCritters(['ladybug', 'firefly'], false), ['ladybug']);
  assert.deepEqual(effectiveCritters(['frog'], false), [...DEFAULT_CRITTERS], 'nothing left → default');
  assert.deepEqual(effectiveCritters(['frog', 'bee'], true), ['frog', 'bee']);
  assert.deepEqual(effectiveCritters([], false), []);
  assert.deepEqual(effectiveCritters('frog', false), [...DEFAULT_CRITTERS], 'legacy value');
  assert.equal(effectiveAvatar('bunny', false), DEFAULT_AVATAR);
  assert.equal(effectiveAvatar('bunny', true), 'bunny');
  assert.equal(effectiveAvatar('glasses', false), 'glasses');
  assert.equal(effectiveAvatar(null, true), DEFAULT_AVATAR);
  assert.equal(effectiveAvatar('cat', false), DEFAULT_AVATAR);
  assert.equal(effectiveAvatar('bun', false), 'bun');
});
test('avatars: 5 free + 6 premium people, ids fit the profiles.avatar check', () => {
  const people = AVATAR_IDS.filter((id) => AVATARS[id].person);
  assert.equal(people.filter((id) => !AVATARS[id].premium).length, 5);
  assert.equal(people.filter((id) => AVATARS[id].premium).length, 6);
  for (const id of AVATAR_IDS) assert.match(id, /^[a-z][a-z0-9_-]{0,31}$/);
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
