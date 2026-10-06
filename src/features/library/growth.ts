import type { LibraryEntry } from '@/types';

export type GrowthStage = 'seed' | 'sprout' | 'sapling' | 'tree';

export const GROWTH_STAGES: { stage: GrowthStage; minPercent: number; emoji: string }[] = [
  { stage: 'seed', minPercent: 0, emoji: '🌰' },
  { stage: 'sprout', minPercent: 25, emoji: '🌱' },
  { stage: 'sapling', minPercent: 50, emoji: '🌿' },
  { stage: 'tree', minPercent: 90, emoji: '🌳' },
];

export function growthStageFor(percent: number) {
  const p = Math.max(0, Math.min(100, percent));
  return [...GROWTH_STAGES].reverse().find((s) => p >= s.minPercent)!;
}

/** Reading progress 0–100 for any entry. */
export function progressPercent(entry: LibraryEntry): number {
  if (entry.status === 'read') return 100;
  if (entry.status === 'want') return 0;
  if (entry.progressUnit === 'percent') return clamp(entry.currentPercent ?? 0);
  const total = entry.book.pageCount;
  if (!total || !entry.currentPage) return 0;
  return clamp(Math.round((entry.currentPage / total) * 100));
}

/** Current page, derived from % when the user tracks percent. */
export function currentPageOf(entry: LibraryEntry): number | undefined {
  if (entry.status === 'read') return entry.book.pageCount;
  if (entry.progressUnit === 'percent') {
    return entry.book.pageCount ? Math.round(((entry.currentPercent ?? 0) / 100) * entry.book.pageCount) : undefined;
  }
  return entry.currentPage;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
