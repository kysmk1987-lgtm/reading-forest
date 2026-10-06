import { Platform } from 'react-native';

export const PRODUCTION_URL = 'https://reading-forest-nine.vercel.app';

/**
 * Base URL for the `/api/*` serverless functions.
 * - Production web build: same origin (`''`).
 * - Native apps and local `expo start --web`: the deployed site, unless `EXPO_PUBLIC_API_BASE_URL` overrides it
 *   (e.g. `http://localhost:3000` while running `npx vercel dev`).
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? (Platform.OS === 'web' && !__DEV__ ? '' : PRODUCTION_URL);
