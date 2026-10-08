import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { useTogetherStore } from '@/stores/togetherStore';

import type { ReaderPhase } from './leaderboard';
import { isRegionKey, REGION_KEYS, type RegionKey } from './regions';

/**
 * Live readers via Supabase Realtime on one public channel (`reading-now`):
 * - Presence: each active tab tracks `{ region, status, room?, nickname?, species?, book? }` under a random key
 *   (no account id, no coordinates — only the 시·도). People count as reading while a timer runs or in a theme room.
 * - Broadcast `cheer`: `{ to, from, emoji }` delivered to everyone whose region is `to`.
 * Without Supabase the store runs a clearly labelled demo simulation instead.
 */
export const CHANNEL = 'reading-now';
export const CHEER_EMOJIS = ['☕', '🌱', '📖', '👏', '💫', '🍀'] as const;
export const CHEER_COOLDOWN_MS = 10_000;

export type PeerStatus = 'focusing' | 'room';

export interface PresencePayload {
  region: RegionKey | null;
  status: PeerStatus;
  room?: string;
  nickname?: string;
  species?: string;
  book?: string;
  cover?: string;
  /** Reading-room ranking: timer phase, start of the current focus phase (ms), today's logged minutes here, day token. */
  phase?: ReaderPhase;
  since?: number;
  todayMin?: number;
  token?: string;
}

export interface Peer extends PresencePayload {
  key: string;
  self: boolean;
}

export interface IncomingCheer {
  id: number;
  from: RegionKey | null;
  emoji: string;
}

interface PresenceState {
  mode: 'connecting' | 'live' | 'demo';
  selfKey: string;
  peers: Peer[];
  cheers: IncomingCheer[];
  setMode: (mode: PresenceState['mode']) => void;
  setPeers: (peers: Peer[]) => void;
  pushCheer: (cheer: Omit<IncomingCheer, 'id'>) => void;
  dropCheer: (id: number) => void;
}

let cheerId = 0;

export const usePresenceStore = create<PresenceState>()((set) => ({
  mode: 'connecting',
  selfKey: `r${Math.random().toString(36).slice(2, 10)}`,
  peers: [],
  cheers: [],
  setMode: (mode) => set({ mode }),
  setPeers: (peers) => set({ peers }),
  pushCheer: (cheer) => set((s) => ({ cheers: [...s.cheers.slice(-3), { ...cheer, id: ++cheerId }] })),
  dropCheer: (id) => set((s) => ({ cheers: s.cheers.filter((c) => c.id !== id) })),
}));

let channel: RealtimeChannel | null = null;

export function setActiveChannel(ch: RealtimeChannel | null) {
  channel = ch;
}

/** Flattens `channel.presenceState()` (key → metas[]) into one peer per key. */
export function peersFromPresenceState(state: Record<string, unknown[]>, selfKey: string): Peer[] {
  return Object.entries(state).flatMap(([key, metas]) => {
    const meta = (metas?.[0] ?? {}) as Partial<PresencePayload>;
    if (meta.status !== 'focusing' && meta.status !== 'room') return [];
    return [
      {
        key,
        self: key === selfKey,
        region: isRegionKey(meta.region) ? meta.region : null,
        status: meta.status,
        room: typeof meta.room === 'string' ? meta.room : undefined,
        nickname: typeof meta.nickname === 'string' ? meta.nickname.slice(0, 16) : undefined,
        species: typeof meta.species === 'string' ? meta.species : undefined,
        book: typeof meta.book === 'string' ? meta.book.slice(0, 40) : undefined,
        cover: typeof meta.cover === 'string' && meta.cover.startsWith('https://') ? meta.cover : undefined,
        phase: meta.phase === 'focus' || meta.phase === 'break' || meta.phase === 'paused' ? meta.phase : undefined,
        since: typeof meta.since === 'number' && Number.isFinite(meta.since) ? meta.since : undefined,
        todayMin: typeof meta.todayMin === 'number' && meta.todayMin >= 0 ? Math.min(1440, Math.round(meta.todayMin)) : undefined,
        token: typeof meta.token === 'string' ? meta.token.slice(0, 16) : undefined,
      },
    ];
  });
}

export function countsByRegion(peers: Peer[]) {
  const counts = Object.fromEntries(REGION_KEYS.map((k) => [k, 0])) as Record<RegionKey, number>;
  let unknown = 0;
  for (const p of peers) {
    if (p.region) counts[p.region]++;
    else unknown++;
  }
  return { counts, unknown, total: peers.length };
}

export type CheerResult = 'sent' | 'cooldown' | 'offline';

export async function sendCheer(to: RegionKey, emoji: string): Promise<CheerResult> {
  const { lastCheerAt, markCheer, regionOverride, detectedRegion } = useTogetherStore.getState();
  const now = Date.now();
  if (now - lastCheerAt < CHEER_COOLDOWN_MS) return 'cooldown';
  const mode = usePresenceStore.getState().mode;
  if (mode === 'demo') {
    markCheer(now);
    return 'sent';
  }
  if (!channel || mode !== 'live') return 'offline';
  const res = await channel.send({ type: 'broadcast', event: 'cheer', payload: { to, from: regionOverride ?? detectedRegion, emoji } });
  if (res !== 'ok') return 'offline';
  markCheer(now);
  return 'sent';
}

// ── Demo simulation (no Supabase) ───────────────────────────────────────────
const DEMO_BASE: Partial<Record<RegionKey, number>> = {
  seoul: 9, gyeonggi: 11, incheon: 3, busan: 4, daegu: 3, gwangju: 2, daejeon: 2, ulsan: 1, sejong: 1,
  gangwon: 1, chungbuk: 1, chungnam: 2, jeonbuk: 1, jeonnam: 1, gyeongbuk: 2, gyeongnam: 3, jeju: 1,
};

const DEMO_ROOMS = ['rainy-bookstore', 'midnight-library', 'quiet-teahouse', 'seaside-attic'];
const DEMO_NAMES = ['도토리 독서가', '솔방울', '책벌레', '밤산책', '새벽독서', '나뭇잎', '조약돌', '라떼한잔'];

/** Demo readers' focus phases started at fixed offsets from this moment, so their live minutes keep counting. */
const DEMO_EPOCH = Date.now();

export function demoPeers(tick: number): Peer[] {
  const peers: Peer[] = [];
  REGION_KEYS.forEach((region, i) => {
    const base = DEMO_BASE[region] ?? 0;
    const wobble = Math.round(Math.sin(tick * 0.9 + i * 1.7) * Math.max(1, base * 0.25));
    const n = Math.max(0, base + wobble);
    for (let k = 0; k < n; k++) {
      const inRoom = k % 3 === 0;
      // Hashed so phase / name / minutes don't line up with the room index (which is (i + k) % 4).
      const seed = ((i * 100 + k) * 2654435761) >>> 16;
      peers.push({
        key: `demo-${region}-${k}`,
        self: false,
        region,
        status: inRoom ? 'room' : 'focusing',
        room: inRoom ? DEMO_ROOMS[(i + k) % DEMO_ROOMS.length] : undefined,
        nickname: inRoom ? DEMO_NAMES[seed % DEMO_NAMES.length] : undefined,
        ...(inRoom
          ? {
              phase: (Math.floor(seed / 8) % 4 === 0 ? 'break' : 'focus') as ReaderPhase,
              since: Math.floor(seed / 8) % 4 === 0 ? undefined : DEMO_EPOCH - (Math.floor(seed / 32) % 22) * 60_000,
              todayMin: Math.floor(seed / 700) % 75,
            }
          : null),
      });
    }
  });
  return peers;
}
