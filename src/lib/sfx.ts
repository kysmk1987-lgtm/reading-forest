import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { SFX_SOURCES, type SoundName } from './sfxSources';

/** Taps can overlap when the user presses quickly, so they round-robin over a few players. */
const POOL_SIZE: Partial<Record<SoundName, number>> = { tap: 3 };

const pools: Partial<Record<SoundName, { players: AudioPlayer[]; next: number }>> = {};
let audioUnavailable = false;

function createPlayer(name: SoundName) {
  const player = createAudioPlayer(SFX_SOURCES[name], { keepAudioSessionActive: true });
  // Rewind as soon as a play finishes so the next tap only has to call play().
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.seekTo(0).catch(() => {});
  });
  return player;
}

function pool(name: SoundName) {
  let p = pools[name];
  if (!p) {
    p = { players: Array.from({ length: POOL_SIZE[name] ?? 1 }, () => createPlayer(name)), next: 0 };
    pools[name] = p;
  }
  return p;
}

/** Load every player up front: creating one on the first tap is what made that tap lag. */
export function preloadSounds() {
  if (audioUnavailable) return;
  try {
    (Object.keys(SFX_SOURCES) as SoundName[]).forEach(pool);
  } catch {
    audioUnavailable = true;
  }
}

export function playSound(name: SoundName, volume = 0.5) {
  if (audioUnavailable) return;
  try {
    const p = pool(name);
    const player = p.players[p.next];
    p.next = (p.next + 1) % p.players.length;
    player.volume = volume;
    if (player.playing || player.currentTime > 0) player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    audioUnavailable = true;
  }
}

preloadSounds();
