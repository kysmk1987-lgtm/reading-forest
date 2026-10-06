import { Asset } from 'expo-asset';

import { ambientById, type AmbientId } from './ambient';

/**
 * Web mixer on the Web Audio API: AudioBufferSourceNode loops are gapless (HTMLAudioElement `loop` clicks),
 * and each sound gets its own GainNode. The AudioContext is created/resumed only from a user gesture.
 */
interface Track {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  loading: Promise<AudioBuffer> | null;
  buffer: AudioBuffer | null;
  target: number;
}

let ctx: AudioContext | null = null;
const tracks = new Map<AmbientId, Track>();

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

async function loadBuffer(id: AmbientId) {
  const asset = Asset.fromModule(ambientById(id).source);
  const res = await fetch(asset.uri);
  return context().decodeAudioData(await res.arrayBuffer());
}

function track(id: AmbientId): Track {
  let t = tracks.get(id);
  if (!t) {
    const gain = context().createGain();
    gain.gain.value = 0;
    gain.connect(context().destination);
    t = { gain, source: null, loading: null, buffer: null, target: 0 };
    tracks.set(id, t);
  }
  return t;
}

function startSource(t: Track) {
  if (t.source || !t.buffer) return;
  const src = context().createBufferSource();
  src.buffer = t.buffer;
  src.loop = true;
  src.connect(t.gain);
  src.start();
  t.source = src;
}

function stopSource(t: Track) {
  try {
    t.source?.stop();
  } catch {
    // already stopped
  }
  t.source?.disconnect();
  t.source = null;
}

export const mixerEngine = {
  /** Must be called from a user gesture (tap) before sound can play. */
  async unlock() {
    if (typeof window === 'undefined') return false;
    const c = context();
    if (c.state !== 'running') await c.resume().catch(() => {});
    return c.state === 'running';
  },
  isLocked() {
    return !ctx || ctx.state !== 'running';
  },
  async setVolume(id: AmbientId, volume: number) {
    if (typeof window === 'undefined') return;
    const t = track(id);
    t.target = volume;
    const c = context();
    t.gain.gain.cancelScheduledValues(c.currentTime);
    t.gain.gain.setTargetAtTime(volume, c.currentTime, 0.15);
    if (volume <= 0) {
      const src = t.source;
      setTimeout(() => {
        if (t.target <= 0 && t.source === src) stopSource(t);
      }, 800);
      return;
    }
    if (!t.buffer) {
      t.loading ??= loadBuffer(id);
      t.buffer = await t.loading;
    }
    if (t.target > 0) startSource(t);
  },
  stopAll() {
    tracks.forEach((t) => {
      t.target = 0;
      if (ctx) t.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      setTimeout(() => t.target <= 0 && stopSource(t), 500);
    });
  },
};
