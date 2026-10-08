import { requireOptionalNativeModule } from 'expo';

export interface OngoingTimerOptions {
  title: string;
  body: string;
  /** Epoch ms the lock-screen countdown runs to; 0 = no live countdown. */
  endsAt: number;
  channelName: string;
  color?: string;
}

interface RfOngoingTimerModule {
  show(options: OngoingTimerOptions): boolean;
  hide(): void;
}

/**
 * Android-only local module (modules/rf-ongoing-timer): an ongoing notification with a live chronometer countdown.
 * `null` in Expo Go, on iOS/web and in builds made before the module was added — callers fall back to expo-notifications.
 */
export const RfOngoingTimer = requireOptionalNativeModule<RfOngoingTimerModule>('RfOngoingTimer');
