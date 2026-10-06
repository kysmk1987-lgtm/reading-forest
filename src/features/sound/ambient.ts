/**
 * White-noise mixer catalogue. Every loop is synthesised by `scripts/generate-ambient.mjs` (procedural noise +
 * oscillators, no third-party recordings), so there are no licence obligations.
 */
export const AMBIENT_SOUNDS = [
  { id: 'rain', emoji: '🌧️', premium: false, source: require('../../../assets/sounds/ambient/rain.wav') },
  { id: 'library', emoji: '📚', premium: false, source: require('../../../assets/sounds/ambient/library.wav') },
  { id: 'fire', emoji: '🔥', premium: false, source: require('../../../assets/sounds/ambient/fire.wav') },
  { id: 'cafe', emoji: '☕', premium: true, source: require('../../../assets/sounds/ambient/cafe.wav') },
  { id: 'waves', emoji: '🌊', premium: true, source: require('../../../assets/sounds/ambient/waves.wav') },
  { id: 'birds', emoji: '🐦', premium: true, source: require('../../../assets/sounds/ambient/birds.wav') },
  { id: 'deepsea', emoji: '🐋', premium: true, source: require('../../../assets/sounds/ambient/deepsea.wav') },
  { id: 'space', emoji: '🛰️', premium: true, source: require('../../../assets/sounds/ambient/space.wav') },
  { id: 'train', emoji: '🚂', premium: true, source: require('../../../assets/sounds/ambient/train.wav') },
] as const;

export type AmbientId = (typeof AMBIENT_SOUNDS)[number]['id'];

export type SoundMix = Partial<Record<AmbientId, number>>;

export function ambientById(id: AmbientId) {
  return AMBIENT_SOUNDS.find((s) => s.id === id)!;
}
