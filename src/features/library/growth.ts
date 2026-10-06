import type { LibraryEntry } from '@/types';

export type GrowthStage = 'seed' | 'sprout' | 'sapling' | 'young' | 'tree' | 'bloom';

/** Ordered growth stages; `bloom` (fruit/flowers) is reserved for finished books. */
export const GROWTH_STAGES: { stage: GrowthStage; minPercent: number }[] = [
  { stage: 'seed', minPercent: 0 },
  { stage: 'sprout', minPercent: 10 },
  { stage: 'sapling', minPercent: 35 },
  { stage: 'young', minPercent: 60 },
  { stage: 'tree', minPercent: 85 },
  { stage: 'bloom', minPercent: 100 },
];

export function growthStageFor(percent: number) {
  const p = Math.max(0, Math.min(100, percent));
  return [...GROWTH_STAGES].reverse().find((s) => p >= s.minPercent)!;
}

export function stageIndex(stage: GrowthStage) {
  return GROWTH_STAGES.findIndex((s) => s.stage === stage);
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
