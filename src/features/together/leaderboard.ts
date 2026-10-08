import { toISODate } from '@/lib/date';

/**
 * Reading-room ranking (pure, unit tested). Today's minutes per reader come from two places:
 * - server rows (`room_leaderboard` RPC, migration 0007): everyone who read in the room today, also after they left;
 * - live Presence: readers in the room right now publish their logged minutes (`todayMin`) and, while focusing,
 *   when the current focus phase began (`since`) so everyone can count the running minutes.
 * The two are matched by the per-day anonymous `token` the server hands out (never the account id).
 */
export interface LeaderboardRow {
  player: string;
  nickname: string | null;
  minutes: number;
  isMe: boolean;
}

export type ReaderPhase = 'focus' | 'break' | 'paused';

export interface LeaderboardPeer {
  key: string;
  self: boolean;
  token?: string;
  nickname?: string;
  phase?: ReaderPhase;
  since?: number;
  todayMin?: number;
}

export interface RankedReader {
  key: string;
  rank: number;
  nickname: string | null;
  minutes: number;
  /** In the room right now. */
  live: boolean;
  phase: ReaderPhase | null;
  self: boolean;
}

/** A focus phase can't run longer than this, so a stale `since` never inflates the count. */
const MAX_LIVE_MIN = 180;

export function liveMinutes(peer: Pick<LeaderboardPeer, 'phase' | 'since'>, now: number) {
  if (peer.phase !== 'focus' || !peer.since || peer.since > now) return 0;
  return Math.min(MAX_LIVE_MIN, Math.floor((now - peer.since) / 60_000));
}

export function buildLeaderboard({ rows, peers, now }: { rows: LeaderboardRow[]; peers: LeaderboardPeer[]; now: number }): RankedReader[] {
  const byToken = new Map(peers.filter((p) => p.token).map((p) => [p.token!, p]));
  const used = new Set<string>();
  const readers: Omit<RankedReader, 'rank'>[] = rows.map((row) => {
    const peer = byToken.get(row.player) ?? (row.isMe ? peers.find((p) => p.self) : undefined);
    if (peer) used.add(peer.key);
    const logged = Math.max(row.minutes, peer?.todayMin ?? 0);
    return {
      key: peer?.key ?? row.player,
      nickname: peer?.nickname ?? row.nickname,
      minutes: logged + (peer ? liveMinutes(peer, now) : 0),
      live: !!peer,
      phase: peer?.phase ?? null,
      self: row.isMe || !!peer?.self,
    };
  });
  for (const peer of peers) {
    if (used.has(peer.key)) continue;
    readers.push({
      key: peer.key,
      nickname: peer.nickname ?? null,
      minutes: (peer.todayMin ?? 0) + liveMinutes(peer, now),
      live: true,
      phase: peer.phase ?? null,
      self: peer.self,
    });
  }
  readers.sort((a, b) => b.minutes - a.minutes || Number(b.live) - Number(a.live) || Number(b.self) - Number(a.self));
  let rank = 0;
  let prev = Number.NaN;
  return readers.map((r, i) => {
    if (r.minutes !== prev) {
      rank = i + 1;
      prev = r.minutes;
    }
    return { ...r, rank };
  });
}

/** My focus minutes finished in `room` on `day` (from the on-device session history). */
export function roomMinutesOn(history: { endedAt: number; minutes: number; room: string | null }[], room: string, day: string) {
  let total = 0;
  for (const h of history) if (h.room === room && toISODate(new Date(h.endedAt)) === day) total += h.minutes;
  return total;
}
