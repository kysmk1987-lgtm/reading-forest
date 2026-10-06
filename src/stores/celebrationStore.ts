import { create } from 'zustand';

import type { GrowthStage } from '@/features/library/growth';
import type { LibraryEntry } from '@/types';

export interface GrowthCelebration {
  entry: LibraryEntry;
  from: GrowthStage;
  to: GrowthStage;
}

interface CelebrationState {
  current: GrowthCelebration | null;
  celebrate: (c: GrowthCelebration) => void;
  dismiss: () => void;
}

/** Transient (not persisted): drives the "tree grew" overlay after a progress update. */
export const useCelebrationStore = create<CelebrationState>()((set) => ({
  current: null,
  celebrate: (current) => set({ current }),
  dismiss: () => set({ current: null }),
}));
