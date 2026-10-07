/** Profile avatars: the sprout (default, not a person) and little reader characters. */
export const AVATAR_IDS = ['sprout', 'bob', 'short', 'glasses', 'beanie', 'bunny', 'bear', 'pigtails'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR: AvatarId = 'sprout';

export type HairStyle = 'bob' | 'short' | 'curly' | 'pigtails' | 'tucked';
export type Headwear = 'beanie' | 'bunnyHood' | 'bearHood';

export interface PersonLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  outfit: string;
  /** Darker outfit tone (sleeves, trousers). */
  outfitDeep: string;
  book: string;
  glasses?: boolean;
  headwear?: Headwear;
  /** Hat / hood colour. */
  wear?: string;
}

export interface AvatarDef {
  premium: boolean;
  /** Undefined for the sprout (no character in the forest). */
  person?: PersonLook;
}

export const AVATARS: Record<AvatarId, AvatarDef> = {
  sprout: { premium: false },
  bob: {
    premium: false,
    person: { skin: '#FCE3CF', hair: '#8A5E3B', hairStyle: 'bob', outfit: '#F9DC7A', outfitDeep: '#E2B947', book: '#E58AA0' },
  },
  short: {
    premium: false,
    person: { skin: '#F6D7BC', hair: '#5B4636', hairStyle: 'short', outfit: '#8BCB6B', outfitDeep: '#5FA85A', book: '#5FB4D9' },
  },
  glasses: {
    premium: false,
    person: { skin: '#FCE3CF', hair: '#3D3A36', hairStyle: 'curly', outfit: '#9ED8F0', outfitDeep: '#5FB4D9', book: '#E7A174', glasses: true },
  },
  beanie: {
    premium: true,
    person: {
      skin: '#FCE3CF',
      hair: '#A07B55',
      hairStyle: 'tucked',
      outfit: '#CDBBF0',
      outfitDeep: '#A893DB',
      book: '#8BCB6B',
      headwear: 'beanie',
      wear: '#F7B7C5',
    },
  },
  bunny: {
    premium: true,
    person: {
      skin: '#FDE8D7',
      hair: '#8A5E3B',
      hairStyle: 'tucked',
      outfit: '#FFFDF6',
      outfitDeep: '#EADFC8',
      book: '#E58AA0',
      headwear: 'bunnyHood',
      wear: '#FFFDF6',
    },
  },
  bear: {
    premium: true,
    person: {
      skin: '#F6D7BC',
      hair: '#5B4636',
      hairStyle: 'tucked',
      outfit: '#C9A47E',
      outfitDeep: '#A07B55',
      book: '#F9DC7A',
      headwear: 'bearHood',
      wear: '#C9A47E',
    },
  },
  pigtails: {
    premium: true,
    person: { skin: '#FCE3CF', hair: '#E7A174', hairStyle: 'pigtails', outfit: '#F7B7C5', outfitDeep: '#E58AA0', book: '#9ED8F0' },
  },
};

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value);
}

/** The avatar actually shown: premium picks fall back to the default when premium is off. */
export function effectiveAvatar(id: unknown, unlocked: boolean): AvatarId {
  if (!isAvatarId(id)) return DEFAULT_AVATAR;
  return AVATARS[id].premium && !unlocked ? DEFAULT_AVATAR : id;
}
