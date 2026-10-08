import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  advanceRun,
  idleRun,
  pauseRun,
  resumeRun,
  startRun,
  type AdvanceResult,
  type TimerPlan,
  type TimerRun,
} from '@/features/together/timerEngine';
import { persistStorage } from '@/lib/storage';

export const TIMER_PRESETS = [
  { id: 'classic', focus: 25, break: 5 },
  { id: 'deep', focus: 50, break: 10 },
  { id: 'light', focus: 15, break: 3 },
] as const;

export type TimerPresetId = (typeof TIMER_PRESETS)[number]['id'] | 'custom';

/** A finished focus session (for 독서 결산: time of day, sounds, rooms — kept even without a linked book). */
export interface FocusSessionRecord {
  endedAt: number;
  minutes: number;
  entryId: string | null;
  sounds: string[];
  room: string | null;
}

/** Summary shown when a run ends (all cycles done). */
export interface FinishedRun {
  focusMinutes: number;
  cycles: number;
  entryId: string | null;
  endedAt: number;
}

const HISTORY_LIMIT = 2000;

interface TimerState {
  presetId: TimerPresetId;
  focusMin: number;
  breakMin: number;
  repeat: boolean;
  run: TimerRun;
  /** Focus minutes logged during the current run (shown on the finish card). */
  runFocusMinutes: number;
  entryId: string | null;
  lastRun: FinishedRun | null;
  today: { day: string; sessions: number; minutes: number };
  history: FocusSessionRecord[];
  /** Set by "이 책 읽기" on the book screen: the timer tab opens with this book chosen and 시작 highlighted (not persisted). */
  readingIntent: { entryId: string; at: number } | null;

  setPreset: (id: TimerPresetId, custom?: { focus: number; break: number }) => void;
  /** Returns false when the change only applies to the next run. */
  setRepeat: (repeat: boolean) => boolean;
  linkEntry: (entryId: string | null) => void;
  requestReading: (entryId: string) => void;
  clearReadingIntent: () => void;
  start: (now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  reset: () => void;
  /** Advances the running run to `now` (called by the watcher); the caller logs `newFocus` sessions. */
  tick: (now: number) => AdvanceResult;
  /** Counts a logged focus session in today's stats + history. */
  recordFocus: (record: FocusSessionRecord, day: string) => void;
  clearLastRun: () => void;
}

const clampMin = (n: number) => Math.max(1, Math.min(180, Math.round(n)));

export function planOf(s: Pick<TimerState, 'focusMin' | 'breakMin' | 'repeat'>): TimerPlan {
  return { focusMs: s.focusMin * 60_000, breakMs: s.breakMin * 60_000, repeat: s.repeat };
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      presetId: 'classic',
      focusMin: 25,
      breakMin: 5,
      repeat: false,
      run: idleRun({ focusMs: 25 * 60_000, breakMs: 5 * 60_000, repeat: false }),
      runFocusMinutes: 0,
      entryId: null,
      lastRun: null,
      today: { day: '', sessions: 0, minutes: 0 },
      history: [],
      readingIntent: null,

      setPreset: (id, custom) => {
        if (get().run.status === 'running' || get().run.status === 'paused') return;
        const preset = TIMER_PRESETS.find((p) => p.id === id);
        const focusMin = clampMin(preset?.focus ?? custom?.focus ?? get().focusMin);
        const breakMin = clampMin(preset?.break ?? custom?.break ?? get().breakMin);
        set((s) => ({ presetId: id, focusMin, breakMin, run: idleRun(planOf({ focusMin, breakMin, repeat: s.repeat })), lastRun: null }));
      },
      setRepeat: (repeat) => {
        const { run } = get();
        if (run.status === 'idle' || run.status === 'done') {
          set((s) => ({ repeat, run: idleRun(planOf({ ...s, repeat })) }));
          return true;
        }
        // Mid-run: turning 반복 on extends the run; turning it off only works while still in the first cycle.
        const elapsed = run.status === 'running' && run.anchorAt !== null ? Date.now() - run.anchorAt : run.elapsedMs;
        if (repeat || elapsed < run.focusMs + run.breakMs) {
          set({ repeat, run: { ...run, repeat } });
          return true;
        }
        set({ repeat });
        return false;
      },
      linkEntry: (entryId) => set({ entryId }),
      requestReading: (entryId) => set({ entryId, readingIntent: { entryId, at: Date.now() } }),
      clearReadingIntent: () => set({ readingIntent: null }),
      start: (now = Date.now()) => set((s) => ({ run: startRun(planOf(s), now), runFocusMinutes: 0, lastRun: null })),
      pause: (now = Date.now()) => set((s) => ({ run: pauseRun(s.run, now) })),
      resume: (now = Date.now()) => set((s) => ({ run: resumeRun(s.run, now) })),
      reset: () => set((s) => ({ run: idleRun(planOf(s)), runFocusMinutes: 0 })),
      tick: (now) => {
        const s = get();
        const result = advanceRun(s.run, now);
        // Only persist when something happened (an event, a finished focus, the end) — not on every 1-second tick.
        if (result.events.length || result.newFocus || result.run.status !== s.run.status) {
          const finished = result.run.status === 'done';
          set({
            run: result.run,
            lastRun: finished
              ? {
                  focusMinutes: s.runFocusMinutes + result.newFocus * Math.round(s.run.focusMs / 60_000),
                  cycles: result.run.loggedFocus,
                  entryId: s.entryId,
                  endedAt: now,
                }
              : s.lastRun,
          });
        }
        return result;
      },
      recordFocus: (record, day) =>
        set((s) => {
          const today = s.today.day === day ? s.today : { day, sessions: 0, minutes: 0 };
          return {
            history: [...s.history, record].slice(-HISTORY_LIMIT),
            today: { day, sessions: today.sessions + 1, minutes: today.minutes + record.minutes },
            runFocusMinutes: s.runFocusMinutes + record.minutes,
          };
        }),
      clearLastRun: () => set({ lastRun: null }),
    }),
    {
      name: 'rf-timer',
      storage: persistStorage,
      version: 1,
      // v0 kept a single phase countdown (`phase`/`endsAt`); start over with an idle cycle run.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as Partial<TimerState>;
        const focusMin = clampMin(old.focusMin ?? 25);
        const breakMin = clampMin(old.breakMin ?? 5);
        return {
          presetId: old.presetId ?? 'classic',
          focusMin,
          breakMin,
          repeat: false,
          run: idleRun(planOf({ focusMin, breakMin, repeat: false })),
          runFocusMinutes: 0,
          entryId: old.entryId ?? null,
          today: old.today ?? { day: '', sessions: 0, minutes: 0 },
          history: old.history ?? [],
        } as unknown as TimerState;
      },
      partialize: (s) => ({
        presetId: s.presetId,
        focusMin: s.focusMin,
        breakMin: s.breakMin,
        repeat: s.repeat,
        run: s.run,
        runFocusMinutes: s.runFocusMinutes,
        entryId: s.entryId,
        today: s.today,
        history: s.history,
      }),
    },
  ),
);
