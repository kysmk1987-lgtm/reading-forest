/** The 17 시·도. `key` is what we store and send over Realtime — region-level only, never coordinates. */
export const REGIONS = [
  { key: 'seoul', name: '서울', full: '서울특별시', iso: ['11'] },
  { key: 'busan', name: '부산', full: '부산광역시', iso: ['26'] },
  { key: 'daegu', name: '대구', full: '대구광역시', iso: ['27'] },
  { key: 'incheon', name: '인천', full: '인천광역시', iso: ['28'] },
  { key: 'gwangju', name: '광주', full: '광주광역시', iso: ['29'] },
  { key: 'daejeon', name: '대전', full: '대전광역시', iso: ['30'] },
  { key: 'ulsan', name: '울산', full: '울산광역시', iso: ['31'] },
  { key: 'sejong', name: '세종', full: '세종특별자치시', iso: ['50'] },
  { key: 'gyeonggi', name: '경기', full: '경기도', iso: ['41'] },
  { key: 'gangwon', name: '강원', full: '강원특별자치도', iso: ['42', '51'] },
  { key: 'chungbuk', name: '충북', full: '충청북도', iso: ['43'] },
  { key: 'chungnam', name: '충남', full: '충청남도', iso: ['44'] },
  { key: 'jeonbuk', name: '전북', full: '전북특별자치도', iso: ['45', '52'] },
  { key: 'jeonnam', name: '전남', full: '전라남도', iso: ['46'] },
  { key: 'gyeongbuk', name: '경북', full: '경상북도', iso: ['47'] },
  { key: 'gyeongnam', name: '경남', full: '경상남도', iso: ['48'] },
  { key: 'jeju', name: '제주', full: '제주특별자치도', iso: ['49'] },
] as const;

export type RegionKey = (typeof REGIONS)[number]['key'];

export const REGION_KEYS = REGIONS.map((r) => r.key) as RegionKey[];

const BY_KEY = new Map<string, (typeof REGIONS)[number]>(REGIONS.map((r) => [r.key, r]));

export function isRegionKey(value: unknown): value is RegionKey {
  return typeof value === 'string' && BY_KEY.has(value);
}

export function regionName(key: RegionKey | null | undefined) {
  return key ? (BY_KEY.get(key)?.name ?? '') : '';
}

/**
 * ISO 3166-2:KR subdivision code (Vercel's `x-vercel-ip-country-region` sends just the suffix, e.g. `26`)
 * → region key. Accepts `KR-26` too, and the newer codes for 강원(51) / 전북(52).
 */
export function regionFromIsoCode(code: string | null | undefined): RegionKey | null {
  if (!code) return null;
  const suffix = code.toUpperCase().replace(/^KR-/, '');
  return REGIONS.find((r) => (r.iso as readonly string[]).includes(suffix))?.key ?? null;
}

/** Label nudges where the metro cities sit inside/next to their provinces (map units). */
export const LABEL_OFFSETS: Partial<Record<RegionKey, { dx: number; dy: number }>> = {
  seoul: { dx: 2, dy: -2 },
  incheon: { dx: -14, dy: 4 },
  gyeonggi: { dx: 12, dy: -16 },
  sejong: { dx: -6, dy: -4 },
  daejeon: { dx: 6, dy: 6 },
  chungnam: { dx: -8, dy: 2 },
  gwangju: { dx: -4, dy: -2 },
  jeonnam: { dx: -4, dy: 12 },
  daegu: { dx: 0, dy: 0 },
  gyeongbuk: { dx: 6, dy: -14 },
  ulsan: { dx: 6, dy: 0 },
  busan: { dx: 6, dy: 6 },
  gyeongnam: { dx: -10, dy: 2 },
};
