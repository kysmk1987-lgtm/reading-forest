/**
 * Page counts and popular-book lists from Korean public library APIs.
 *   · 국립중앙도서관 ISBN 서지정보 (seoji): `NL_CERT_KEY` — https://www.nl.go.kr/NL/contents/N31101030700.do
 *   · 도서관 정보나루: `DATA4LIBRARY_KEY` — https://www.data4library.kr/apiUtilization
 */

const TIMEOUT_MS = 5000;

export const nlKey = () => process.env.NL_CERT_KEY;
export const data4libraryKey = () => process.env.DATA4LIBRARY_KEY;

/** `"321 p."`, `"xii, 321 p. ; 21 cm"`, `"321쪽"`, `"1책(321면)"`, `"321"` → 321. Unknown/implausible → undefined. */
export function parsePageCount(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw > 0 && raw < 20000 ? Math.round(raw) : undefined;
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  if (/^\d{1,5}$/.test(text)) return parsePageCount(Number(text));
  let best: number | undefined;
  for (const m of text.matchAll(/(\d{1,5})\s*(?:p\b|p\.|pp\.?|쪽|페이지|면)/gi)) {
    const n = Number(m[1]);
    if (n > 0 && n < 20000 && (best === undefined || n > best)) best = n;
  }
  return best;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 국립중앙도서관 서지정보: the `PAGE` field of the first record. */
export async function seojiPages(isbn: string): Promise<number | undefined> {
  const key = nlKey();
  if (!key) return undefined;
  const params = new URLSearchParams({ cert_key: key, result_style: 'json', page_no: '1', page_size: '1', isbn });
  const data = await getJson<{ docs?: { PAGE?: string }[] }>(`https://www.nl.go.kr/seoji/SearchApi.do?${params}`);
  return parsePageCount(data?.docs?.[0]?.PAGE);
}

interface Data4LibraryBook {
  bookname?: string;
  authors?: string;
  publisher?: string;
  publication_year?: string;
  isbn13?: string;
  bookImageURL?: string;
  description?: string;
  [key: string]: unknown;
}

/** 도서관 정보나루 도서 상세 (srchDtlList): page counts are rarely present, but any page-like field is used. */
export async function data4libraryPages(isbn13: string): Promise<number | undefined> {
  const key = data4libraryKey();
  if (!key) return undefined;
  const params = new URLSearchParams({ authKey: key, isbn13, loaninfoYN: 'N', format: 'json' });
  const data = await getJson<{ response?: { detail?: { book?: Data4LibraryBook }[] } }>(`http://data4library.kr/api/srchDtlList?${params}`);
  const book = data?.response?.detail?.[0]?.book;
  if (!book) return undefined;
  for (const [k, v] of Object.entries(book)) {
    if (/page/i.test(k)) {
      const n = parsePageCount(v);
      if (n) return n;
    }
  }
  return undefined;
}

/** Page count from the library providers in order (seoji → 정보나루). */
export async function libraryPageCount(isbn13: string): Promise<number | undefined> {
  return (await seojiPages(isbn13)) ?? (await data4libraryPages(isbn13));
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** 정보나루 인기대출도서 (loanItemSrch) for the last 30 days: ISBN-13s in rank order. */
export async function popularLoanIsbns(limit = 20, now = new Date()): Promise<{ isbn13: string; title?: string; cover?: string }[]> {
  const key = data4libraryKey();
  if (!key) return [];
  const start = new Date(now.getTime() - 30 * 86400_000);
  const params = new URLSearchParams({
    authKey: key,
    startDt: ymd(start),
    endDt: ymd(now),
    pageNo: '1',
    pageSize: String(limit),
    format: 'json',
  });
  const data = await getJson<{ response?: { docs?: { doc?: Data4LibraryBook }[] } }>(`http://data4library.kr/api/loanItemSrch?${params}`);
  return (data?.response?.docs ?? [])
    .map((d) => d.doc)
    .filter((d): d is Data4LibraryBook => !!d && /^\d{13}$/.test(d.isbn13 ?? ''))
    .map((d) => ({ isbn13: d.isbn13!, title: d.bookname, cover: d.bookImageURL || undefined }));
}
