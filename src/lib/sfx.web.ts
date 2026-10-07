import { Asset } from 'expo-asset';

import { SFX_SOURCES, type SoundName } from './sfxSources';

/**
 * Web UI sounds on the Web Audio API with buffers decoded ahead of time: an HTMLAudioElement
 * (what expo-audio uses on web) adds a noticeable delay before every play.
 * Browsers only let an AudioContext run after a user gesture, so it is created/resumed on the
 * first pointerdown/keydown — which always lands before the click that triggers a tap sound.
 */
let ctx: AudioContext | null = null;
const buffers: Partial<Record<SoundName, AudioBuffer>> = {};
let loading: Promise<void> | null = null;

function audioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** Without a prior gesture the browser would refuse to start the context (and log a warning). */
function userHasInteracted() {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : true;
}

function unlock() {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  if (!ctx) {
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return;
    }
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

async function decode(name: SoundName) {
  const res = await fetch(Asset.fromModule(SFX_SOURCES[name]).uri);
  const data = await res.arrayBuffer();
  // AudioBuffers are not tied to a context, so an OfflineAudioContext can decode before any gesture.
  const decoder = new OfflineAudioContext(1, 1, 22050);
  buffers[name] = await decoder.decodeAudioData(data);
}

export function preloadSounds() {
  if (loading || !audioContextCtor() || typeof OfflineAudioContext === 'undefined') return;
  loading = Promise.all((Object.keys(SFX_SOURCES) as SoundName[]).map((n) => decode(n).catch(() => {}))).then(() => {});
  const opts = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', unlock, opts);
  window.addEventListener('touchstart', unlock, opts);
  window.addEventListener('keydown', unlock, opts);
}

export function playSound(name: SoundName, volume = 0.5) {
  const buffer = buffers[name];
  if (!buffer) return;
  if (!ctx && !userHasInteracted()) return;
  if (!ctx || ctx.state !== 'running') unlock();
  if (!ctx) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start();
  } catch {
    // Audio is decorative; never let it break a tap.
  }
}

preloadSounds();
