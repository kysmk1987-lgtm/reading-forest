import type { SoundMix } from '@/features/sound/ambient';

export type RoomId = 'rainy-bookstore' | 'midnight-library' | 'quiet-teahouse' | 'seaside-attic';

export interface ThemeRoom {
  id: RoomId;
  emoji: string;
  premium: boolean;
  mix: SoundMix;
  /** Background gradient (top → bottom) and accent used by the scene + cards. */
  sky: [string, string];
  accent: string;
  /** Seat positions (0–1 of the scene box) where present readers' trees stand. */
  seats: { x: number; y: number }[];
}

const FLOOR_SEATS = [
  { x: 0.2, y: 0.78 },
  { x: 0.42, y: 0.84 },
  { x: 0.64, y: 0.8 },
  { x: 0.84, y: 0.86 },
  { x: 0.3, y: 0.92 },
  { x: 0.55, y: 0.95 },
  { x: 0.76, y: 0.94 },
  { x: 0.1, y: 0.9 },
];

export const THEME_ROOMS: ThemeRoom[] = [
  {
    id: 'rainy-bookstore',
    emoji: '🌧️',
    premium: false,
    mix: { rain: 0.7, library: 0.35 },
    sky: ['#B9D3E6', '#E8DCC6'],
    accent: '#7FA6C4',
    seats: FLOOR_SEATS,
  },
  {
    id: 'midnight-library',
    emoji: '🌙',
    premium: false,
    mix: { library: 0.6, fire: 0.3 },
    sky: ['#3E4A72', '#8C7A9E'],
    accent: '#F4D58D',
    seats: FLOOR_SEATS,
  },
  {
    id: 'quiet-teahouse',
    emoji: '🍵',
    premium: true,
    mix: { cafe: 0.35, rain: 0.25, fire: 0.15 },
    sky: ['#F3E2C7', '#E4C9A3'],
    accent: '#B98C5E',
    seats: FLOOR_SEATS,
  },
  {
    id: 'seaside-attic',
    emoji: '🌊',
    premium: true,
    mix: { waves: 0.6, birds: 0.2 },
    sky: ['#BFE6F2', '#F6E9D2'],
    accent: '#5FB4D9',
    seats: FLOOR_SEATS,
  },
];

export function roomById(id: string | null | undefined) {
  return THEME_ROOMS.find((r) => r.id === id) ?? null;
}
