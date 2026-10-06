import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

/**
 * Card fonts are loaded only when the card maker / a card needs them (1–3 MB each), never at app start.
 * `jua` is the app font and is always loaded.
 */
export type CardFontId = 'myeongjo' | 'pen' | 'jua' | 'gaegu' | 'yeonsung' | 'dohyeon';

export interface CardFont {
  id: CardFontId;
  family: string;
  premium: boolean;
  /** Relative size tweak so every font looks about the same size. */
  scale: number;
  load?: () => number;
}

export const CARD_FONTS: CardFont[] = [
  { id: 'myeongjo', family: 'SongMyung_400Regular', premium: false, scale: 1, load: () => require('@expo-google-fonts/song-myung/400Regular/SongMyung_400Regular.ttf') },
  { id: 'pen', family: 'NanumPenScript_400Regular', premium: false, scale: 1.3, load: () => require('@expo-google-fonts/nanum-pen-script/400Regular/NanumPenScript_400Regular.ttf') },
  { id: 'jua', family: 'Jua_400Regular', premium: false, scale: 1 },
  { id: 'gaegu', family: 'Gaegu_400Regular', premium: true, scale: 1.15, load: () => require('@expo-google-fonts/gaegu/400Regular/Gaegu_400Regular.ttf') },
  { id: 'yeonsung', family: 'YeonSung_400Regular', premium: true, scale: 1.05, load: () => require('@expo-google-fonts/yeon-sung/400Regular/YeonSung_400Regular.ttf') },
  { id: 'dohyeon', family: 'DoHyeon_400Regular', premium: true, scale: 1, load: () => require('@expo-google-fonts/do-hyeon/400Regular/DoHyeon_400Regular.ttf') },
];

export function fontById(id: string | null | undefined): CardFont {
  return CARD_FONTS.find((f) => f.id === id) ?? CARD_FONTS[0];
}

const pending = new Map<string, Promise<void>>();

export function loadCardFont(id: string): Promise<void> {
  const font = fontById(id);
  if (!font.load || Font.isLoaded(font.family)) return Promise.resolve();
  let p = pending.get(font.id);
  if (!p) {
    p = Font.loadAsync({ [font.family]: font.load() }).catch((err) => {
      pending.delete(font.id);
      throw err;
    });
    pending.set(font.id, p);
  }
  return p;
}

/** Loads a card font on demand; returns true once it can render. */
export function useCardFont(id: string): boolean {
  const font = fontById(id);
  const [loadedId, setLoadedId] = useState<string | null>(() => (!font.load || Font.isLoaded(font.family) ? font.id : null));
  useEffect(() => {
    let alive = true;
    loadCardFont(font.id)
      .then(() => alive && setLoadedId(font.id))
      .catch(() => alive && setLoadedId(font.id));
    return () => {
      alive = false;
    };
  }, [font.id]);
  return loadedId === font.id;
}
