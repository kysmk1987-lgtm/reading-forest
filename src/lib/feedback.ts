import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  grow: require('../../assets/sounds/grow.wav'),
  water: require('../../assets/sounds/water.wav'),
};
type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let audioUnavailable = false;

function playSound(name: SoundName, volume = 0.5) {
  if (audioUnavailable) return;
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

function vibrate(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style).catch(() => {});
}

function notifySuccess() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Light tap feedback (sound + haptics) for buttons, chips and tabs. */
export function tapFeedback(kind: 'light' | 'medium' = 'light') {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled) {
    vibrate(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }
  if (soundEnabled) playSound('tap');
}

export function successFeedback() {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled) notifySuccess();
  if (soundEnabled) playSound('tap');
}

/** A tree reached a new growth stage. */
export function growFeedback() {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled) notifySuccess();
  if (soundEnabled) playSound('grow', 0.6);
}

/** Watered a forest. */
export function waterFeedback() {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled) vibrate(Haptics.ImpactFeedbackStyle.Medium);
  if (soundEnabled) playSound('water', 0.6);
}
