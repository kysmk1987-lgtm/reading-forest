/** Little creatures that wander at the front of the garden (free ones first, then premium). 'none' is the clear-all chip. */
export const CRITTERS = ['none', 'butterfly', 'ladybug', 'frog', 'bee', 'dragonfly', 'firefly'] as const;
export type Critter = (typeof CRITTERS)[number];
export type CritterKind = Exclude<Critter, 'none'>;

export const CRITTER_KINDS = CRITTERS.filter((c): c is CritterKind => c !== 'none');
export const PREMIUM_CRITTERS: readonly Critter[] = ['frog', 'bee', 'dragonfly', 'firefly'];
export const DEFAULT_CRITTERS: readonly CritterKind[] = ['butterfly'];

export function isCritterKind(value: unknown): value is CritterKind {
  return typeof value === 'string' && (CRITTER_KINDS as readonly string[]).includes(value);
}

/**
 * Any stored value → a clean, ordered list. Older versions saved a single critter string
 * ('none' = nobody); unknown values fall back to the default.
 */
export function normalizeCritters(value: unknown): CritterKind[] {
  if (value === 'none') return [];
  if (isCritterKind(value)) return [value];
  if (!Array.isArray(value)) return [...DEFAULT_CRITTERS];
  return CRITTER_KINDS.filter((kind) => value.includes(kind));
}

/** The critters actually shown: locked premium picks are dropped (back to the default if nothing is left). */
export function effectiveCritters(value: unknown, unlocked: boolean): CritterKind[] {
  const list = normalizeCritters(value);
  if (unlocked) return list;
  const free = list.filter((kind) => !PREMIUM_CRITTERS.includes(kind));
  return free.length || !list.length ? free : [...DEFAULT_CRITTERS];
}

/** Chip press: 'none' clears everything, any other chip toggles itself. */
export function toggleCritter(list: readonly CritterKind[], chip: Critter): CritterKind[] {
  if (chip === 'none') return [];
  return list.includes(chip) ? list.filter((kind) => kind !== chip) : CRITTER_KINDS.filter((kind) => kind === chip || list.includes(kind));
}
