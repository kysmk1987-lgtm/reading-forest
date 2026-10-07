import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_CRITTERS, normalizeCritters, type CritterKind } from '@/features/forest/critters';
import { GARDEN_LIMIT, GARDEN_MIN } from '@/features/forest/layout';
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
  /** Extra rows/columns of empty land beyond the automatic size (땅 넓히기 / 땅 좁히기, the garden stops at `GARDEN_LIMIT`). */
  gardenExtra: number;
  setGardenExtra: (extra: number) => void;
  /** Records a local watering; returns false if this forest was already watered on `day`. */
  waterLocal: (forestId: string, day: string) => boolean;
}

/** More extra than this can never show: even the smallest automatic garden (3×3) reaches 20×20 with it. */
const MAX_EXTRA = GARDEN_LIMIT - GARDEN_MIN;
const cleanExtra = (extra: unknown) => (typeof extra === 'number' && Number.isFinite(extra) ? Math.min(MAX_EXTRA, Math.max(0, Math.floor(extra))) : 0);

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
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<ForestState> & { critter?: unknown };
        // v1: one critter (`critter: 'butterfly' | 'none' | …`) → any combination (`critters: [...]`).
        if (version < 1) {
          state.critters = normalizeCritters(state.critter ?? DEFAULT_CRITTERS);
          delete state.critter;
        }
        // v2: 땅 넓히기 is capped at 20×20; saved tree tiles are untouched (the layout keeps far-out trees).
        if (version < 2) state.gardenExtra = cleanExtra(state.gardenExtra);
        return state as ForestState;
      },
    },
  ),
);
