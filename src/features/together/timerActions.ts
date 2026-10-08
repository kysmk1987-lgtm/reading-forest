import i18n from '@/lib/i18n';
import { todayISO } from '@/lib/date';
import { useLibraryStore } from '@/stores/libraryStore';
import { hasAnySound, useMixerStore } from '@/stores/mixerStore';
import { useTimerStore } from '@/stores/timerStore';
import { useTogetherStore } from '@/stores/togetherStore';

import { reportRoomMinutes } from './roomRanking';
import { elapsedAt, partialFocusMinutes, phaseAt } from './timerEngine';
import { timerChannelNames } from './timerNotice';
import { prepareTimerNotifications } from './timerNotify';

/**
 * Timer actions shared by the timer tab, reading rooms and the watcher. 시작/계속 run inside the tap so the ambient
 * sound may start (browser autoplay rules) and the notification permission prompt has context.
 */

/** Logs finished focus minutes: today's stats + history, the linked book's reading log (calendar) and the room ranking. */
export function logFocusMinutes(minutes: number) {
  if (minutes <= 0) return;
  const timer = useTimerStore.getState();
  const mixer = useMixerStore.getState();
  const mix = mixer.roomMix ?? mixer.volumes;
  const sounds = mixer.playing ? Object.entries(mix).filter(([, v]) => (v ?? 0) > 0).map(([id]) => id) : [];
  const room = useTogetherStore.getState().roomId;
  const day = todayISO();
  timer.recordFocus({ endedAt: Date.now(), minutes, entryId: timer.entryId, sounds, room }, day);
  if (timer.entryId) useLibraryStore.getState().addFocusLog(timer.entryId, minutes, day, { sounds, room: room ?? undefined });
  if (room) reportRoomMinutes(room, minutes).catch(() => {});
}

/** Starts the timer's ambient sound from a tap. Returns false when the browser still blocks audio. */
function startSoundFromTap() {
  const mixer = useMixerStore.getState();
  if (mixer.owner === 'muted') mixer.setOwner(null);
  if (!mixer.withTimer || mixer.roomMix || !hasAnySound(mixer.volumes)) return Promise.resolve(true);
  if (mixer.playing) {
    mixer.setOwner('timer');
    return Promise.resolve(true);
  }
  return mixer.play('timer');
}

export function startTimer() {
  useTimerStore.getState().start();
  prepareTimerNotifications(timerChannelNames(i18n.t)).catch(() => {});
  return startSoundFromTap();
}

export function resumeTimer() {
  useTimerStore.getState().resume();
  const { run } = useTimerStore.getState();
  const info = phaseAt(run, elapsedAt(run, Date.now()));
  if (info.phase === 'focus' || useMixerStore.getState().duringBreak) return startSoundFromTap();
  return Promise.resolve(true);
}

export function pauseTimer() {
  useTimerStore.getState().pause();
}

/** 처음으로: stops the run; whole minutes of an unfinished focus phase still count as reading. Returns them. */
export function resetTimer() {
  const { run } = useTimerStore.getState();
  const partial = partialFocusMinutes(run, Date.now());
  useTimerStore.getState().reset();
  if (partial > 0) logFocusMinutes(partial);
  return partial;
}

/**
 * Keeps the ambient sound in step with the timer: plays during focus (and breaks when 휴식 때도 소리 재생 is on),
 * pauses for breaks / a paused timer, stops when the run ends. Rooms keep their own mix.
 */
export function syncTimerSound(status: string, phase: 'focus' | 'break' | 'done') {
  const m = useMixerStore.getState();
  if (m.roomMix || m.owner === 'room') return;
  const active = status === 'running' || status === 'paused';
  const wanted = status === 'running' && (phase === 'focus' || (phase === 'break' && m.duringBreak)) && m.withTimer && hasAnySound(m.volumes);
  if (wanted) {
    if (!m.playing && (m.owner === null || m.owner === 'timer')) m.play('timer').catch(() => {});
    else if (m.playing && m.owner === 'user') m.setOwner('timer');
    return;
  }
  if (m.owner === 'timer') {
    if (active) {
      if (m.playing) m.suspend();
    } else m.stop();
  } else if (m.owner === 'muted' && !active) {
    m.setOwner(null);
  }
}
