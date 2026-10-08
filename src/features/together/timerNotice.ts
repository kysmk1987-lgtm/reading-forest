import type { TFunction } from 'i18next';

import { elapsedAt, phaseAt, upcomingBoundaries, type TimerRun } from './timerEngine';

/** What the platform layer should show for the current timer state (built once, rendered by native or web). */
export interface TimerNotice {
  ongoing: {
    title: string;
    /** Shown next to the live countdown (native module). */
    body: string;
    /** Shown when there is no live countdown ("15:00에 휴식"). */
    fallbackBody: string;
    /** Wall-clock end of the current phase for the countdown; null while paused. */
    countdownTo: number | null;
  };
  /** Upcoming phase changes as scheduled notifications. */
  alerts: { at: number; title: string; body: string }[];
  channelNames: { alerts: string; ongoing: string };
  color: string;
}

export function clockLabel(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timerChannelNames(t: TFunction) {
  return { alerts: t('together.timer.channelAlerts'), ongoing: t('together.timer.channelOngoing') };
}

export function buildTimerNotice(run: TimerRun, now: number, t: TFunction, bookTitle?: string): TimerNotice | null {
  if (run.status !== 'running' && run.status !== 'paused') return null;
  const info = phaseAt(run, elapsedAt(run, now));
  if (info.phase === 'done') return null;
  const endsAt = now + info.remainingMs;
  const cycle = info.totalCycles > 1 ? t('together.timer.cycleOf', { cycle: info.cycle, total: info.totalCycles }) : '';
  const phaseName = info.phase === 'focus' ? t('together.timer.focusing') : t('together.timer.resting');
  const paused = run.status === 'paused';
  const title = [paused ? `⏸ ${t('together.timer.paused')}` : info.phase === 'focus' ? `📖 ${phaseName}` : `🍵 ${phaseName}`, cycle]
    .filter(Boolean)
    .join(' · ');
  const nextKey = info.next === 'break' ? 'nextBreakAt' : info.next === 'focus' ? 'nextFocusAt' : 'nextDoneAt';
  const book = bookTitle ? ` · 「${bookTitle.slice(0, 18)}」` : '';
  const fallbackBody = paused
    ? t('together.timer.pausedLeft', { minutes: Math.ceil(info.remainingMs / 60_000) })
    : `${t(`together.timer.${nextKey}`, { time: clockLabel(endsAt) })}${book}`;
  const body = paused ? fallbackBody : `${t(`together.timer.${nextKey}`, { time: clockLabel(endsAt) })}${book}`;

  const alerts = upcomingBoundaries(run, now, 6).map((b, i, all) => {
    const following = all[i + 1];
    if (b.starts === 'break') {
      return {
        at: b.at,
        title: t('together.timer.alertBreakTitle'),
        body: following
          ? following.starts === 'done'
            ? t('together.timer.alertBreakBodyLast', { time: clockLabel(following.at) })
            : t('together.timer.alertBreakBody', { time: clockLabel(following.at) })
          : t('together.timer.alertBreakBodyShort'),
      };
    }
    if (b.starts === 'focus') return { at: b.at, title: t('together.timer.alertFocusTitle'), body: t('together.timer.alertFocusBody', { cycle: b.cycle }) };
    return { at: b.at, title: t('together.timer.alertDoneTitle'), body: t('together.timer.alertDoneBody') };
  });

  return {
    ongoing: { title, body, fallbackBody, countdownTo: paused ? null : endsAt },
    alerts: paused ? [] : alerts,
    channelNames: timerChannelNames(t),
    color: '#5FA85A',
  };
}

/** Browser tab title while the timer runs, e.g. "⏱ 12:34 집중 · 독서의숲". */
export function timerTitleText(run: TimerRun, now: number, t: TFunction) {
  if (run.status !== 'running' && run.status !== 'paused') return null;
  const info = phaseAt(run, elapsedAt(run, now));
  if (info.phase === 'done') return null;
  const total = Math.ceil(info.remainingMs / 1000);
  const clock = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  const icon = run.status === 'paused' ? '⏸' : info.phase === 'focus' ? '📖' : '🍵';
  return `${icon} ${clock} ${info.phase === 'focus' ? t('together.timer.focus') : t('together.timer.break')} · ${t('common.appName')}`;
}
