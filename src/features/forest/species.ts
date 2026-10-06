import type { LibraryEntry, TreeSpeciesId } from '@/types';

export interface TreeSpecies {
  id: TreeSpeciesId;
  premium: boolean;
  emoji: string;
  /** Canopy base / light / shadow colors. */
  leaf: string;
  leafLight: string;
  leafDark: string;
  trunk: string;
  /** Fruit or flower color at the `bloom` stage. */
  bloom: string;
  bloomAccent: string;
}

export const TREE_SPECIES: Record<TreeSpeciesId, TreeSpecies> = {
  round: { id: 'round', premium: false, emoji: '🌳', leaf: '#8BCB6B', leafLight: '#B5E08F', leafDark: '#5FA85A', trunk: '#A07B55', bloom: '#FFF3B0', bloomAccent: '#F9DC7A' },
  pine: { id: 'pine', premium: false, emoji: '🌲', leaf: '#5FAE72', leafLight: '#86C994', leafDark: '#3F8C59', trunk: '#8E6A48', bloom: '#B07A4E', bloomAccent: '#82603F' },
  apple: { id: 'apple', premium: false, emoji: '🍎', leaf: '#7CC57E', leafLight: '#A9DE9C', leafDark: '#539E5A', trunk: '#9A7350', bloom: '#EF6F6C', bloomAccent: '#FFFFFF' },
  cherry: { id: 'cherry', premium: true, emoji: '🌸', leaf: '#F7B7C5', leafLight: '#FCD7E0', leafDark: '#E58AA0', trunk: '#8C6450', bloom: '#FFFFFF', bloomAccent: '#F29BB0' },
  baobab: { id: 'baobab', premium: true, emoji: '🌴', leaf: '#9CCB72', leafLight: '#C3E39A', leafDark: '#6FA34F', trunk: '#B89170', bloom: '#FFFDF6', bloomAccent: '#F9DC7A' },
  maple: { id: 'maple', premium: true, emoji: '🍁', leaf: '#F2A65A', leafLight: '#F8C987', leafDark: '#E07B4F', trunk: '#8E6448', bloom: '#E25D4D', bloomAccent: '#F9DC7A' },
};

export const BASIC_SPECIES: TreeSpeciesId[] = ['round', 'pine', 'apple'];
export const PREMIUM_SPECIES: TreeSpeciesId[] = ['cherry', 'baobab', 'maple'];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The species to draw: the chosen one, falling back to a basic species when premium is not active. */
export function speciesOf(entry: Pick<LibraryEntry, 'treeSpecies' | 'book'>, isPremium: boolean): TreeSpeciesId {
  const chosen = entry.treeSpecies;
  if (chosen && (isPremium || !TREE_SPECIES[chosen].premium)) return chosen;
  return BASIC_SPECIES[hash(entry.book.id) % BASIC_SPECIES.length];
}
