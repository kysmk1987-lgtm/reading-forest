import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { RfOngoingTimer } from '../../../modules/rf-ongoing-timer';

import type { TimerNotice } from './timerNotice';

/**
 * Native timer notifications.
 * - Phase-change alerts are scheduled local notifications, so they ring even while the app is suspended
 *   (JS timers don't run in the background).
 * - Lock-screen mini timer (Android): the local `rf-ongoing-timer` module posts an ongoing notification with a live
 *   countdown; without it (Expo Go / older builds) an expo-notifications sticky notification shows
 *   "집중 중 · 15:00에 휴식" and is refreshed at every phase change while the app runs.
 */
const ALERT_CHANNEL = 'timer-alerts';
const ONGOING_CHANNEL = 'timer-ongoing';
const ONGOING_ID = 'rf-timer-ongoing';
const ALERT_PREFIX = 'rf-timer-alert-';

let granted = false;
let setup: Promise<boolean> | null = null;
let queue: Promise<void> = Promise.resolve();

function ensureHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const kind = (n.request.content.data as { rf?: string } | undefined)?.rf;
      if (kind === 'ongoing') return { shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
      // While the app is open the timer rings in-app, so the scheduled alert stays quiet.
      if (kind === 'alert' && AppState.currentState === 'active') {
        return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

async function doSetup(channelNames: { alerts: string; ongoing: string }, ask: boolean) {
  try {
    ensureHandler();
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
        name: channelNames.alerts,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL, {
        name: channelNames.ongoing,
        importance: Notifications.AndroidImportance.LOW,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: null,
        enableVibrate: false,
        showBadge: false,
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    return ask && perm.canAskAgain ? (await Notifications.requestPermissionsAsync()).granted : false;
  } catch (err) {
    console.warn('[timer] notifications unavailable', err);
    return false;
  }
}

/**
 * Creates the channels and checks the permission. `ask` = may show the permission prompt (only from the 시작 tap so
 * it has context); on launch with a timer still running it only checks.
 */
export function prepareTimerNotifications(channelNames: { alerts: string; ongoing: string }, ask = true) {
  if (granted) return Promise.resolve(true);
  const attempt = (setup ?? Promise.resolve(false)).then((ok) => ok || doSetup(channelNames, ask));
  setup = attempt.then((ok) => (granted = ok));
  return setup;
}

async function cancelAlerts() {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    pending.filter((n) => n.identifier.startsWith(ALERT_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

async function hideOngoing() {
  try {
    RfOngoingTimer?.hide();
  } catch {
    // module missing in this build
  }
  await Notifications.dismissNotificationAsync(ONGOING_ID).catch(() => {});
}

async function apply(notice: TimerNotice | null) {
  if (!setup || !(await setup)) return;
  await cancelAlerts();
  if (!notice) {
    await hideOngoing();
    return;
  }
  const now = Date.now();
  for (const [i, alert] of notice.alerts.entries()) {
    if (alert.at <= now + 500) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `${ALERT_PREFIX}${i}`,
      content: { title: alert.title, body: alert.body, sound: 'default', data: { rf: 'alert' }, color: notice.color },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(alert.at), channelId: ALERT_CHANNEL },
    }).catch((err) => console.warn('[timer] schedule failed', err));
  }
  // iOS has no ongoing notifications (Live Activities are out of scope), so only the alerts are used there.
  if (Platform.OS !== 'android') return;
  const { title, body, countdownTo } = notice.ongoing;
  let shownNatively = false;
  try {
    shownNatively = !!RfOngoingTimer?.show({ title, body, endsAt: countdownTo ?? 0, channelName: notice.channelNames.ongoing, color: notice.color });
  } catch {
    shownNatively = false;
  }
  if (shownNatively) {
    await Notifications.dismissNotificationAsync(ONGOING_ID).catch(() => {});
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: ONGOING_ID,
    content: {
      title,
      body: notice.ongoing.fallbackBody,
      sticky: true,
      autoDismiss: false,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      color: notice.color,
      data: { rf: 'ongoing' },
    },
    trigger: { channelId: ONGOING_CHANNEL },
  }).catch((err) => console.warn('[timer] ongoing notification failed', err));
}

/** Replaces all timer notifications with `notice` (null = timer stopped). Calls are serialized. */
export function syncTimerNotifications(notice: TimerNotice | null) {
  queue = queue.then(() => apply(notice)).catch(() => {});
  return queue;
}

/** Web only (document.title countdown). */
export function setTimerTitle(_text: string | null) {}

/** Web only: native shows the scheduled notification instead. */
export function showPhaseNotice(_title: string, _body: string) {}

export const canRequestWebNotifications = false;
export async function requestWebNotifications() {
  return false;
}
