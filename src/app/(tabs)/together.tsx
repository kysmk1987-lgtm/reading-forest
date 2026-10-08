import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Screen, SegmentedControl } from '@/components/ui';
import { RoomList } from '@/features/together/RoomList';
import { TimerPanel } from '@/features/together/TimerPanel';
import { useTimerStore } from '@/stores/timerStore';

type Section = 'timer' | 'rooms';

/** How long 시작 stays highlighted after "이 책 읽기" on a book page. */
const INTENT_MS = 60_000;

/**
 * 함께 읽기: (1) my reading timer — focus/break cycles with ambient sound that log into the reading calendar,
 * (2) 독서실 — theme rooms where readers compete on today's minutes (the nationwide live map is folded in there).
 */
export default function TogetherScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('timer');
  const intent = useTimerStore((s) => s.readingIntent);
  const [highlight, setHighlight] = useState(false);

  // Opened from a book's "이 책 읽기": jump to the timer with that book chosen and 시작 highlighted.
  useFocusEffect(
    useCallback(() => {
      if (!intent) return;
      if (Date.now() - intent.at < INTENT_MS) {
        setSection('timer');
        setHighlight(true);
      }
      useTimerStore.getState().clearReadingIntent();
    }, [intent]),
  );

  return (
    <Screen title={t('together.title')} subtitle={t('together.subtitle')}>
      <View style={styles.switcher}>
        <SegmentedControl<Section>
          value={section}
          onChange={(s) => {
            setSection(s);
            setHighlight(false);
          }}
          options={[
            { value: 'timer', label: `⏱️ ${t('together.tabs.timer')}` },
            { value: 'rooms', label: `🏠 ${t('together.tabs.rooms')}` },
          ]}
        />
      </View>
      {section === 'timer' ? <TimerPanel highlightStart={highlight} onStarted={() => setHighlight(false)} /> : <RoomList />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { alignItems: 'center' },
});
