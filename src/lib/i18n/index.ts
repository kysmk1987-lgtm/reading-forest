import { getLocales } from 'expo-localization';
import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, ENABLED_LOCALES, type AppLocale } from '@/config/locale';
import { useSettingsStore } from '@/stores/settingsStore';

import en from './locales/en';
import ko from './locales/ko';

/** All translations that exist; only `ENABLED_LOCALES` are loaded. */
const ALL_RESOURCES: Record<AppLocale, typeof ko> = { ko, en };

const resources: Resource = Object.fromEntries(
  ENABLED_LOCALES.map((code) => [code, { translation: ALL_RESOURCES[code] }]),
);

function isEnabled(code: string | null | undefined): code is AppLocale {
  return !!code && (ENABLED_LOCALES as string[]).includes(code);
}

export function resolveLanguage(preferred: string | null): AppLocale {
  if (isEnabled(preferred)) return preferred;
  const device = getLocales()[0]?.languageCode;
  return isEnabled(device) ? device : DEFAULT_LOCALE;
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(useSettingsStore.getState().language),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: ENABLED_LOCALES,
  interpolation: { escapeValue: false },
});

useSettingsStore.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    i18n.changeLanguage(resolveLanguage(state.language));
  }
});

export default i18n;
