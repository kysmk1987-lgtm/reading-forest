import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { AMBIENT_SOUNDS, type AmbientId, type SoundMix } from '@/features/sound/ambient';
import { mixerEngine } from '@/features/sound/mixerEngine';
import { persistStorage } from '@/lib/storage';

interface MixerState {
  /** The user's own mix (0–1 per sound). */
  volumes: SoundMix;
  playing: boolean;
  /** A theme room's mix currently overriding `volumes` (restored on leave). */
  roomMix: SoundMix | null;
  setVolume: (id: AmbientId, volume: number) => Promise<void>;
  play: () => Promise<boolean>;
  stop: () => void;
  enterRoomMix: (mix: SoundMix) => Promise<boolean>;
  leaveRoomMix: () => void;
}

function active(s: Pick<MixerState, 'volumes' | 'roomMix'>): SoundMix {
  return s.roomMix ?? s.volumes;
}

async function apply(mix: SoundMix) {
  await Promise.all(AMBIENT_SOUNDS.map((snd) => mixerEngine.setVolume(snd.id, mix[snd.id] ?? 0)));
}

export const useMixerStore = create<MixerState>()(
  persist(
    (set, get) => ({
      volumes: { rain: 0.6 },
      playing: false,
      roomMix: null,
      setVolume: async (id, volume) => {
        const v = Math.max(0, Math.min(1, volume));
        set((s) => ({ volumes: { ...s.volumes, [id]: v }, roomMix: null }));
        const s = get();
        if (!s.playing && v > 0) {
          await get().play();
          return;
        }
        if (s.playing) await mixerEngine.setVolume(id, v);
      },
      play: async () => {
        const unlocked = await mixerEngine.unlock();
        if (!unlocked) return false;
        set({ playing: true });
        await apply(active(get()));
        return true;
      },
      stop: () => {
        mixerEngine.stopAll();
        set({ playing: false });
      },
      enterRoomMix: async (mix) => {
        set({ roomMix: mix });
        return get().play();
      },
      leaveRoomMix: () => {
        if (!get().roomMix) return;
        mixerEngine.stopAll();
        set({ roomMix: null, playing: false });
      },
    }),
    { name: 'rf-mixer', storage: persistStorage, partialize: (s) => ({ volumes: s.volumes }) },
  ),
);
