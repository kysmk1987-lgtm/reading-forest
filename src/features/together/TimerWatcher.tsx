import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { todayISO } from '@/lib/date';
import { alarmFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';
import { useTogetherStore } from '@/stores/togetherStore';

import { cancelTimerAlarm, scheduleTimerAlarm, showFinishedNotice } from './timerAlarm';

/**
 * Mount once at the root. Checks the wall-clock end time every second (so a backgrounded/throttled app catches up
 * as soon as it runs again), rings the alarm, logs focus minutes for the linked book and keeps the native
 * local notification in step with the timer.
 */
export function TimerWatcher() {
  const { t } = useTranslation();
  const status = useTimerStore((s) => s.status);
  const endsAt = useTimerStore((s) => s.endsAt);
  const phase = useTimerStore((s) => s.phase);

  useEffect(() => {
    if (status === 'running' && endsAt) {
      const title = phase === 'focus' ? t('together.timer.focusDoneTitle') : t('together.timer.breakDoneTitle');
      scheduleTimerAlarm(endsAt, title, t('together.timer.notificationBody'));
    } else {
      cancelTimerAlarm();
    }
  }, [status, endsAt, phase, t]);

  useEffect(() => {
    if (status !== 'running') return;
    const check = () => {
      const session = useTimerStore.getState().finish(Date.now(), todayISO());
      if (!session) return;
      alarmFeedback();
      const title = session.phase === 'focus' ? t('together.timer.focusDoneTitle') : t('together.timer.breakDoneTitle');
      showFinishedNotice(title, t('together.timer.notificationBody'));
      if (session.phase === 'focus') {
        const mixer = useMixerStore.getState();
        const mix = mixer.roomMix ?? mixer.volumes;
        const sounds = mixer.playing ? Object.entries(mix).filter(([, v]) => (v ?? 0) > 0).map(([id]) => id) : [];
        const room = useTogetherStore.getState().roomId;
        useTimerStore.getState().recordSession({ endedAt: session.endedAt, minutes: session.minutes, entryId: session.entryId, sounds, room });
        if (session.entryId) {
          useLibraryStore.getState().addFocusLog(session.entryId, session.minutes, todayISO(), { sounds, room: room ?? undefined });
        }
      }
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [status, t]);

  return null;
}
