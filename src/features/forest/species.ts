import type { LibraryEntry, TreeSpeciesId } from '@/types';

/** Silhouette drawn by `TreeGraphic` (several species can share one). */
export type CanopyShape = 'round' | 'pine' | 'cherry' | 'baobab' | 'maple' | 'ginkgo' | 'birch' | 'palm' | 'magnolia';
/** What appears on the canopy at the `bloom` stage. */
export type BloomStyle = 'flower' | 'fruit' | 'cone' | 'nut' | 'catkin' | 'coconut' | 'bigFlower';
export type TrunkStyle = 'plain' | 'thick' | 'birch' | 'curved';

export interface TreeSpecies {
  id: TreeSpeciesId;
  premium: boolean;
  emoji: string;
  shape: CanopyShape;
  bloomStyle: BloomStyle;
  trunkStyle: TrunkStyle;
  /** Canopy base / light / shadow colors. */
  leaf: string;
  leafLight: string;
  leafDark: string;
  trunk: string;
  /** Fruit or flower color at the `bloom` stage. */
  bloom: string;
  bloomAccent: string;
}

/** Order here is the order in the 도감 and the species picker. Adding a species = one entry + an id in `TREE_SPECIES_IDS`. */
export const SPECIES_LIST: TreeSpecies[] = [
  { id: 'round', premium: false, emoji: '🌳', shape: 'round', bloomStyle: 'flower', trunkStyle: 'plain', leaf: '#8BCB6B', leafLight: '#B5E08F', leafDark: '#5FA85A', trunk: '#A07B55', bloom: '#FFF3B0', bloomAccent: '#F9DC7A' },
  { id: 'pine', premium: false, emoji: '🌲', shape: 'pine', bloomStyle: 'cone', trunkStyle: 'plain', leaf: '#5FAE72', leafLight: '#86C994', leafDark: '#3F8C59', trunk: '#8E6A48', bloom: '#B07A4E', bloomAccent: '#82603F' },
  { id: 'apple', premium: false, emoji: '🍎', shape: 'round', bloomStyle: 'fruit', trunkStyle: 'plain', leaf: '#7CC57E', leafLight: '#A9DE9C', leafDark: '#539E5A', trunk: '#9A7350', bloom: '#EF6F6C', bloomAccent: '#FFFFFF' },
  { id: 'cherry', premium: true, emoji: '🌸', shape: 'cherry', bloomStyle: 'flower', trunkStyle: 'plain', leaf: '#F7B7C5', leafLight: '#FCD7E0', leafDark: '#E58AA0', trunk: '#8C6450', bloom: '#FFFFFF', bloomAccent: '#F29BB0' },
  { id: 'baobab', premium: true, emoji: '🌴', shape: 'baobab', bloomStyle: 'flower', trunkStyle: 'thick', leaf: '#9CCB72', leafLight: '#C3E39A', leafDark: '#6FA34F', trunk: '#B89170', bloom: '#FFFDF6', bloomAccent: '#F9DC7A' },
  { id: 'maple', premium: true, emoji: '🍁', shape: 'maple', bloomStyle: 'flower', trunkStyle: 'plain', leaf: '#F2A65A', leafLight: '#F8C987', leafDark: '#E07B4F', trunk: '#8E6448', bloom: '#E25D4D', bloomAccent: '#F9DC7A' },
  { id: 'ginkgo', premium: true, emoji: '🍂', shape: 'ginkgo', bloomStyle: 'nut', trunkStyle: 'plain', leaf: '#F6D04D', leafLight: '#FBE68A', leafDark: '#E3AE2B', trunk: '#8A6A4A', bloom: '#E9B949', bloomAccent: '#FFF6C9' },
  { id: 'birch', premium: true, emoji: '🌿', shape: 'birch', bloomStyle: 'catkin', trunkStyle: 'birch', leaf: '#A8D86E', leafLight: '#CDEB98', leafDark: '#7FBF4F', trunk: '#F4F1EA', bloom: '#C9A15E', bloomAccent: '#8C6A3E' },
  { id: 'palm', premium: true, emoji: '🥥', shape: 'palm', bloomStyle: 'coconut', trunkStyle: 'curved', leaf: '#6CC48A', leafLight: '#9BDDAA', leafDark: '#409A63', trunk: '#C49A6C', bloom: '#8A5E3B', bloomAccent: '#B88E62' },
  { id: 'magnolia', premium: true, emoji: '🌷', shape: 'magnolia', bloomStyle: 'bigFlower', trunkStyle: 'plain', leaf: '#86C27A', leafLight: '#B2DCA2', leafDark: '#5E9E58', trunk: '#7E6250', bloom: '#FFFFFF', bloomAccent: '#F3B6CF' },
];

export const TREE_SPECIES = Object.fromEntries(SPECIES_LIST.map((s) => [s.id, s])) as Record<TreeSpeciesId, TreeSpecies>;

export const BASIC_SPECIES: TreeSpeciesId[] = SPECIES_LIST.filter((s) => !s.premium).map((s) => s.id);
export const PREMIUM_SPECIES: TreeSpeciesId[] = SPECIES_LIST.filter((s) => s.premium).map((s) => s.id);
export const SPECIES_IDS: TreeSpeciesId[] = SPECIES_LIST.map((s) => s.id);

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The species to draw: the chosen one, falling back to a basic species when premium is not active. */
export function speciesOf(entry: Pick<LibraryEntry, 'treeSpecies' | 'book'>, isPremium: boolean): TreeSpeciesId {
  const chosen = entry.treeSpecies;
  if (chosen && TREE_SPECIES[chosen] && (isPremium || !TREE_SPECIES[chosen].premium)) return chosen;
  return BASIC_SPECIES[hash(entry.book.id) % BASIC_SPECIES.length];
}
