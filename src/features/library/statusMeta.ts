import { palette } from '@/theme';
import type { ReadingStatus } from '@/types';

export const STATUS_META: Record<ReadingStatus, { emoji: string; color: string; shadow: string; soft: string }> = {
  read: { emoji: '🏁', color: palette.leaf, shadow: palette.leafShadow, soft: palette.leafSoft },
  reading: { emoji: '📖', color: palette.sky, shadow: palette.skyDeep, soft: palette.skySoft },
  want: { emoji: '💗', color: palette.pink, shadow: palette.pinkDeep, soft: palette.pinkSoft },
  stopped: { emoji: '🍂', color: palette.stone, shadow: palette.stoneDeep, soft: palette.stoneSoft },
};
