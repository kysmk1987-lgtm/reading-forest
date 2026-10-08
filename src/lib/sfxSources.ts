export const SFX_SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  grow: require('../../assets/sounds/grow.wav'),
  water: require('../../assets/sounds/water.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  dig: require('../../assets/sounds/dig.wav'),
  soon: require('../../assets/sounds/soon.wav'),
  toBreak: require('../../assets/sounds/to-break.wav'),
  toFocus: require('../../assets/sounds/to-focus.wav'),
};

export type SoundName = keyof typeof SFX_SOURCES;
