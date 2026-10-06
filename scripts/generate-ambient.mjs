// Procedurally synthesises the white-noise mixer loops in assets/sounds/ambient/ (no samples, no licences:
// every sound is generated from noise + oscillators by this script, so the output is ours / CC0).
// Each loop is rendered a little longer than needed and cross-faded end→start so it repeats seamlessly.
// Run: node scripts/generate-ambient.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 16000;
const FADE = 0.6;
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds/ambient');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// ── building blocks ─────────────────────────────────────────────────────────
const white = (n, r) => Float32Array.from({ length: n }, () => r() * 2 - 1);

function brown(n, r, leak = 0.995) {
  const out = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = v * leak + (r() * 2 - 1) * 0.08;
    out[i] = v;
  }
  return out;
}

function pink(n, r) {
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

/** RBJ biquad (lowpass | highpass | bandpass). */
function biquad(x, type, freq, q = 0.707) {
  const w0 = (2 * Math.PI * freq) / SR;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  let b0, b1, b2;
  if (type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** Smooth random control signal (values ~0..1) changing at `rate` Hz. */
function wander(n, r, rate) {
  const step = Math.max(1, Math.floor(SR / rate));
  const pts = Array.from({ length: Math.ceil(n / step) + 2 }, () => r());
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / step), t = (i % step) / step;
    const s = t * t * (3 - 2 * t);
    out[i] = pts[k] * (1 - s) + pts[k + 1] * s;
  }
  return out;
}

const add = (dst, src, gain = 1, at = 0) => {
  const o = Math.floor(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
  return dst;
};
const mul = (x, env) => x.map((v, i) => v * env[i]);

function tone(dur, f0, f1, gain, decay, r = null, vibrato = 0) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let ph = r ? r() * 6.28 : 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t + Math.sin(i / SR * 2 * Math.PI * 28) * vibrato;
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.sin(ph) * Math.min(1, i / (SR * 0.004)) * Math.exp(-t * decay) * gain;
  }
  return out;
}

function burst(dur, r, decay, hp = 0, lp = 0) {
  let x = white(Math.floor(dur * SR), r).map((v, i, a) => v * Math.exp((-i / a.length) * decay));
  if (hp) x = biquad(x, 'highpass', hp);
  if (lp) x = biquad(x, 'lowpass', lp);
  return x;
}

/** Poisson-ish event times over [0, total). */
function events(total, perSec, r) {
  const out = [];
  let t = 0;
  while (true) {
    t += -Math.log(1 - r()) / perSec;
    if (t >= total) return out;
    out.push(t);
  }
}

function loopify(x, loopSec) {
  const L = Math.floor(loopSec * SR), F = Math.floor(FADE * SR);
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = x[i];
  for (let i = 0; i < F; i++) {
    const t = i / F;
    out[i] = x[i] * Math.sin((t * Math.PI) / 2) + x[L + i] * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

function normalise(x, rms = 0.16) {
  const cur = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length) || 1;
  let g = rms / cur;
  const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) * g;
  if (peak > 0.95) g *= 0.95 / peak;
  return x.map((v) => v * g);
}

// ── sounds ──────────────────────────────────────────────────────────────────
function render(loopSec, seed, build) {
  const r = rng(seed);
  const total = loopSec + FADE;
  const n = Math.ceil(total * SR);
  return normalise(loopify(build(n, total, r), loopSec));
}

const SOUNDS = {
  rain: render(10, 1, (n, total, r) => {
    const bed = biquad(pink(n, r), 'highpass', 500);
    add(bed, biquad(white(n, r), 'lowpass', 5000), 0.25);
    for (const t of events(total, 55, r)) add(bed, burst(0.012, r, 9, 2500), 0.15 + r() * 0.5, t);
    for (const t of events(total, 2.5, r)) add(bed, burst(0.05, r, 6, 800, 3000), 0.5 + r() * 0.4, t);
    return bed;
  }),
  library: render(12, 2, (n, total, r) => {
    const bed = biquad(brown(n, r), 'lowpass', 260);
    add(bed, biquad(pink(n, r), 'bandpass', 900, 0.5), 0.05);
    for (const t of events(total, 0.35, r)) {
      const len = 0.35 + r() * 0.2;
      const swell = burst(len, r, 0, 1400, 6000).map((v, i, a) => v * Math.sin((i / a.length) * Math.PI) ** 2);
      add(bed, swell, 0.18, t);
    }
    for (const t of events(total, 0.25, r)) add(bed, burst(0.04, r, 7, 200, 1200), 0.25, t);
    return bed;
  }),
  fire: render(10, 3, (n, total, r) => {
    const bed = mul(biquad(brown(n, r), 'lowpass', 500), wander(n, r, 3).map((v) => 0.6 + v * 0.6));
    for (const t of events(total, 9, r)) add(bed, burst(0.004 + r() * 0.01, r, 8, 1200), 0.4 + r() * 1.2, t);
    for (const t of events(total, 0.8, r)) add(bed, burst(0.03, r, 5, 400, 4000), 1.2 + r(), t);
    return bed;
  }),
  cafe: render(12, 4, (n, total, r) => {
    const bed = biquad(brown(n, r), 'lowpass', 400);
    for (let v = 0; v < 7; v++) {
      const voice = biquad(white(n, r), 'bandpass', 350 + r() * 700, 2.5);
      const syll = wander(n, r, 4 + r() * 3).map((x) => Math.max(0, x - 0.35) * 2);
      const phrase = wander(n, r, 0.3).map((x) => (x > 0.45 ? 1 : 0.1));
      add(bed, mul(voice, syll.map((s, i) => s * phrase[i])), 0.6);
    }
    for (const t of events(total, 0.4, r)) {
      const f = 2600 + r() * 1600;
      add(bed, tone(0.5, f, f, 0.05, 9, r), 1, t);
      add(bed, tone(0.4, f * 2.7, f * 2.7, 0.02, 12, r), 1, t);
    }
    return bed;
  }),
  waves: render(12, 5, (n, total, r) => {
    const env = Float32Array.from({ length: n }, (_, i) => {
      const p = ((i / SR) % 6) / 6;
      return Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.4)), 2) * 0.9 + 0.1;
    });
    const surf = mul(biquad(white(n, r), 'lowpass', 1800), env);
    const body = mul(biquad(brown(n, r), 'lowpass', 400), env.map((e) => 0.4 + e));
    return add(add(new Float32Array(n), surf, 0.7), body, 1);
  }),
  birds: render(12, 6, (n, total, r) => {
    const bed = mul(biquad(pink(n, r), 'bandpass', 600, 0.4), wander(n, r, 0.4).map((v) => 0.3 + v * 0.5));
    for (const t of events(total, 0.7, r)) {
      const base = 2600 + r() * 2200;
      const notes = 2 + Math.floor(r() * 4);
      for (let k = 0; k < notes; k++) {
        const up = r() > 0.5;
        add(bed, tone(0.06 + r() * 0.07, base * (up ? 0.85 : 1.15), base * (up ? 1.15 : 0.85), 0.12, 4, r, 60), 1, t + k * 0.13);
      }
    }
    return bed;
  }),
  deepsea: render(12, 7, (n, total, r) => {
    const bed = mul(biquad(brown(n, r, 0.998), 'lowpass', 140), wander(n, r, 0.2).map((v) => 0.6 + v * 0.6));
    add(bed, tone(total, 48, 48, 0.04, 0), 1);
    for (const t of events(total, 1.2, r)) {
      for (let k = 0; k < 1 + Math.floor(r() * 4); k++) {
        const f = 260 + r() * 300;
        add(bed, tone(0.05, f, f * 2.2, 0.08, 4, r), 1, t + k * (0.05 + r() * 0.08));
      }
    }
    return bed;
  }),
  space: render(12, 8, (n, total, r) => {
    const bed = biquad(pink(n, r), 'lowpass', 900);
    for (const [f, g] of [[55, 0.12], [110, 0.06], [165.5, 0.03], [220.3, 0.015]]) add(bed, tone(total, f, f, g, 0), 1);
    for (const t of [1.5, 5.5, 9.5]) {
      add(bed, tone(0.18, 880, 880, 0.05, 3), 1, t);
      add(bed, tone(0.18, 1320, 1320, 0.035, 3), 1, t + 0.22);
    }
    return bed;
  }),
  train: render(8, 9, (n, total, r) => {
    const bed = biquad(brown(n, r), 'lowpass', 220);
    add(bed, biquad(white(n, r), 'bandpass', 3000, 0.8), 0.03);
    for (let t = 0.2; t < total; t += 1) {
      for (const off of [0, 0.14]) {
        add(bed, tone(0.18, 90, 55, 0.5, 9), 1, t + off);
        add(bed, burst(0.05, r, 7, 300, 2500), 0.35, t + off);
      }
    }
    return bed;
  }),
};

mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [name, samples] of Object.entries(SOUNDS)) {
  const buf = wav(samples);
  total += buf.length;
  writeFileSync(resolve(outDir, `${name}.wav`), buf);
  console.log(`wrote assets/sounds/ambient/${name}.wav (${Math.round(buf.length / 1024)} KB)`);
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
