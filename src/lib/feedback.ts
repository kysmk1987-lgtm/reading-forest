import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

const tapSource = require('../../assets/sounds/tap.wav');

let player: AudioPlayer | null = null;
let audioUnavailable = false;

function playTapSound() {
  if (audioUnavailable) return;
  try {
    if (!player) {
      player = createAudioPlayer(tapSource);
      player.volume = 0.5;
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

/** Light tap feedback (sound + haptics) for buttons, chips and tabs. */
export function tapFeedback(kind: 'light' | 'medium' = 'light') {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled) {
    vibrate(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  }
  if (soundEnabled) playTapSound();
}

export function successFeedback() {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  if (hapticsEnabled && Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  if (soundEnabled) playTapSound();
}
