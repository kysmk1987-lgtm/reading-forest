// Generates assets/sounds/tap.wav — a tiny, soft "pop" used as the UI tap sound.
// Run: node scripts/generate-tap-sound.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sampleRate = 22050;
const durationSec = 0.06;
const samples = Math.floor(sampleRate * durationSec);
const data = Buffer.alloc(samples * 2);

let phase = 0;
for (let i = 0; i < samples; i++) {
  const t = i / samples;
  const freq = 1100 - 600 * t;
  phase += (2 * Math.PI * freq) / sampleRate;
  const attack = Math.min(1, i / (sampleRate * 0.003));
  const envelope = attack * Math.exp(-t * 6);
  const value = Math.sin(phase) * envelope * 0.35;
  data.writeInt16LE(Math.round(value * 32767), i * 2);
}

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

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/sounds/tap.wav');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, data]));
console.log(`wrote ${out}`);
