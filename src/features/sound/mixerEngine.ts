import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { ambientById, type AmbientId } from './ambient';

/** Native mixer: one looping expo-audio player per active sound. */
const players = new Map<AmbientId, AudioPlayer>();
let modeSet = false;

async function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

export const mixerEngine = {
  /** Native audio needs no unlock gesture. */
  async unlock() {
    await ensureMode();
    return true;
  },
  isLocked() {
    return false;
  },
  async setVolume(id: AmbientId, volume: number) {
    let player = players.get(id);
    if (volume <= 0) {
      player?.pause();
      return;
    }
    await ensureMode();
    if (!player) {
      player = createAudioPlayer(ambientById(id).source);
      player.loop = true;
      players.set(id, player);
    }
    player.volume = volume;
    if (!player.playing) player.play();
  },
  stopAll() {
    players.forEach((p) => p.pause());
  },
};
