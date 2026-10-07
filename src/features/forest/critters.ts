/** Little creatures that wander at the front of the garden (free ones first, then premium). */
export const CRITTERS = ['none', 'butterfly', 'ladybug', 'frog', 'bee', 'dragonfly', 'firefly'] as const;
export type Critter = (typeof CRITTERS)[number];

export const PREMIUM_CRITTERS: readonly Critter[] = ['frog', 'bee', 'dragonfly', 'firefly'];
export const DEFAULT_CRITTER: Critter = 'butterfly';

export function isCritter(value: unknown): value is Critter {
  return typeof value === 'string' && (CRITTERS as readonly string[]).includes(value);
}

/** The critter actually shown: premium picks fall back to the default when premium is off. */
export function effectiveCritter(critter: unknown, unlocked: boolean): Critter {
  if (!isCritter(critter)) return DEFAULT_CRITTER;
  return PREMIUM_CRITTERS.includes(critter) && !unlocked ? DEFAULT_CRITTER : critter;
}
