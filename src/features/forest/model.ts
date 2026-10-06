import { growthStageFor, progressPercent, type GrowthStage } from '@/features/library/growth';
import type { LibraryEntry, ReadingStatus, TreeSpeciesId } from '@/types';

import { speciesOf } from './species';
import type { TreeVariant } from './TreeGraphic';

/** Everything the garden needs to draw one tree; also the shape stored for public (shared) forests. */
export interface ForestTree {
  id: string;
  bookId: string;
  title: string;
  coverUrl?: string;
  status: ReadingStatus;
  percent: number;
  species: TreeSpeciesId;
  createdAt: number;
}

export function treeFromEntry(entry: LibraryEntry, isPremium: boolean): ForestTree {
  return {
    id: entry.id,
    bookId: entry.book.id,
    title: entry.book.title,
    coverUrl: entry.book.coverUrl,
    status: entry.status,
    percent: progressPercent(entry),
    species: speciesOf(entry, isPremium),
    createdAt: entry.createdAt,
  };
}

export function treeLook(tree: Pick<ForestTree, 'status' | 'percent'>): { stage: GrowthStage; variant: TreeVariant } {
  if (tree.status === 'want') return { stage: 'seed', variant: 'pot' };
  if (tree.status === 'stopped') return { stage: 'seed', variant: 'withered' };
  return { stage: growthStageFor(tree.status === 'read' ? 100 : tree.percent).stage, variant: 'growing' };
}
