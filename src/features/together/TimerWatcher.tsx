import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { alarmFeedback, phaseFeedback, preAlertFeedback } from '@/lib/feedback';
import { useLibraryStore } from '@/stores/libraryStore';
import { hasAnySound, useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';

import { logFocusMinutes, syncTimerSound } from './timerActions';
import { audibleEvents } from './timerEngine';
import { useTimerClock } from './TimerRing';
import { buildTimerNotice, timerChannelNames, timerTitleText } from './timerNotice';
import { prepareTimerNotifications, setTimerTitle, showPhaseNotice, syncTimerNotifications } from './timerNotify';

/**
 * Mount once at the root. Every second (and as soon as the app returns to the foreground) it recomputes the run from
 * its start timestamp, logs finished focus phases, rings the 5-second heads-up / phase bells, keeps the ambient sound
 * in step and mirrors the timer to notifications (native) or the tab title (web).
 */
export function TimerWatcher() {
  const { t } = useTranslation();
  const { run, info } = useTimerClock();
  const entryId = useTimerStore((s) => s.entryId);
  const bookTitle = useLibraryStore((s) => (entryId ? s.entries[entryId]?.book.title : undefined));
  const withTimer = useMixerStore((s) => s.withTimer);
  const duringBreak = useMixerStore((s) => s.duringBreak);
  const anySound = useMixerStore((s) => hasAnySound(s.volumes));
  const status = run.status;
  const phase = info.phase;

  useEffect(() => {
    if (status !== 'running') return;
    const check = () => {
      const result = useTimerStore.getState().tick(Date.now());
      const focusMin = Math.round(result.run.focusMs / 60_000);
      for (let i = 0; i < result.newFocus; i++) logFocusMinutes(focusMin);
      for (const e of audibleEvents(result.events, result.clockMs)) {
        if (e.kind === 'preBreak' || e.kind === 'preFocus' || e.kind === 'preDone') {
          preAlertFeedback();
        } else if (e.kind === 'done') {
          alarmFeedback();
          showPhaseNotice(t('together.timer.alertDoneTitle'), t('together.timer.alertDoneBody'));
        } else {
          phaseFeedback(e.kind);
          showPhaseNotice(
            e.kind === 'break' ? t('together.timer.alertBreakTitle') : t('together.timer.alertFocusTitle'),
            e.kind === 'break' ? t('together.timer.alertBreakBodyShort') : t('together.timer.alertFocusBody', { cycle: e.cycle }),
          );
        }
      }
    };
    check();
    const timer = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [status, t]);

  useEffect(() => {
    syncTimerSound(status, phase);
  }, [status, phase, withTimer, duringBreak, anySound]);

  // Notifications: re-planned at start/pause/resume and every phase change (not every second).
  const noticeKey = `${status}|${run.anchorAt}|${run.elapsedMs}|${phase}|${info.cycle}|${run.repeat}|${bookTitle ?? ''}`;
  useEffect(() => {
    const current = useTimerStore.getState().run;
    if (current.status === 'running' || current.status === 'paused') prepareTimerNotifications(timerChannelNames(t), false).catch(() => {});
    syncTimerNotifications(buildTimerNotice(current, Date.now(), t, bookTitle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeKey]);

  // Web: countdown in the tab title.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (status !== 'running' && status !== 'paused') {
      setTimerTitle(null);
      return;
    }
    const update = () => setTimerTitle(timerTitleText(useTimerStore.getState().run, Date.now(), t));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [status, t]);

  useEffect(() => () => setTimerTitle(null), []);

  return null;
}
