import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Weather } from '@/features/forest/WeatherLayer';
import { persistStorage } from '@/lib/storage';

interface LocalWatering {
  count: number;
  lastDay?: string;
}

interface ForestState {
  /** Stable id for this device's forest (used for the preview page when Supabase is not connected). */
  localForestId: string;
  /** Share slug of the published (Supabase) forest, once the user has shared it. */
  publishedSlug: string | null;
  setPublishedSlug: (slug: string | null) => void;
  weather: Weather;
  /** Local/demo watering counters keyed by forest id. */
  waterings: Record<string, LocalWatering>;
  setWeather: (weather: Weather) => void;
  /** Records a local watering; returns false if this forest was already watered on `day`. */
  waterLocal: (forestId: string, day: string) => boolean;
}

export const useForestStore = create<ForestState>()(
  persist(
    (set, get) => ({
      localForestId: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      publishedSlug: null,
      setPublishedSlug: (publishedSlug) => set({ publishedSlug }),
      weather: 'clear',
      waterings: {},
      setWeather: (weather) => set({ weather }),
      waterLocal: (forestId, day) => {
        const current = get().waterings[forestId] ?? { count: 0 };
        if (current.lastDay === day) return false;
        set((s) => ({ waterings: { ...s.waterings, [forestId]: { count: current.count + 1, lastDay: day } } }));
        return true;
      },
    }),
    { name: 'rf-forest', storage: persistStorage },
  ),
);
