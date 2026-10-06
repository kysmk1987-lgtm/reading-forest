import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, palette, radius, softShadow } from '@/theme';

const FALLBACK_TINTS = [palette.leafSoft, palette.skySoft, palette.pinkSoft, palette.yellowSoft, palette.woodSoft];

export interface BookCoverProps {
  uri?: string;
  title: string;
  width?: number;
}

export function BookCover({ uri, title, width = 64 }: BookCoverProps) {
  const height = Math.round(width * 1.45);
  const tint = FALLBACK_TINTS[title.length % FALLBACK_TINTS.length];
  return (
    <View style={[styles.frame, { width, height, borderRadius: Math.max(6, width * 0.1) }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: tint }]}>
          <AppText style={{ fontSize: width * 0.35 }}>📗</AppText>
          {width >= 80 ? (
            <AppText variant="tiny" center numberOfLines={3} style={styles.fallbackTitle}>
              {title}
            </AppText>
          ) : null}
        </View>
      )}
      <View style={styles.spine} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: 'rgba(91,70,54,0.12)',
    ...softShadow('#5B4636', 3),
  },
  fallback: { alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 },
  fallbackTitle: { paddingHorizontal: 4 },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderTopLeftRadius: radius.sm,
  },
});
