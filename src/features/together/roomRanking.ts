import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { todayISO } from '@/lib/date';
import { queryClient } from '@/lib/queryClient';
import { getSupabase } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';
import { useTogetherStore } from '@/stores/togetherStore';

import { buildLeaderboard, type LeaderboardRow, type RankedReader } from './leaderboard';
import { usePresenceStore } from './presence';

/**
 * Server side of the reading-room ranking (migration 0007: `add_room_minutes`, `room_leaderboard`, `room_today_summary`).
 * Until the migration is applied the RPCs are missing (PGRST202) and the ranking falls back to live Presence only.
 */
let serverMissing = false;

const isMissing = (err: { code?: string } | null) => err?.code === 'PGRST202' || err?.code === '42883';

/** Adds finished focus minutes to today's total for `room` and remembers my anonymous token. */
export async function reportRoomMinutes(room: string, minutes: number) {
  const sb = getSupabase();
  if (!sb || serverMissing || minutes <= 0) return;
  const nickname = useProfileStore.getState().nickname;
  const { data, error } = await sb.rpc('add_room_minutes', { p_room: room, p_minutes: Math.round(minutes), p_nickname: nickname || null });
  if (isMissing(error)) {
    serverMissing = true;
    return;
  }
  if (error) {
    console.warn('[rooms] add_room_minutes failed', error.message);
    return;
  }
  if (typeof data === 'string') useTogetherStore.getState().setRoomToken({ day: todayISO(), token: data });
  queryClient.invalidateQueries({ queryKey: ['room-leaderboard', room] });
  queryClient.invalidateQueries({ queryKey: ['room-summary'] });
}

interface ServerRow {
  player: string;
  nickname: string | null;
  minutes: number;
  is_me: boolean;
}

async function fetchLeaderboard(room: string): Promise<LeaderboardRow[] | null> {
  const sb = getSupabase();
  if (!sb || serverMissing) return null;
  const { data, error } = await sb.rpc('room_leaderboard', { p_room: room, p_limit: 30 });
  if (isMissing(error)) {
    serverMissing = true;
    return null;
  }
  if (error) throw error;
  const rows = ((data ?? []) as ServerRow[]).map((r) => ({ player: r.player, nickname: r.nickname, minutes: r.minutes, isMe: r.is_me }));
  const mine = rows.find((r) => r.isMe);
  if (mine) useTogetherStore.getState().setRoomToken({ day: todayISO(), token: mine.player });
  return rows;
}

export interface RoomSummary {
  readers: number;
  topNickname: string | null;
  topMinutes: number;
}

async function fetchSummary(): Promise<Record<string, RoomSummary> | null> {
  const sb = getSupabase();
  if (!sb || serverMissing) return null;
  const { data, error } = await sb.rpc('room_today_summary');
  if (isMissing(error)) {
    serverMissing = true;
    return null;
  }
  if (error) throw error;
  const out: Record<string, RoomSummary> = {};
  for (const r of (data ?? []) as { room: string; readers: number; top_nickname: string | null; top_minutes: number }[]) {
    out[r.room] = { readers: r.readers, topNickname: r.top_nickname, topMinutes: r.top_minutes };
  }
  return out;
}

/** Re-renders every `ms` so live minutes keep counting up. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

export interface RoomBoard {
  board: RankedReader[];
  me: RankedReader | undefined;
  /** Readers in the room right now. */
  liveCount: number;
  /** false = only live readers are ranked (server ranking not set up yet / offline / demo). */
  server: boolean;
}

/** Today's ranking for one room: server totals merged with who is reading here right now. */
export function useRoomLeaderboard(roomId: string): RoomBoard {
  const peers = usePresenceStore((s) => s.peers);
  const mode = usePresenceStore((s) => s.mode);
  const query = useQuery({
    queryKey: ['room-leaderboard', roomId],
    queryFn: () => fetchLeaderboard(roomId),
    refetchInterval: 60_000,
    enabled: mode !== 'demo',
  });
  const now = useNow(20_000);
  return useMemo(() => {
    const here = peers.filter((p) => p.room === roomId);
    const board = buildLeaderboard({ rows: query.data ?? [], peers: here, now });
    return { board, me: board.find((r) => r.self), liveCount: here.length, server: !!query.data };
  }, [peers, roomId, query.data, now]);
}

/** Today's top reader + reader count per room (server), for the room list. */
export function useRoomSummaries() {
  const mode = usePresenceStore((s) => s.mode);
  return useQuery({ queryKey: ['room-summary'], queryFn: fetchSummary, refetchInterval: 60_000, enabled: mode !== 'demo' }).data ?? null;
}
