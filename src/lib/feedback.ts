import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  grow: require('../../assets/sounds/grow.wav'),
  water: require('../../assets/sounds/water.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  dig: require('../../assets/sounds/dig.wav'),
};
type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let audioUnavailable = false;

/** Browsers reject play() (as an unhandled rejection) until the page has had a user gesture. */
function webAudioBlocked() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? !activation.hasBeenActive : false;
}

function playSound(name: SoundName, volume = 0.5) {
  if (audioUnavailable || webAudioBlocked()) return;
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = volume;
      players[name] = player;
    }
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    audioUnavailable = true;
  }
}

/** Haptics are always on where the device supports them (native only). */
function vibrate(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style).catch(() => {});
}

function notifySuccess() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

const soundOn = () => useSettingsStore.getState().soundEnabled;

/** Light tap feedback (sound + haptics) for buttons, chips and tabs. */
export function tapFeedback(kind: 'light' | 'medium' = 'light') {
  vibrate(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  if (soundOn()) playSound('tap');
}

export function successFeedback() {
  notifySuccess();
  if (soundOn()) playSound('tap');
}

/** A tree reached a new growth stage. */
export function growFeedback() {
  notifySuccess();
  if (soundOn()) playSound('grow', 0.6);
}

/** Timer finished: the chime plays even when UI sounds are off (it is an alarm). */
export function alarmFeedback() {
  notifySuccess();
  playSound('chime', 0.8);
}

/** Watered a forest. */
export function waterFeedback() {
  vibrate(Haptics.ImpactFeedbackStyle.Medium);
  if (soundOn()) playSound('water', 0.6);
}

/** A tree was transplanted to another tile. */
export function digFeedback() {
  vibrate(Haptics.ImpactFeedbackStyle.Medium);
  if (soundOn()) playSound('dig', 0.6);
}
