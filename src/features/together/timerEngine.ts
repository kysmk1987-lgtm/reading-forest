/**
 * Pure focus/break cycle engine (no React, no timers) so it can be unit tested and recomputed from wall-clock
 * timestamps at any moment: JS timers stop while the app is in the background, so nothing here counts ticks.
 *
 * A run is one or more cycles of `focus → break`. Without 반복 it is exactly one cycle (e.g. 25 + 5 = 30 min) and then
 * stops; with 반복 the cycle repeats up to `REPEAT_CYCLES` times (a safety stop for a forgotten timer).
 */

export type RunStatus = 'idle' | 'running' | 'paused' | 'done';
export type Phase = 'focus' | 'break';

export const PRE_ALERT_MS = 5_000;
export const REPEAT_CYCLES = 12;
/** Events older than this when finally processed (e.g. the app was in the background) stay silent. */
export const STALE_EVENT_MS = 3_000;

export interface TimerPlan {
  focusMs: number;
  breakMs: number;
  repeat: boolean;
}

export interface TimerRun extends TimerPlan {
  status: RunStatus;
  /** While running: the wall-clock time at which elapsed time was 0 (shifted on resume), so elapsed = now − anchorAt. */
  anchorAt: number | null;
  /** Elapsed run time when paused/done, and the last processed elapsed time while running. */
  elapsedMs: number;
  /** Focus phases already written to the reading log. */
  loggedFocus: number;
}

export interface PhaseInfo {
  phase: Phase | 'done';
  /** 1-based cycle number. */
  cycle: number;
  totalCycles: number;
  phaseMs: number;
  phaseElapsedMs: number;
  remainingMs: number;
  /** What starts when this phase ends. */
  next: Phase | 'done';
}

export type TimerEventKind = 'preBreak' | 'preFocus' | 'preDone' | 'break' | 'focus' | 'done';

export interface TimerEvent {
  kind: TimerEventKind;
  /** Elapsed run time at which the event happens. */
  at: number;
  cycle: number;
}

export function totalCycles(plan: TimerPlan) {
  return plan.repeat ? REPEAT_CYCLES : 1;
}

export function cycleMs(plan: TimerPlan) {
  return plan.focusMs + plan.breakMs;
}

export function runLengthMs(plan: TimerPlan) {
  return cycleMs(plan) * totalCycles(plan);
}

export function idleRun(plan: TimerPlan): TimerRun {
  return { ...plan, status: 'idle', anchorAt: null, elapsedMs: 0, loggedFocus: 0 };
}

export function elapsedAt(run: TimerRun, now: number) {
  if (run.status === 'running' && run.anchorAt !== null) return Math.min(runLengthMs(run), Math.max(0, now - run.anchorAt));
  return run.elapsedMs;
}

export function phaseAt(plan: TimerPlan, elapsed: number): PhaseInfo {
  const cycles = totalCycles(plan);
  const len = cycleMs(plan);
  if (elapsed >= len * cycles) {
    return { phase: 'done', cycle: cycles, totalCycles: cycles, phaseMs: 0, phaseElapsedMs: 0, remainingMs: 0, next: 'done' };
  }
  const index = Math.floor(Math.max(0, elapsed) / len);
  const inCycle = elapsed - index * len;
  const last = index === cycles - 1;
  if (inCycle < plan.focusMs) {
    return {
      phase: 'focus',
      cycle: index + 1,
      totalCycles: cycles,
      phaseMs: plan.focusMs,
      phaseElapsedMs: inCycle,
      remainingMs: plan.focusMs - inCycle,
      next: 'break',
    };
  }
  return {
    phase: 'break',
    cycle: index + 1,
    totalCycles: cycles,
    phaseMs: plan.breakMs,
    phaseElapsedMs: inCycle - plan.focusMs,
    remainingMs: len - inCycle,
    next: last ? 'done' : 'focus',
  };
}

/** Focus phases fully finished by `elapsed`. */
export function completedFocusAt(plan: TimerPlan, elapsed: number) {
  const len = cycleMs(plan);
  const cycles = totalCycles(plan);
  const full = Math.floor(elapsed / len);
  if (full >= cycles) return cycles;
  return full + (elapsed - full * len >= plan.focusMs ? 1 : 0);
}

/** The 5-second warning shown before a phase ends (null when none is due). */
export function preAlertAt(plan: TimerPlan, elapsed: number): { next: Phase | 'done'; seconds: number } | null {
  const info = phaseAt(plan, elapsed);
  if (info.phase === 'done' || info.phaseMs <= PRE_ALERT_MS || info.remainingMs > PRE_ALERT_MS) return null;
  return { next: info.next, seconds: Math.max(1, Math.ceil(info.remainingMs / 1000)) };
}

/** Every event with `from < at <= to`, in order. */
export function eventsBetween(plan: TimerPlan, from: number, to: number): TimerEvent[] {
  const out: TimerEvent[] = [];
  if (to <= from) return out;
  const len = cycleMs(plan);
  const cycles = totalCycles(plan);
  const first = Math.max(0, Math.floor(from / len));
  const lastCycle = Math.min(cycles - 1, Math.floor(to / len));
  for (let i = first; i <= lastCycle; i++) {
    const start = i * len;
    const focusEnd = start + plan.focusMs;
    const breakEnd = start + len;
    const final = i === cycles - 1;
    const candidates: TimerEvent[] = [];
    if (plan.focusMs > PRE_ALERT_MS) candidates.push({ kind: 'preBreak', at: focusEnd - PRE_ALERT_MS, cycle: i + 1 });
    candidates.push({ kind: 'break', at: focusEnd, cycle: i + 1 });
    if (plan.breakMs > PRE_ALERT_MS) candidates.push({ kind: final ? 'preDone' : 'preFocus', at: breakEnd - PRE_ALERT_MS, cycle: i + 1 });
    candidates.push({ kind: final ? 'done' : 'focus', at: breakEnd, cycle: final ? i + 1 : i + 2 });
    for (const e of candidates) if (e.at > from && e.at <= to) out.push(e);
  }
  return out;
}

/**
 * Of the events processed in one step, only the newest pre-alert / phase change that is still fresh should make a sound
 * (after a long background stretch we don't want a burst of stale chimes).
 */
export function audibleEvents(events: TimerEvent[], elapsed: number, staleMs = STALE_EVENT_MS): TimerEvent[] {
  const fresh = events.filter((e) => elapsed - e.at <= staleMs);
  const lastPhase = [...fresh].reverse().find((e) => e.kind === 'break' || e.kind === 'focus' || e.kind === 'done');
  const lastPre = [...fresh].reverse().find((e) => e.kind.startsWith('pre'));
  const out: TimerEvent[] = [];
  // A pre-alert that was overtaken by its own phase change is pointless.
  if (lastPre && (!lastPhase || lastPre.at > lastPhase.at)) out.push(lastPre);
  if (lastPhase) out.unshift(lastPhase);
  return out.sort((a, b) => a.at - b.at);
}

export function startRun(plan: TimerPlan, now: number): TimerRun {
  return { ...plan, status: 'running', anchorAt: now, elapsedMs: 0, loggedFocus: 0 };
}

export function pauseRun(run: TimerRun, now: number): TimerRun {
  if (run.status !== 'running') return run;
  return { ...run, status: 'paused', anchorAt: null, elapsedMs: elapsedAt(run, now) };
}

export function resumeRun(run: TimerRun, now: number): TimerRun {
  if (run.status !== 'paused') return run;
  return { ...run, status: 'running', anchorAt: now - run.elapsedMs };
}

export interface AdvanceResult {
  run: TimerRun;
  events: TimerEvent[];
  /** Focus phases finished since the last step (to be logged). */
  newFocus: number;
  /** Uncapped elapsed wall-clock time (past the end of the run too), to tell fresh events from stale ones. */
  clockMs: number;
}

/** Moves a running run forward to `now`: collects the events in between and finishes it at the end of the last cycle. */
export function advanceRun(run: TimerRun, now: number): AdvanceResult {
  if (run.status !== 'running' || run.anchorAt === null) return { run, events: [], newFocus: 0, clockMs: run.elapsedMs };
  const clockMs = Math.max(0, now - run.anchorAt);
  const elapsed = elapsedAt(run, now);
  const events = eventsBetween(run, run.elapsedMs, elapsed);
  const completed = completedFocusAt(run, elapsed);
  const newFocus = Math.max(0, completed - run.loggedFocus);
  const done = elapsed >= runLengthMs(run);
  return {
    run: { ...run, elapsedMs: elapsed, loggedFocus: run.loggedFocus + newFocus, status: done ? 'done' : 'running', anchorAt: done ? null : run.anchorAt },
    events,
    newFocus,
    clockMs,
  };
}

/** Whole minutes of an unfinished focus phase (logged when the user stops early with 처음으로). */
export function partialFocusMinutes(run: TimerRun, now: number) {
  if (run.status !== 'running' && run.status !== 'paused') return 0;
  const info = phaseAt(run, elapsedAt(run, now));
  return info.phase === 'focus' ? Math.floor(info.phaseElapsedMs / 60_000) : 0;
}

export interface Boundary {
  /** Wall-clock time. */
  at: number;
  /** Phase that starts there. */
  starts: Phase | 'done';
  cycle: number;
}

/** The next phase changes of a running run as wall-clock times (for scheduled notifications). */
export function upcomingBoundaries(run: TimerRun, now: number, limit = 6): Boundary[] {
  if (run.status !== 'running' || run.anchorAt === null) return [];
  const elapsed = elapsedAt(run, now);
  return eventsBetween(run, elapsed, runLengthMs(run))
    .filter((e) => e.kind === 'break' || e.kind === 'focus' || e.kind === 'done')
    .slice(0, limit)
    .map((e) => ({ at: run.anchorAt! + e.at, starts: e.kind as Phase | 'done', cycle: e.cycle }));
}

/** When the current focus phase began (wall clock), for others to count my live minutes. */
export function focusStartedAt(run: TimerRun, now: number): number | null {
  if (run.status !== 'running' || run.anchorAt === null) return null;
  const info = phaseAt(run, elapsedAt(run, now));
  return info.phase === 'focus' ? now - info.phaseElapsedMs : null;
}
