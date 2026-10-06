import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui';
import { palette } from '@/theme';

/** `MAP_SCOPE=GLOBAL` slot: the future 3D globe goes here (same presence data, country-level instead of 시·도). */
export function GlobalReadersPlaceholder() {
  const { t } = useTranslation();
  return <EmptyState emoji="🌏" tint={palette.skySoft} badge={t('common.nextUpdate')} title={t('together.map.globalTitle')} body={t('together.map.globalBody')} />;
}
