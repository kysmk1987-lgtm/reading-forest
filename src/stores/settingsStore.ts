import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AppLocale } from '@/config/locale';
import { persistStorage } from '@/lib/storage';

export type AppLanguage = AppLocale;

interface SettingsState {
  /** `null` = follow device language (only among `ENABLED_LOCALES`). */
  language: AppLanguage | null;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  /** Gallery: also blur quotes from books that are not in my library. */
  blurUnownedQuotes: boolean;
  setBlurUnownedQuotes: (enabled: boolean) => void;
  setLanguage: (language: AppLanguage | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      soundEnabled: true,
      hapticsEnabled: true,
      blurUnownedQuotes: false,
      setBlurUnownedQuotes: (blurUnownedQuotes) => set({ blurUnownedQuotes }),
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
    }),
    { name: 'rf-settings', storage: persistStorage },
  ),
);
