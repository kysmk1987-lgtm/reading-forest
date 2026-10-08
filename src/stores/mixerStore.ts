import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { AMBIENT_SOUNDS, type AmbientId, type SoundMix } from '@/features/sound/ambient';
import { mixerEngine } from '@/features/sound/mixerEngine';
import { persistStorage } from '@/lib/storage';

/**
 * Who started the sound that is playing now:
 * - `user`: previewed/played from the sound settings, `room`: a theme room's mix,
 * - `timer`: started with the reading timer (follows focus/break/pause),
 * - `muted`: the user stopped the timer's sound during this run, so the timer leaves it off until the next 시작.
 */
export type SoundOwner = 'user' | 'room' | 'timer' | 'muted' | null;

interface MixerState {
  /** The user's own mix (0–1 per sound). */
  volumes: SoundMix;
  playing: boolean;
  owner: SoundOwner;
  /** A theme room's mix currently overriding `volumes` (restored on leave). */
  roomMix: SoundMix | null;
  /** Play the mix automatically while the reading timer focuses. */
  withTimer: boolean;
  /** Keep playing during breaks too (otherwise the sound pauses for the break). */
  duringBreak: boolean;
  setVolume: (id: AmbientId, volume: number) => Promise<void>;
  play: (owner?: Exclude<SoundOwner, null | 'muted'>) => Promise<boolean>;
  stop: () => void;
  /** Pause the timer's sound without giving up ownership (break / paused timer). */
  suspend: () => void;
  setOwner: (owner: SoundOwner) => void;
  setWithTimer: (on: boolean) => void;
  setDuringBreak: (on: boolean) => void;
  enterRoomMix: (mix: SoundMix) => Promise<boolean>;
  leaveRoomMix: () => void;
}

function active(s: Pick<MixerState, 'volumes' | 'roomMix'>): SoundMix {
  return s.roomMix ?? s.volumes;
}

export function hasAnySound(mix: SoundMix) {
  return Object.values(mix).some((v) => (v ?? 0) > 0);
}

async function apply(mix: SoundMix) {
  await Promise.all(AMBIENT_SOUNDS.map((snd) => mixerEngine.setVolume(snd.id, mix[snd.id] ?? 0)));
}

export const useMixerStore = create<MixerState>()(
  persist(
    (set, get) => ({
      volumes: { rain: 0.6 },
      playing: false,
      owner: null,
      roomMix: null,
      withTimer: true,
      duringBreak: false,
      setVolume: async (id, volume) => {
        const v = Math.max(0, Math.min(1, volume));
        set((s) => ({ volumes: { ...s.volumes, [id]: v }, roomMix: null }));
        const s = get();
        if (!s.playing && v > 0) {
          await get().play(s.owner === 'timer' ? 'timer' : 'user');
          return;
        }
        if (s.playing) await mixerEngine.setVolume(id, v);
      },
      play: async (owner = 'user') => {
        const unlocked = await mixerEngine.unlock();
        if (!unlocked) return false;
        set({ playing: true, owner });
        await apply(active(get()));
        return true;
      },
      stop: () => {
        mixerEngine.stopAll();
        set({ playing: false, owner: null });
      },
      suspend: () => {
        mixerEngine.stopAll();
        set({ playing: false });
      },
      setOwner: (owner) => set({ owner }),
      setWithTimer: (withTimer) => set({ withTimer }),
      setDuringBreak: (duringBreak) => set({ duringBreak }),
      enterRoomMix: async (mix) => {
        set({ roomMix: mix });
        return get().play('room');
      },
      leaveRoomMix: () => {
        if (!get().roomMix) return;
        mixerEngine.stopAll();
        set({ roomMix: null, playing: false, owner: null });
      },
    }),
    {
      name: 'rf-mixer',
      storage: persistStorage,
      partialize: (s) => ({ volumes: s.volumes, withTimer: s.withTimer, duringBreak: s.duringBreak }),
    },
  ),
);
