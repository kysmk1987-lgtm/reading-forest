import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { TRANSLATION_ENABLED } from '@/config/locale';
import { todayISO } from '@/lib/date';
import { FREE_LIMITS, useEntitlements } from '@/lib/entitlements';
import { persistStorage } from '@/lib/storage';

import { remainingTranslations } from './quota';

/**
 * Quote translation — off for the Korea-first launch (`TRANSLATION_ENABLED`). To turn it on later:
 * add a server endpoint (e.g. `/api/translate` calling Google Translate with a server-side key) and implement
 * `translateText` with it; the daily quota below already gates free users.
 */
export class TranslationDisabledError extends Error {
  constructor() {
    super('translation is disabled');
  }
}

export async function translateText(_text: string, _target: string): Promise<string> {
  if (!TRANSLATION_ENABLED) throw new TranslationDisabledError();
  throw new Error('translation endpoint not implemented');
}

interface QuotaState {
  day: string;
  used: number;
  consume: () => void;
}

const useQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      day: '',
      used: 0,
      consume: () => {
        const today = todayISO();
        set({ day: today, used: (get().day === today ? get().used : 0) + 1 });
      },
    }),
    { name: 'rf-translation-quota', storage: persistStorage },
  ),
);

/** Daily translation allowance (free: 10/day, premium: unlimited). */
export function useTranslationQuota() {
  const { isPremium } = useEntitlements();
  const day = useQuotaStore((s) => s.day);
  const used = useQuotaStore((s) => s.used);
  const consume = useQuotaStore((s) => s.consume);
  const remaining = remainingTranslations(day, used, todayISO(), isPremium, FREE_LIMITS.translationsPerDay);
  return { enabled: TRANSLATION_ENABLED, remaining, canTranslate: TRANSLATION_ENABLED && remaining > 0, consume };
}
