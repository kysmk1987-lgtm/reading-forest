export type CardDecor = 'paper' | 'forest' | 'night' | 'watercolor' | 'sakura' | 'ocean';

export interface CardTemplate {
  id: CardDecor;
  premium: boolean;
  /** Vertical gradient. */
  bg: [string, string];
  text: string;
  sub: string;
  accent: string;
}

/** Free templates first, then premium. */
export const CARD_TEMPLATES: CardTemplate[] = [
  { id: 'paper', premium: false, bg: ['#FFF9EC', '#F6EAD2'], text: '#5B4636', sub: '#9A8673', accent: '#C9A47E' },
  { id: 'forest', premium: false, bg: ['#E6F4D9', '#BFE0A6'], text: '#2F4A2C', sub: '#56744F', accent: '#5FA85A' },
  { id: 'watercolor', premium: false, bg: ['#FDF0F3', '#E7F3FB'], text: '#5B4A5F', sub: '#8F8197', accent: '#E58AA0' },
  { id: 'night', premium: true, bg: ['#2E3561', '#1B1F3D'], text: '#F7F1DE', sub: '#C5C8E8', accent: '#F4D58D' },
  { id: 'sakura', premium: true, bg: ['#FFE9EF', '#FBD3DE'], text: '#6B3A4A', sub: '#A26A7B', accent: '#E58AA0' },
  { id: 'ocean', premium: true, bg: ['#DDF2FB', '#9FD3EA'], text: '#1F4B63', sub: '#477A93', accent: '#FFFFFF' },
];

/** Premium: the user's own photo as the background (saved as `template = 'photo'`; the photo itself only lives in the rendered card image). */
export const PHOTO_TEMPLATE_ID = 'photo';

export const PHOTO_TEMPLATE: Omit<CardTemplate, 'id'> & { id: typeof PHOTO_TEMPLATE_ID } = {
  id: PHOTO_TEMPLATE_ID,
  premium: true,
  bg: ['#4A4A52', '#2B2B31'],
  text: '#FFFFFF',
  sub: '#ECE6DA',
  accent: '#F4D58D',
};

export function templateById(id: string | null | undefined): CardTemplate | typeof PHOTO_TEMPLATE {
  if (id === PHOTO_TEMPLATE_ID) return PHOTO_TEMPLATE;
  return CARD_TEMPLATES.find((t) => t.id === id) ?? CARD_TEMPLATES[0];
}

export type CardAspect = 'story' | 'square' | 'portrait';

/** width / height */
export const CARD_ASPECTS: { id: CardAspect; ratio: number; label: string }[] = [
  { id: 'story', ratio: 9 / 16, label: '9:16' },
  { id: 'square', ratio: 1, label: '1:1' },
  { id: 'portrait', ratio: 4 / 5, label: '4:5' },
];

export function aspectRatio(id: string | null | undefined) {
  return (CARD_ASPECTS.find((a) => a.id === id) ?? CARD_ASPECTS[0]).ratio;
}

export type CardAlign = 'left' | 'center' | 'right';
export type CardTextSize = 's' | 'm' | 'l';
