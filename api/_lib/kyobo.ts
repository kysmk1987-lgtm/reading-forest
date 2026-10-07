/**
 * 인터넷 교보문고 온라인 베스트셀러 (종합, 주간) from the JSON endpoint the store's bestseller page uses.
 * Not a published API: it is fetched at most once per cache window, and can be switched off with
 * `ENABLE_KYOBO_BESTSELLERS=false` if the endpoint changes or Kyobo objects.
 */
import type { Book } from '../../src/types/book';

const TIMEOUT_MS = 5000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
export const KYOBO_BESTSELLER_PAGE = 'https://store.kyobobook.co.kr/bestseller/online/weekly';
const ENDPOINT = 'https://store.kyobobook.co.kr/api/gw/best/best-seller/online';

export const kyoboEnabled = () => !/^(0|false|off|no)$/i.test(process.env.ENABLE_KYOBO_BESTSELLERS ?? '');

export interface KyoboItem {
  rank: number;
  isbn13: string;
  book: Book;
}

export interface KyoboRanking {
  items: KyoboItem[];
  /** Ranking period, `YYYY-MM-DD`. */
  periodStart?: string;
  periodEnd?: string;
}

interface KyoboRow {
  prstRnkn?: number;
  cmdtCode?: string;
  cmdtName?: string;
  chrcName?: string;
  pbcmName?: string;
  rlseDate?: string;
  inbukCntt?: string | null;
  price?: number;
  saleCmdtid?: string;
  saleCmdtClstName?: string;
}

const day = (s: string | undefined) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : undefined);

/** `{ data: { bestSeller: [...], ymw: "2026093020261006" } }` → ranked books (only rows with a valid ISBN-13). */
export function parseKyoboBestsellers(json: unknown, limit = 20): KyoboRanking {
  const data = (json as { data?: { bestSeller?: KyoboRow[]; ymw?: string } } | null)?.data;
  const rows = Array.isArray(data?.bestSeller) ? data.bestSeller : [];
  const items: KyoboItem[] = [];
  for (const row of rows) {
    const isbn13 = row.cmdtCode ?? '';
    if (!/^97[89]\d{10}$/.test(isbn13) || !row.cmdtName) continue;
    items.push({
      rank: row.prstRnkn ?? items.length + 1,
      isbn13,
      book: {
        id: `kr_${isbn13}`,
        source: 'kyobo',
        title: row.cmdtName.trim(),
        authors: row.chrcName ? [row.chrcName.trim()] : [],
        publisher: row.pbcmName || undefined,
        publishedDate: day(row.rlseDate),
        isbn13,
        coverUrl: `https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt/${isbn13}.jpg`,
        description: row.inbukCntt?.trim() || undefined,
        price: row.price || undefined,
        category: row.saleCmdtClstName || undefined,
        link: row.saleCmdtid ? `https://product.kyobobook.co.kr/detail/${row.saleCmdtid}` : undefined,
      },
    });
    if (items.length >= limit) break;
  }
  const ymw = data?.ymw && /^\d{16}$/.test(data.ymw) ? data.ymw : undefined;
  return { items, periodStart: day(ymw?.slice(0, 8)), periodEnd: day(ymw?.slice(8)) };
}

/** Top `limit` of this week's 종합 ranking, or null when disabled/unreachable/unparseable. */
export async function kyoboBestsellers(limit = 20): Promise<KyoboRanking | null> {
  if (!kyoboEnabled()) return null;
  const params = new URLSearchParams({ page: '1', per: String(limit), period: '002', dsplDvsnCode: '000', dsplTrgtDvsnCode: '001' });
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'ko-KR,ko;q=0.9', Referer: KYOBO_BESTSELLER_PAGE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ranking = parseKyoboBestsellers(await res.json(), limit);
    return ranking.items.length ? ranking : null;
  } catch {
    return null;
  }
}
