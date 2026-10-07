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
 * 땅 넓히기 has no product limit; this only keeps coordinates sane.
 */
export const GARDEN_MAX = 1000;
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
 * `extra` widens the garden beyond the automatic size (땅 넓히기).
 */
export function layoutGarden(trees: Plantable[], extra = 0): GardenLayout {
  const sorted = [...trees].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  const pinned = sorted.filter((t) => validGardenCoord(t.gardenX) && validGardenCoord(t.gardenY));
  const furthest = pinned.reduce((m, t) => Math.max(m, t.gardenX! + 1, t.gardenY! + 1), 0);
  let n = Math.min(GARDEN_MAX, Math.max(gardenSize(trees.length) + Math.max(0, extra), furthest));
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
