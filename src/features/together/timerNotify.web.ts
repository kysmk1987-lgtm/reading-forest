import type { TimerNotice } from './timerNotice';

/**
 * Web: browsers can't schedule notifications for a suspended tab, so the tab title shows the countdown and a
 * Notification pops up at a phase change while the tab is hidden (if the user allowed it).
 */
export async function prepareTimerNotifications(_channelNames: { alerts: string; ongoing: string }, _ask = true) {
  return false;
}

export async function syncTimerNotifications(_notice: TimerNotice | null) {}

let baseTitle: string | null = null;

export function setTimerTitle(text: string | null) {
  if (typeof document === 'undefined') return;
  if (text) {
    // Remember the router's own title once, then keep overwriting it with the countdown.
    if (baseTitle === null) baseTitle = document.title;
    if (document.title !== text) document.title = text;
  } else if (baseTitle !== null) {
    document.title = baseTitle;
    baseTitle = null;
  }
}

const hasApi = () => typeof window !== 'undefined' && 'Notification' in window;

export function showPhaseNotice(title: string, body: string) {
  if (!hasApi() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'rf-timer' });
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
