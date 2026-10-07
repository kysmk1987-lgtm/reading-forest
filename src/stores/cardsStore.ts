import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

/** Quote cards made on this device (exported or shared) — counted in 독서 결산. */
export interface MadeCard {
  id: string;
  createdAt: number;
  bookTitle: string;
  galleryId?: string;
}

interface CardsState {
  made: MadeCard[];
  recordCard: (card: Omit<MadeCard, 'createdAt'>) => void;
  clearLocal: () => void;
}

export const useCardsStore = create<CardsState>()(
  persist(
    (set) => ({
      made: [],
      recordCard: (card) =>
        set((s) => {
          const i = s.made.findIndex((c) => c.id === card.id);
          if (i < 0) return { made: [...s.made, { ...card, createdAt: Date.now() }].slice(-1000) };
          const made = [...s.made];
          made[i] = { ...made[i], ...card, createdAt: made[i].createdAt };
          return { made };
        }),
      clearLocal: () => set({ made: [] }),
    }),
    { name: 'rf-cards', storage: persistStorage },
  ),
);
