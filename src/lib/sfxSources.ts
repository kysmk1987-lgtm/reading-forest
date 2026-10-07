export const SFX_SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  grow: require('../../assets/sounds/grow.wav'),
  water: require('../../assets/sounds/water.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  dig: require('../../assets/sounds/dig.wav'),
};

export type SoundName = keyof typeof SFX_SOURCES;
