/** Garden placement (pure, shared by the home garden, the public page and tests). */

export interface Tile {
  c: number;
  r: number;
}

export interface Plantable {
  id: string;
  createdAt: number;
  gardenX?: number;
  gardenY?: number;
}

/**
 * Technical bound of a garden edge (tiles) and of `garden_x/garden_y` in the database (migration 0006).
 * Only keeps coordinates sane; the product cap for 땅 넓히기 is `GARDEN_LIMIT`.
 */
export const GARDEN_MAX = 1000;
/**
 * 땅 넓히기 stops at this edge (20×20). A garden can still be bigger when saved trees already stand further out
 * (from before the cap) or when there are more trees than tiles — trees are never moved to enforce it.
 */
export const GARDEN_LIMIT = 20;
/** The 0004 database check (`garden_x/garden_y between 0 and 11`) until migration 0006 is applied. */
export const LEGACY_GARDEN_MAX = 12;
export const GARDEN_MIN = 3;

export function validGardenCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < GARDEN_MAX;
}

/** Automatic size: a little room to spare around the trees. */
export function gardenSize(treeCount: number) {
  return Math.max(GARDEN_MIN, Math.ceil(Math.sqrt(treeCount + 2)));
}

/** Tiles ordered from the middle outwards so the first books sit in the centre of the garden. */
export function tileOrder(n: number): Tile[] {
  const m = (n - 1) / 2;
  const tiles: Tile[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) tiles.push({ c, r });
  return tiles.sort((a, b) => (a.c - m) ** 2 + (a.r - m) ** 2 - ((b.c - m) ** 2 + (b.r - m) ** 2) || a.c + a.r - (b.c + b.r));
}

export const tileKey = (t: Tile) => `${t.c}:${t.r}`;

export interface GardenLayout {
  n: number;
  positions: Record<string, Tile>;
}

/**
 * Trees with a saved tile keep it (oldest wins a clash); the rest fill free tiles from the centre.
 * `extra` widens the garden beyond the automatic size (땅 넓히기), up to `GARDEN_LIMIT`.
 */
export function layoutGarden(trees: Plantable[], extra = 0): GardenLayout {
  const sorted = [...trees].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  const pinned = sorted.filter((t) => validGardenCoord(t.gardenX) && validGardenCoord(t.gardenY));
  const furthest = pinned.reduce((m, t) => Math.max(m, t.gardenX! + 1, t.gardenY! + 1), 0);
  const wanted = Math.max(gardenSize(trees.length), Math.min(GARDEN_LIMIT, gardenSize(trees.length) + Math.max(0, extra)));
  let n = Math.min(GARDEN_MAX, Math.max(wanted, furthest));
  // Every tree needs a tile.
  while (n * n < trees.length && n < GARDEN_MAX) n++;

  const positions: Record<string, Tile> = {};
  const taken = new Set<string>();
  for (const t of pinned) {
    const tile = { c: t.gardenX!, r: t.gardenY! };
    if (taken.has(tileKey(tile))) continue;
    positions[t.id] = tile;
    taken.add(tileKey(tile));
  }
  const free = tileOrder(n).filter((tile) => !taken.has(tileKey(tile)));
  for (const t of sorted) {
    if (positions[t.id]) continue;
    const tile = free.shift();
    if (!tile) break;
    positions[t.id] = tile;
    taken.add(tileKey(tile));
  }
  return { n, positions };
}

/** A new garden edge for 땅 넓히기 / 땅 좁히기: the `extra` to store and every tree's tile to pin. */
export interface GardenResize {
  extra: number;
  n: number;
  positions: Record<string, Tile>;
}

/**
 * 땅 넓히기: one more row and column on the far edges (c = n and r = n), so tile coordinates never shift.
 * Every tree is pinned where it stands, otherwise unplaced trees would re-centre in the bigger garden.
 * Null at `GARDEN_LIMIT` (or beyond it, for a garden that old far-out trees already made bigger).
 */
export function expandGarden(trees: Plantable[], extra = 0): GardenResize | null {
  const { n, positions } = layoutGarden(trees, extra);
  if (n >= GARDEN_LIMIT) return null;
  return { extra: n + 1 - gardenSize(trees.length), n: n + 1, positions };
}

/**
 * 땅 좁히기, the reverse of one 땅 넓히기 step: drops the last row and column (c = n - 1 and r = n - 1).
 * Null when a tree stands on that edge or the garden is already at its automatic size.
 */
export function shrinkGarden(trees: Plantable[], extra = 0): GardenResize | null {
  const { n, positions } = layoutGarden(trees, extra);
  const min = gardenSize(trees.length);
  if (n - 1 < min || (n - 1) * (n - 1) < trees.length) return null;
  if (Object.values(positions).some((t) => t.c >= n - 1 || t.r >= n - 1)) return null;
  return { extra: n - 1 - min, n: n - 1, positions };
}

/**
 * Moves `treeId` to `target`. An occupied target swaps the two trees. Returns the full new layout
 * (every tree pinned) so later additions never reshuffle what the reader arranged, or null for a no-op.
 */
export function transplant(positions: Record<string, Tile>, treeId: string, target: Tile, n: number): Record<string, Tile> | null {
  const from = positions[treeId];
  if (!from) return null;
  if (target.c < 0 || target.r < 0 || target.c >= n || target.r >= n) return null;
  if (from.c === target.c && from.r === target.r) return null;
  const next: Record<string, Tile> = {};
  for (const [id, tile] of Object.entries(positions)) next[id] = { ...tile };
  const occupant = Object.keys(positions).find((id) => id !== treeId && positions[id].c === target.c && positions[id].r === target.r);
  next[treeId] = { ...target };
  if (occupant) next[occupant] = { ...from };
  return next;
}

/** Tile under a point in garden coordinates (origin = left edge of the diamond grid, y from the top). */
export function tileAt(x: number, y: number, n: number, dims: { tw: number; th: number; head: number }): Tile | null {
  const W = n * dims.tw;
  const u = (x - W / 2) / (dims.tw / 2);
  const v = (y - dims.head) / (dims.th / 2);
  const c = Math.floor((u + v) / 2);
  const r = Math.floor((v - u) / 2);
  if (c < 0 || r < 0 || c >= n || r >= n) return null;
  return { c, r };
}
