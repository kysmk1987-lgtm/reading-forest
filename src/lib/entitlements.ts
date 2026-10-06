import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from './storage';

/**
 * Central Free/Premium gating. Sprint 5 replaces `setPremium` with RevenueCat
 * customer info; every feature check should go through this module.
 */
export type Feature =
  | 'noAds'
  | 'unlimitedTranslation'
  | 'premiumTrees'
  | 'themeRooms'
  | 'readingWrappedExport';

export const FREE_LIMITS = {
  translationsPerDay: 10,
} as const;

interface EntitlementsState {
  isPremium: boolean;
  setPremium: (isPremium: boolean) => void;
}

export const useEntitlementsStore = create<EntitlementsState>()(
  persist(
    (set) => ({
      isPremium: false,
      setPremium: (isPremium) => set({ isPremium }),
    }),
    { name: 'rf-entitlements', storage: persistStorage },
  ),
);

export function hasFeature(isPremium: boolean, _feature: Feature): boolean {
  return isPremium;
}

export function useEntitlements() {
  const isPremium = useEntitlementsStore((s) => s.isPremium);
  return {
    isPremium,
    showAds: !isPremium,
    can: (feature: Feature) => hasFeature(isPremium, feature),
  };
}
