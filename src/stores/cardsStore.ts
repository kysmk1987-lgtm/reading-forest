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
  /** Adds the account's gallery cards made on other devices (matched by `galleryId`). */
  mergeGallery: (cards: { galleryId: string; bookTitle: string; createdAt: number }[]) => void;
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
      mergeGallery: (cards) =>
        set((s) => {
          const known = new Set(s.made.map((c) => c.galleryId).filter(Boolean));
          const incoming = cards.filter((c) => !known.has(c.galleryId)).map((c) => ({ id: c.galleryId, ...c }));
          if (!incoming.length) return s;
          return { made: [...s.made, ...incoming].sort((a, b) => a.createdAt - b.createdAt).slice(-1000) };
        }),
      clearLocal: () => set({ made: [] }),
    }),
    { name: 'rf-cards', storage: persistStorage },
  ),
);
