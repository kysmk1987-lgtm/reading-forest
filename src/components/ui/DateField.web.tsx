import { StyleSheet, View } from 'react-native';

import { colors, fonts, fontSize } from '@/theme';

import { AppText } from './AppText';
import type { DateFieldProps } from './DateField';
import { dateFieldStyles } from './dateFieldStyles';

export function DateField({ label, value, onChange }: DateFieldProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={dateFieldStyles.box}>
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            fontFamily: fonts.body,
            fontSize: fontSize.md,
            color: colors.text,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
});
