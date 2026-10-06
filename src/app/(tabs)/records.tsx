import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

import { Screen, SegmentedControl } from '@/components/ui';
import { ReadingCalendar } from '@/features/records/ReadingCalendar';
import { ReadingStats } from '@/features/records/ReadingStats';
import { WrappedBanner } from '@/features/wrapped/WrappedBanner';

type Section = 'calendar' | 'stats';

export default function RecordsScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('calendar');
  return (
    <Screen title={t('records.title')}>
      <View style={styles.switcher}>
        <SegmentedControl<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'calendar', label: `📅 ${t('records.calendar')}` },
            { value: 'stats', label: `📊 ${t('records.stats')}` },
          ]}
        />
      </View>
      {section === 'calendar' ? <ReadingCalendar /> : <ReadingStats />}
      <WrappedBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { alignItems: 'center' },
});
