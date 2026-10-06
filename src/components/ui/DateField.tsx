import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDisplayDate, fromISODate, toISODate } from '@/lib/date';
import { tapFeedback } from '@/lib/feedback';

import { AppText } from './AppText';
import { dateFieldStyles } from './dateFieldStyles';

export interface DateFieldProps {
  label: string;
  value?: string;
  onChange: (iso: string) => void;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const date = fromISODate(value);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <View style={[dateFieldStyles.box, styles.iosBox]}>
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            onChange={(_, d) => d && onChange(toISODate(d))}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <Pressable
        style={dateFieldStyles.box}
        onPress={() => {
          tapFeedback();
          DateTimePickerAndroid.open({
            value: date,
            mode: 'date',
            onChange: (_, d) => d && onChange(toISODate(d)),
          });
        }}>
        <AppText>{formatDisplayDate(value) || '—'}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  iosBox: { alignItems: 'flex-start' },
});
