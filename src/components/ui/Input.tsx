import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, fontSize, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface InputProps extends TextInputProps {
  label?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Shows `length/maxLength` counter next to the label. */
  showCounter?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, left, right, showCounter, containerStyle, style, multiline, maxLength, value, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label || showCounter ? (
        <View style={styles.labelRow}>
          {label ? <AppText variant="subtitle">{label}</AppText> : <View />}
          {showCounter && maxLength ? (
            <AppText variant="caption" muted>
              ({value?.length ?? 0}/{maxLength})
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.box, focused && styles.focused, multiline && styles.multilineBox]}>
        {left}
        <TextInput
          ref={ref}
          {...rest}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.multiline, style]}
        />
        {right}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  multilineBox: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
    outlineStyle: 'none',
  } as object,
  multiline: { minHeight: 84, textAlignVertical: 'top' },
});
