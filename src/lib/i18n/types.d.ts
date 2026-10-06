import 'i18next';

import type { TranslationResources } from './locales/ko';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: TranslationResources };
  }
}
