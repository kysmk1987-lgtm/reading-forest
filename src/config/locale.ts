/**
 * Localization & market config. The app launches Korea-only:
 * - UI language: Korean only. Add a resource file under `src/lib/i18n/locales/` and list its code in
 *   `EXPO_PUBLIC_ENABLED_LOCALES` (e.g. `ko,en`) to enable it — the language picker appears automatically
 *   once more than one locale is enabled.
 * - Book search region: `KR` uses the server proxy (Kakao / Aladin / Naver) for books sold in Korea.
 */
export const SUPPORTED_LOCALES = ['ko', 'en'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'ko';

function parseLocales(raw: string | undefined): AppLocale[] {
  const list = (raw ?? DEFAULT_LOCALE)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is AppLocale => (SUPPORTED_LOCALES as readonly string[]).includes(s));
  return list.length ? Array.from(new Set([DEFAULT_LOCALE, ...list])) : [DEFAULT_LOCALE];
}

export const ENABLED_LOCALES: AppLocale[] = parseLocales(process.env.EXPO_PUBLIC_ENABLED_LOCALES);

export const isLanguagePickerEnabled = ENABLED_LOCALES.length > 1;

/** Display names for the language picker (shown in each language's own script). */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  ko: '한국어',
  en: 'English',
};

export type BookRegion = 'KR' | 'GLOBAL';

export const BOOK_REGION: BookRegion = process.env.EXPO_PUBLIC_BOOK_REGION === 'GLOBAL' ? 'GLOBAL' : 'KR';
