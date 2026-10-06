import type { WrappedStats } from './compute';

export type PersonaId =
  | 'nightThinker'
  | 'dawnWalker'
  | 'marathoner'
  | 'deepDiver'
  | 'quoteCollector'
  | 'steadyGardener'
  | 'sunnyWanderer'
  | 'seedling';

export type PersonaScene = 'moon' | 'dawn' | 'sun' | 'sea' | 'stars' | 'meadow';

export interface Persona {
  id: PersonaId;
  emoji: string;
  /** Gradient (top → bottom), accent and ink colors for slides + the summary card. */
  colors: { bg: [string, string]; accent: string; ink: string };
  scene: PersonaScene;
  /** Whether the rule matches; personas are checked in array order, `seedling` always matches. */
  match: (s: WrappedStats, scale: number) => boolean;
}

const nightHour = (h: number | null) => h !== null && (h >= 22 || h < 4);
const dawnHour = (h: number | null) => h !== null && h >= 4 && h < 8;

export const PERSONAS: Persona[] = [
  {
    id: 'nightThinker',
    emoji: '🦉',
    colors: { bg: ['#2F3A5F', '#6A6F9E'], accent: '#F9DC7A', ink: '#FFFDF6' },
    scene: 'moon',
    match: (s) => nightHour(s.topHour),
  },
  {
    id: 'dawnWalker',
    emoji: '🐦',
    colors: { bg: ['#F7C6B5', '#FDF3CC'], accent: '#E7A174', ink: '#5B4636' },
    scene: 'dawn',
    match: (s) => dawnHour(s.topHour),
  },
  {
    id: 'marathoner',
    emoji: '🏃',
    colors: { bg: ['#8BCB6B', '#DDF1CF'], accent: '#4C8A47', ink: '#2E4A2B' },
    scene: 'meadow',
    match: (s, k) => s.booksFinished >= 4 * k,
  },
  {
    id: 'deepDiver',
    emoji: '🐋',
    colors: { bg: ['#5FB4D9', '#DDF2FB'], accent: '#2F6F95', ink: '#1F3B52' },
    scene: 'sea',
    match: (s, k) => s.focusMinutes >= 600 * k || (s.sessions >= 3 && s.focusMinutes / s.sessions >= 45),
  },
  {
    id: 'quoteCollector',
    emoji: '🖋️',
    colors: { bg: ['#F7B7C5', '#FDE6EC'], accent: '#C9607A', ink: '#5B3440' },
    scene: 'stars',
    match: (s, k) => s.quoteCards >= 3 * k,
  },
  {
    id: 'steadyGardener',
    emoji: '🌳',
    colors: { bg: ['#C9A47E', '#F1E3CF'], accent: '#82603F', ink: '#4A3626' },
    scene: 'meadow',
    match: (s, k) => s.longestStreak >= (k > 1 ? 21 : 7),
  },
  {
    id: 'sunnyWanderer',
    emoji: '🌻',
    colors: { bg: ['#F9DC7A', '#FFFDF6'], accent: '#E2B947', ink: '#5B4636' },
    scene: 'sun',
    match: (s) => s.topBucket === 'morning' || s.topBucket === 'afternoon' || s.topBucket === 'evening',
  },
  {
    id: 'seedling',
    emoji: '🌱',
    colors: { bg: ['#CDBBF0', '#FBF5E6'], accent: '#8E78C9', ink: '#40355E' },
    scene: 'meadow',
    match: () => true,
  },
];

export function pickPersona(stats: WrappedStats): Persona {
  const scale = stats.period.kind === 'year' ? 8 : 1;
  return PERSONAS.find((p) => p.match(stats, scale)) ?? PERSONAS[PERSONAS.length - 1];
}

/** Korean time phrase: 2 → "새벽 2시", 15 → "오후 3시". */
export function koreanHour(hour: number): string {
  if (hour < 5) return `새벽 ${hour === 0 ? 12 : hour}시`;
  if (hour < 12) return `아침 ${hour}시`;
  if (hour === 12) return '낮 12시';
  if (hour < 18) return `오후 ${hour - 12}시`;
  if (hour < 21) return `저녁 ${hour - 12}시`;
  return `밤 ${hour - 12}시`;
}

/** Object particle: 빗소리 → 빗소리를, 카페 → 카페를, 도서관 → 도서관을. */
export function withObjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}을(를)`;
  return (last - 0xac00) % 28 === 0 ? `${word}를` : `${word}을`;
}

/** "새벽 2시에 빗소리를 들으며 읽는 '심야의 사색가'" */
export function personaTagline(opts: { name: string; hour: number | null; sound: string | null }): string {
  const { name, hour, sound } = opts;
  if (hour !== null && sound) return `${koreanHour(hour)}에 ${withObjectParticle(sound)} 들으며 읽는 '${name}'`;
  if (hour !== null) return `${koreanHour(hour)}에 책장을 넘기는 '${name}'`;
  if (sound) return `${withObjectParticle(sound)} 들으며 읽는 '${name}'`;
  return `천천히 자라는 '${name}'`;
}
