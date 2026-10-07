import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// `EXPO_PUBLIC_*` values must be read with direct property access so Expo can inline them.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** When false the app runs fully local (guest profile + on-device library + demo forest). */
export const isSupabaseConfigured = Boolean(url && key);

/** Public Auth settings (`/auth/v1/settings`): which providers are enabled, whether e-mail confirmation is off. */
export interface AuthServerSettings {
  external?: Record<string, boolean>;
  disable_signup?: boolean;
  mailer_autoconfirm?: boolean;
}

let settingsRequest: Promise<AuthServerSettings | null> | null = null;

export function fetchAuthSettings(): Promise<AuthServerSettings | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  settingsRequest ??= fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } })
    .then((res) => (res.ok ? (res.json() as Promise<AuthServerSettings>) : null))
    .catch(() => null)
    .then((settings) => {
      if (!settings) settingsRequest = null;
      return settings;
    });
  return settingsRequest;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (client) return client;
  const isWeb = Platform.OS === 'web';
  client = createClient(url!, key!, {
    auth: {
      // Web keeps the default localStorage; native persists the session in AsyncStorage.
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
      flowType: 'pkce',
    },
  });
  if (!isWeb) {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
