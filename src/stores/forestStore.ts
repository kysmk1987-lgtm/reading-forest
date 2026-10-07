import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_CRITTERS, normalizeCritters, type CritterKind } from '@/features/forest/critters';
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
  /** Little creatures wandering at the front of the garden (any combination, empty = nobody). */
  critters: CritterKind[];
  setCritters: (critters: CritterKind[]) => void;
  /** Extra rows/columns of empty land the reader added (땅 넓히기, no upper limit). */
  gardenExtra: number;
  expandGarden: () => void;
  setGardenExtra: (extra: number) => void;
  /** Records a local watering; returns false if this forest was already watered on `day`. */
  waterLocal: (forestId: string, day: string) => boolean;
}

const cleanExtra = (extra: number) => (Number.isFinite(extra) ? Math.max(0, Math.floor(extra)) : 0);

export const useForestStore = create<ForestState>()(
  persist(
    (set, get) => ({
      localForestId: `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      publishedSlug: null,
      setPublishedSlug: (publishedSlug) => set({ publishedSlug }),
      weather: 'clear',
      waterings: {},
      setWeather: (weather) => set({ weather }),
      critters: [...DEFAULT_CRITTERS],
      setCritters: (critters) => set({ critters: normalizeCritters(critters) }),
      gardenExtra: 0,
      expandGarden: () => set((s) => ({ gardenExtra: cleanExtra(s.gardenExtra) + 1 })),
      setGardenExtra: (extra) => set({ gardenExtra: cleanExtra(extra) }),
      waterLocal: (forestId, day) => {
        const current = get().waterings[forestId] ?? { count: 0 };
        if (current.lastDay === day) return false;
        set((s) => ({ waterings: { ...s.waterings, [forestId]: { count: current.count + 1, lastDay: day } } }));
        return true;
      },
    }),
    {
      name: 'rf-forest',
      storage: persistStorage,
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ForestState> & { critter?: unknown };
        // v1: one critter (`critter: 'butterfly' | 'none' | …`) → any combination (`critters: [...]`).
        if (version < 1) {
          state.critters = normalizeCritters(state.critter ?? DEFAULT_CRITTERS);
          delete state.critter;
        }
        return state as ForestState;
      },
    },
  ),
);
