import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AppLocale } from '@/config/locale';
import { persistStorage } from '@/lib/storage';

export type AppLanguage = AppLocale;
/** Who can see the rating/한줄평 saved in the record sheet (published to the book's 리뷰 tab). */
export type ReviewVisibility = 'public' | 'private';

interface SettingsState {
  /** `null` = follow device language (only among `ENABLED_LOCALES`). */
  language: AppLanguage | null;
  soundEnabled: boolean;
  /** Gallery: also blur quotes from books that are not in my library. */
  blurUnownedQuotes: boolean;
  reviewVisibility: ReviewVisibility;
  setBlurUnownedQuotes: (enabled: boolean) => void;
  setLanguage: (language: AppLanguage | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setReviewVisibility: (visibility: ReviewVisibility) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      soundEnabled: true,
      blurUnownedQuotes: false,
      reviewVisibility: 'public',
      setBlurUnownedQuotes: (blurUnownedQuotes) => set({ blurUnownedQuotes }),
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setReviewVisibility: (reviewVisibility) => set({ reviewVisibility }),
    }),
    {
      name: 'rf-settings',
      storage: persistStorage,
      version: 1,
      // v1: the haptics toggle was removed (haptics are always on natively).
      migrate: (persisted) => {
        const { hapticsEnabled: _removed, ...rest } = (persisted ?? {}) as Partial<SettingsState> & { hapticsEnabled?: boolean };
        return rest as SettingsState;
      },
    },
  ),
);
