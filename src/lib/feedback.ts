import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

import { playSound } from './sfx';

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
  if (soundOn()) playSound('tap');
  vibrate(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
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
