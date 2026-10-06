import { Platform, Share } from 'react-native';

import { PRODUCTION_URL } from '@/config/app';

export type ShareResult = 'shared' | 'copied' | 'failed';

/** Absolute URL for a route; on web uses the current origin so preview deployments share their own links. */
export function absoluteUrl(path: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return `${PRODUCTION_URL}${path}`;
}

export function forestPath(forestId: string) {
  return `/forest/${encodeURIComponent(forestId)}`;
}

/** Web Share API → clipboard fallback on web; native share sheet elsewhere. */
export async function shareLink(url: string, title: string, message: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ title, message: `${message}\n${url}`, url });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share) {
    try {
      await nav.share({ title, text: message, url });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'failed';
    }
  }
  try {
    await nav?.clipboard?.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}