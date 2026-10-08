import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { RegionKey } from '@/features/together/regions';
import { persistStorage } from '@/lib/storage';

interface TogetherState {
  /** From `/api/geo` (IP → 시·도). */
  detectedRegion: RegionKey | null;
  /** User's choice in 마이 → 내 지역 (wins over detection). */
  regionOverride: RegionKey | null;
  /** Theme room the user is currently in (not persisted). */
  roomId: string | null;
  lastCheerAt: number;
  /** Today's anonymous reading-room token from the server (pairs my Presence with my ranking row). */
  roomToken: { day: string; token: string } | null;
  setDetectedRegion: (region: RegionKey | null) => void;
  setRegionOverride: (region: RegionKey | null) => void;
  setRoomId: (roomId: string | null) => void;
  markCheer: (at: number) => void;
  setRoomToken: (token: { day: string; token: string } | null) => void;
}

export const useTogetherStore = create<TogetherState>()(
  persist(
    (set) => ({
      detectedRegion: null,
      regionOverride: null,
      roomId: null,
      lastCheerAt: 0,
      roomToken: null,
      setDetectedRegion: (detectedRegion) => set({ detectedRegion }),
      setRegionOverride: (regionOverride) => set({ regionOverride }),
      setRoomId: (roomId) => set({ roomId }),
      markCheer: (lastCheerAt) => set({ lastCheerAt }),
      setRoomToken: (roomToken) => set({ roomToken }),
    }),
    {
      name: 'rf-together',
      storage: persistStorage,
      partialize: (s) => ({ detectedRegion: s.detectedRegion, regionOverride: s.regionOverride, lastCheerAt: s.lastCheerAt, roomToken: s.roomToken }),
    },
  ),
);

export function useMyRegion(): RegionKey | null {
  return useTogetherStore((s) => s.regionOverride ?? s.detectedRegion);
}
