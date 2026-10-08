/**
 * Offline tests for the focus/break cycle engine (함께 읽기 타이머) and the reading-room leaderboard.
 * Run: npm run test:timer
 */
import assert from 'node:assert/strict';

import {
  advanceRun,
  audibleEvents,
  completedFocusAt,
  elapsedAt,
  eventsBetween,
  focusStartedAt,
  idleRun,
  partialFocusMinutes,
  pauseRun,
  phaseAt,
  preAlertAt,
  REPEAT_CYCLES,
  resumeRun,
  startRun,
  upcomingBoundaries,
  type TimerPlan,
} from '../src/features/together/timerEngine';
import { buildLeaderboard, roomMinutesOn } from '../src/features/together/leaderboard';

const MIN = 60_000;
const SEC = 1_000;
const once: TimerPlan = { focusMs: 25 * MIN, breakMs: 5 * MIN, repeat: false };
const loop: TimerPlan = { ...once, repeat: true };

// ── phases of one cycle: 25 min focus → 5 min break → done (30 min total) ──
{
  const a = phaseAt(once, 0);
  assert.equal(a.phase, 'focus');
  assert.equal(a.cycle, 1);
  assert.equal(a.remainingMs, 25 * MIN);
  assert.equal(a.next, 'break');
  const b = phaseAt(once, 25 * MIN);
  assert.equal(b.phase, 'break');
  assert.equal(b.remainingMs, 5 * MIN);
  assert.equal(b.next, 'done', 'without 반복 the break is the last phase');
  assert.equal(phaseAt(once, 30 * MIN).phase, 'done');
  assert.equal(phaseAt(once, 99 * MIN).phase, 'done');
  assert.equal(completedFocusAt(once, 24 * MIN), 0);
  assert.equal(completedFocusAt(once, 25 * MIN), 1);
  assert.equal(completedFocusAt(once, 90 * MIN), 1);
}

// ── 반복: the cycle repeats (focus → break → focus …) up to REPEAT_CYCLES ──
{
  const c = phaseAt(loop, 30 * MIN);
  assert.equal(c.phase, 'focus');
  assert.equal(c.cycle, 2);
  assert.equal(phaseAt(loop, 25 * MIN).next, 'focus');
  assert.equal(phaseAt(loop, 61 * MIN).cycle, 3);
  assert.equal(completedFocusAt(loop, 61 * MIN), 2);
  const end = 30 * MIN * REPEAT_CYCLES;
  assert.equal(phaseAt(loop, end - 1).next, 'done', 'the last repeated break ends the run');
  assert.equal(phaseAt(loop, end).phase, 'done');
  assert.equal(completedFocusAt(loop, end + 5 * MIN), REPEAT_CYCLES);
}

// ── events and 5-second pre-alerts ──
{
  const all = eventsBetween(once, 0, 30 * MIN).map((e) => `${e.kind}@${e.at / SEC}`);
  assert.deepEqual(all, ['preBreak@1495', 'break@1500', 'preDone@1795', 'done@1800']);
  const loopEvents = eventsBetween(loop, 0, 31 * MIN).map((e) => `${e.kind}#${e.cycle}`);
  assert.deepEqual(loopEvents, ['preBreak#1', 'break#1', 'preFocus#1', 'focus#2']);
  // half-open interval (from, to]: an event exactly at `from` is not repeated
  assert.deepEqual(eventsBetween(once, 25 * MIN, 26 * MIN), []);
  assert.deepEqual(eventsBetween(once, 10 * MIN, 10 * MIN), []);

  assert.equal(preAlertAt(once, 25 * MIN - 6 * SEC), null);
  assert.deepEqual(preAlertAt(once, 25 * MIN - 5 * SEC), { next: 'break', seconds: 5 });
  assert.deepEqual(preAlertAt(once, 25 * MIN - 1200), { next: 'break', seconds: 2 });
  assert.deepEqual(preAlertAt(loop, 30 * MIN - 3 * SEC), { next: 'focus', seconds: 3 });
  assert.deepEqual(preAlertAt(once, 30 * MIN - 3 * SEC), { next: 'done', seconds: 3 });
  assert.equal(preAlertAt(once, 30 * MIN), null);
}

// ── run lifecycle: start → tick → pause/resume → done ──
{
  const t0 = 1_000_000;
  let run = startRun(once, t0);
  assert.equal(run.status, 'running');
  assert.equal(elapsedAt(run, t0 + 10 * MIN), 10 * MIN);

  let step = advanceRun(run, t0 + 24 * MIN + 56 * SEC);
  assert.deepEqual(step.events.map((e) => e.kind), ['preBreak']);
  assert.equal(step.newFocus, 0);
  run = step.run;

  step = advanceRun(run, t0 + 25 * MIN + 1 * SEC);
  assert.deepEqual(step.events.map((e) => e.kind), ['break']);
  assert.equal(step.newFocus, 1, 'focus minutes are logged when the focus phase ends');
  run = step.run;
  assert.equal(advanceRun(run, t0 + 25 * MIN + 2 * SEC).newFocus, 0, 'never logged twice');

  // pause for 10 minutes during the break: time stands still
  run = pauseRun(run, t0 + 26 * MIN);
  assert.equal(run.status, 'paused');
  assert.equal(elapsedAt(run, t0 + 36 * MIN), 26 * MIN);
  assert.equal(advanceRun(run, t0 + 99 * MIN).events.length, 0, 'a paused run does not advance');
  run = resumeRun(run, t0 + 36 * MIN);
  assert.equal(elapsedAt(run, t0 + 36 * MIN), 26 * MIN);

  step = advanceRun(run, t0 + 40 * MIN + 1);
  assert.equal(step.run.status, 'done');
  assert.deepEqual(step.events.map((e) => e.kind), ['preDone', 'done']);
  assert.equal(step.run.anchorAt, null);
}

// ── background resume: the app was suspended for a long time ──
{
  const t0 = 5_000_000;
  const run = startRun(loop, t0);
  // Came back 70 minutes later (JS timers were frozen): cycles 1 and 2 finished, now in cycle 3's focus.
  const now = t0 + 70 * MIN;
  const step = advanceRun(run, now);
  assert.equal(step.newFocus, 2, 'both finished focus phases are logged after resuming');
  assert.equal(phaseAt(step.run, step.run.elapsedMs).cycle, 3);
  assert.equal(audibleEvents(step.events, step.clockMs).length, 0, 'stale chimes stay silent');
  // Came back just after a phase change: that one still rings, the overtaken pre-alert does not.
  const step2 = advanceRun(startRun(loop, t0), t0 + 25 * MIN + 1 * SEC);
  assert.deepEqual(audibleEvents(step2.events, step2.clockMs).map((e) => e.kind), ['break']);
  // A finished one-cycle run that is reopened the next day: logged once and done, silently.
  const step3 = advanceRun(startRun(once, t0), t0 + 24 * 60 * MIN);
  assert.equal(step3.run.status, 'done');
  assert.equal(step3.newFocus, 1);
  assert.equal(step3.run.elapsedMs, 30 * MIN, 'elapsed stops at the end of the run');
  assert.equal(audibleEvents(step3.events, step3.clockMs).length, 0);
  // The normal 1-second tick right at the end still rings.
  const step4 = advanceRun({ ...startRun(once, t0), elapsedMs: 30 * MIN - 1 * SEC }, t0 + 30 * MIN + 400);
  assert.deepEqual(audibleEvents(step4.events, step4.clockMs).map((e) => e.kind), ['done']);
  // Persisted state survives a restart: a JSON round-trip keeps the timestamps.
  const restored = JSON.parse(JSON.stringify(startRun(once, t0)));
  assert.equal(phaseAt(restored, elapsedAt(restored, t0 + 26 * MIN)).phase, 'break');
}

// ── partial focus (처음으로 mid-focus), boundaries for notifications, live focus start ──
{
  const t0 = 9_000_000;
  const run = startRun(once, t0);
  assert.equal(partialFocusMinutes(run, t0 + 12 * MIN + 30 * SEC), 12);
  assert.equal(partialFocusMinutes(run, t0 + 27 * MIN), 0, 'break time is never logged');
  assert.equal(partialFocusMinutes(idleRun(once), t0), 0);

  const b = upcomingBoundaries(run, t0 + MIN);
  assert.deepEqual(
    b.map((x) => [x.starts, (x.at - t0) / MIN]),
    [
      ['break', 25],
      ['done', 30],
    ],
  );
  assert.equal(upcomingBoundaries(startRun(loop, t0), t0, 4).length, 4);
  assert.deepEqual(upcomingBoundaries(pauseRun(run, t0 + MIN), t0 + MIN), []);

  assert.equal(focusStartedAt(run, t0 + 3 * MIN), t0);
  assert.equal(focusStartedAt(run, t0 + 26 * MIN), null);
  assert.equal(focusStartedAt(startRun(loop, t0), t0 + 31 * MIN), t0 + 30 * MIN);
}

// ── reading-room leaderboard: server rows + live presence ──
{
  const now = 50_000_000;
  const board = buildLeaderboard({
    now,
    rows: [
      { player: 'aaa', nickname: '솔방울', minutes: 40, isMe: false },
      { player: 'me1', nickname: '나', minutes: 20, isMe: true },
      { player: 'ccc', nickname: '책벌레', minutes: 5, isMe: false },
    ],
    peers: [
      // 책벌레 is reading right now: 5 logged + 30 live minutes
      { key: 'p1', self: false, token: 'ccc', nickname: '책벌레', phase: 'focus', since: now - 30 * MIN, todayMin: 5 },
      // someone without a server row (migration not applied for them / first session)
      { key: 'p2', self: false, nickname: '새벽독서', phase: 'break', todayMin: 12 },
      { key: 'p3', self: true, token: 'me1', nickname: '나', phase: 'focus', since: now - 3 * MIN, todayMin: 20 },
    ],
  });
  assert.deepEqual(
    board.map((r) => [r.rank, r.nickname, r.minutes, r.live]),
    [
      [1, '솔방울', 40, false],
      [2, '책벌레', 35, true],
      [3, '나', 23, true],
      [4, '새벽독서', 12, true],
    ],
  );
  assert.equal(board.find((r) => r.self)?.rank, 3);
  // ties share a rank
  const tie = buildLeaderboard({
    now,
    rows: [
      { player: 'a', nickname: 'A', minutes: 10, isMe: false },
      { player: 'b', nickname: 'B', minutes: 10, isMe: false },
    ],
    peers: [],
  });
  assert.deepEqual(tie.map((r) => r.rank), [1, 1]);

  const day = '2026-10-08';
  const at = (h: number) => new Date(2026, 9, 8, h).getTime();
  assert.equal(
    roomMinutesOn(
      [
        { endedAt: at(9), minutes: 25, entryId: null, sounds: [], room: 'midnight-library' },
        { endedAt: at(10), minutes: 25, entryId: null, sounds: [], room: 'rainy-bookstore' },
        { endedAt: new Date(2026, 9, 7, 23).getTime(), minutes: 50, entryId: null, sounds: [], room: 'midnight-library' },
        { endedAt: at(11), minutes: 15, entryId: null, sounds: [], room: 'midnight-library' },
      ],
      'midnight-library',
      day,
    ),
    40,
  );
}

console.log('timer engine + leaderboard tests passed');
