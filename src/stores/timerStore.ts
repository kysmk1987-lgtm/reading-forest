import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

export type TimerPhase = 'focus' | 'break';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export const TIMER_PRESETS = [
  { id: 'classic', focus: 25, break: 5 },
  { id: 'deep', focus: 50, break: 10 },
  { id: 'light', focus: 15, break: 3 },
] as const;

export type TimerPresetId = (typeof TIMER_PRESETS)[number]['id'] | 'custom';

export interface FinishedSession {
  phase: TimerPhase;
  minutes: number;
  entryId: string | null;
  endedAt: number;
}

/** A finished focus session (for 독서 결산: time of day, sounds, rooms — kept even without a linked book). */
export interface FocusSessionRecord {
  endedAt: number;
  minutes: number;
  entryId: string | null;
  sounds: string[];
  room: string | null;
}

const HISTORY_LIMIT = 2000;

interface TimerState {
  presetId: TimerPresetId;
  focusMin: number;
  breakMin: number;
  phase: TimerPhase;
  status: TimerStatus;
  /** Wall-clock end time while running — remaining time is always derived from it, so backgrounding is safe. */
  endsAt: number | null;
  /** Remaining time while paused/idle. */
  remainingMs: number;
  entryId: string | null;
  lastSession: FinishedSession | null;
  today: { day: string; sessions: number; minutes: number };
  history: FocusSessionRecord[];

  recordSession: (record: FocusSessionRecord) => void;
  setPreset: (id: TimerPresetId, custom?: { focus: number; break: number }) => void;
  setPhase: (phase: TimerPhase) => void;
  linkEntry: (entryId: string | null) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  /** Called by the watcher when `endsAt` has passed; returns the finished session (or null if not running). */
  finish: (now: number, day: string) => FinishedSession | null;
  clearLastSession: () => void;
}

const minutesOf = (s: Pick<TimerState, 'phase' | 'focusMin' | 'breakMin'>) => (s.phase === 'focus' ? s.focusMin : s.breakMin);
const clampMin = (n: number) => Math.max(1, Math.min(180, Math.round(n)));

export function remainingMsOf(s: Pick<TimerState, 'status' | 'endsAt' | 'remainingMs'>, now = Date.now()) {
  return s.status === 'running' && s.endsAt ? Math.max(0, s.endsAt - now) : s.remainingMs;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      presetId: 'classic',
      focusMin: 25,
      breakMin: 5,
      phase: 'focus',
      status: 'idle',
      endsAt: null,
      remainingMs: 25 * 60_000,
      entryId: null,
      lastSession: null,
      today: { day: '', sessions: 0, minutes: 0 },
      history: [],

      recordSession: (record) => set((s) => ({ history: [...s.history, record].slice(-HISTORY_LIMIT) })),
      setPreset: (id, custom) => {
        const preset = TIMER_PRESETS.find((p) => p.id === id);
        const focusMin = clampMin(preset?.focus ?? custom?.focus ?? get().focusMin);
        const breakMin = clampMin(preset?.break ?? custom?.break ?? get().breakMin);
        set((s) => ({
          presetId: id,
          focusMin,
          breakMin,
          status: 'idle',
          endsAt: null,
          remainingMs: (s.phase === 'focus' ? focusMin : breakMin) * 60_000,
        }));
      },
      setPhase: (phase) => set((s) => ({ phase, status: 'idle', endsAt: null, remainingMs: minutesOf({ ...s, phase }) * 60_000 })),
      linkEntry: (entryId) => set({ entryId }),
      start: () =>
        set((s) => {
          const remaining = s.status === 'paused' ? s.remainingMs : minutesOf(s) * 60_000;
          return { status: 'running', endsAt: Date.now() + remaining, remainingMs: remaining, lastSession: null };
        }),
      pause: () => set((s) => (s.status === 'running' ? { status: 'paused', remainingMs: remainingMsOf(s), endsAt: null } : s)),
      reset: () => set((s) => ({ status: 'idle', endsAt: null, remainingMs: minutesOf(s) * 60_000 })),
      finish: (now, day) => {
        const s = get();
        if (s.status !== 'running' || !s.endsAt || now < s.endsAt) return null;
        const session: FinishedSession = { phase: s.phase, minutes: minutesOf(s), entryId: s.entryId, endedAt: s.endsAt };
        const today = s.today.day === day ? s.today : { day, sessions: 0, minutes: 0 };
        set({
          status: 'done',
          endsAt: null,
          remainingMs: 0,
          lastSession: session,
          today:
            s.phase === 'focus'
              ? { day, sessions: today.sessions + 1, minutes: today.minutes + session.minutes }
              : today,
        });
        return session;
      },
      clearLastSession: () => set({ lastSession: null }),
    }),
    {
      name: 'rf-timer',
      storage: persistStorage,
      partialize: (s) => ({
        presetId: s.presetId,
        focusMin: s.focusMin,
        breakMin: s.breakMin,
        phase: s.phase,
        status: s.status,
        endsAt: s.endsAt,
        remainingMs: s.remainingMs,
        entryId: s.entryId,
        today: s.today,
        history: s.history,
      }),
    },
  ),
);
