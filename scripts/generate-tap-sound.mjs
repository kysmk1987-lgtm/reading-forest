// Generates the small UI sounds in assets/sounds/:
//   tap.wav   — soft "pop" for taps
//   grow.wav  — rising chime when a tree reaches a new stage
//   water.wav — bubbly droplet for watering a friend's forest
// Run: node scripts/generate-tap-sound.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22050;
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds');

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Sine sweep from f0 to f1 with a fast attack and exponential decay. */
function tone(durationSec, f0, f1, gain, decay) {
  const n = Math.floor(sampleRate * durationSec);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    phase += (2 * Math.PI * (f0 + (f1 - f0) * t)) / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.004));
    out[i] = Math.sin(phase) * attack * Math.exp(-t * decay) * gain;
  }
  return out;
}

function mix(parts) {
  const length = Math.max(...parts.map(({ at, samples }) => Math.floor(at * sampleRate) + samples.length));
  const out = new Float32Array(length);
  for (const { at, samples } of parts) {
    const offset = Math.floor(at * sampleRate);
    samples.forEach((v, i) => (out[offset + i] += v));
  }
  return out;
}

const sounds = {
  'tap.wav': tone(0.06, 1100, 500, 0.35, 6),
  // C6 – E6 – G6 – C7 arpeggio with a soft shimmer.
  'grow.wav': mix(
    [1046.5, 1318.5, 1568, 2093].map((f, i) => ({ at: i * 0.08, samples: tone(0.45, f, f, 0.22, 5) })),
  ),
  'water.wav': mix([
    { at: 0, samples: tone(0.09, 600, 1400, 0.3, 5) },
    { at: 0.11, samples: tone(0.08, 800, 1700, 0.22, 6) },
  ]),
};

mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(resolve(outDir, name), wav(Array.from(samples)));
  console.log(`wrote assets/sounds/${name}`);
}
