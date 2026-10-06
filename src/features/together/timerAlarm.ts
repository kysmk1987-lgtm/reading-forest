import * as Notifications from 'expo-notifications';

let scheduledId: string | null = null;
let handlerSet = false;

function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/** Local notification at `endsAt` so the alarm still fires when the app is in the background. */
export async function scheduleTimerAlarm(endsAt: number, title: string, body: string) {
  try {
    ensureHandler();
    await cancelTimerAlarm();
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
    });
  } catch (err) {
    console.warn('[timer] notification unavailable', err);
  }
}

export async function cancelTimerAlarm() {
  if (!scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** In-app notice when the session ends while the app is open (native shows the scheduled notification instead). */
export function showFinishedNotice(_title: string, _body: string) {}

export const canRequestWebNotifications = false;
export async function requestWebNotifications() {
  return false;
}
