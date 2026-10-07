import { DEFAULT_CRITTERS, normalizeCritters, type CritterKind } from '@/features/forest/critters';
import type { Weather } from '@/features/forest/WeatherLayer';
import { DEFAULT_AVATAR, isAvatarId, type AvatarId } from '@/features/profile/avatars';

/**
 * Per-account preferences that have no table of their own, kept in Supabase Auth `user_metadata.rf_prefs`
 * (no migration needed; written with `auth.updateUser({ data })`). Pure helpers — unit tested in test-sync-mapping.
 */
export const PREFS_METADATA_KEY = 'rf_prefs';

export interface AccountPrefs {
  v: 1;
  /** Epoch ms of the change that produced these values. */
  updatedAt: number;
  forest: { weather: Weather; critters: CritterKind[]; gardenExtra: number };
  settings: { soundEnabled: boolean; blurUnownedQuotes: boolean; reviewVisibility: 'public' | 'private' };
  /** Mirror of `profiles.forest_name / avatar`, so they follow the account even before migration 0005 is applied. */
  look: { forestName: string; avatar: AvatarId };
}

export type PrefsValues = Omit<AccountPrefs, 'v' | 'updatedAt'>;

const WEATHERS: readonly Weather[] = ['clear', 'rain', 'snow'];
const GARDEN_EXTRA_MAX = 1000;

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** Reads `user_metadata.rf_prefs`, dropping anything malformed (null when absent). */
export function parsePrefs(raw: unknown): AccountPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = obj(raw);
  const forest = obj(r.forest);
  const settings = obj(r.settings);
  const look = obj(r.look);
  const extra = Number(forest.gardenExtra);
  return {
    v: 1,
    updatedAt: Number.isFinite(Number(r.updatedAt)) ? Number(r.updatedAt) : 0,
    forest: {
      weather: WEATHERS.includes(forest.weather as Weather) ? (forest.weather as Weather) : 'clear',
      critters: Array.isArray(forest.critters) ? normalizeCritters(forest.critters) : [...DEFAULT_CRITTERS],
      gardenExtra: Number.isFinite(extra) ? Math.min(GARDEN_EXTRA_MAX, Math.max(0, Math.floor(extra))) : 0,
    },
    settings: {
      soundEnabled: settings.soundEnabled !== false,
      blurUnownedQuotes: settings.blurUnownedQuotes === true,
      reviewVisibility: settings.reviewVisibility === 'private' ? 'private' : 'public',
    },
    look: {
      forestName: typeof look.forestName === 'string' ? look.forestName.trim().slice(0, 16) : '',
      avatar: isAvatarId(look.avatar) ? look.avatar : DEFAULT_AVATAR,
    },
  };
}

export function samePrefs(a: PrefsValues, b: PrefsValues) {
  return JSON.stringify([a.forest, a.settings, a.look]) === JSON.stringify([b.forest, b.settings, b.look]);
}

/**
 * Sign-in reconciliation: the newer side wins. A fresh device (or one another account just left) has
 * `localUpdatedAt = 0`, so whatever the account saved before comes down; an account without prefs gets this device's.
 */
export function reconcilePrefs(local: PrefsValues, localUpdatedAt: number, remote: AccountPrefs | null): 'pull' | 'push' | 'none' {
  if (!remote) return 'push';
  if (samePrefs(local, remote)) return 'none';
  return remote.updatedAt >= localUpdatedAt ? 'pull' : 'push';
}
