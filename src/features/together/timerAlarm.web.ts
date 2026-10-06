/** Web: browsers can't schedule notifications for a closed tab, so we notify when the session ends while hidden. */
export async function scheduleTimerAlarm(_endsAt: number, _title: string, _body: string) {}

export async function cancelTimerAlarm() {}

const hasApi = () => typeof window !== 'undefined' && 'Notification' in window;

export function showFinishedNotice(title: string, body: string) {
  if (!hasApi() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico' });
  } catch {
    // Some mobile browsers only allow notifications from a service worker.
  }
}

export const canRequestWebNotifications = hasApi();

export async function requestWebNotifications() {
  if (!hasApi()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}
