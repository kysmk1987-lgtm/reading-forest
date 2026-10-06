import type { Book } from '../../src/types/book';

import { bookIdFor, splitIsbns } from './isbn';
import { cleanText } from './text';

export type SearchField = 'keyword' | 'title' | 'author' | 'publisher' | 'isbn';

export class UpstreamError extends Error {
  constructor(
    public provider: string,
    public status: number,
  ) {
    super(`${provider} responded ${status}`);
  }
}

const TIMEOUT_MS = 6000;

async function getJson<T>(provider: string, url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new UpstreamError(provider, res.status);
  return (await res.json()) as T;
}

function withId(book: Omit<Book, 'id'>): Book | null {
  const id = bookIdFor(book.isbn13, book.isbn10);
  return id ? { ...book, id } : null;
}

function compact<T>(list: (T | null)[]): T[] {
  return list.filter((x): x is T => x !== null);
}

// ─── Kakao 책 검색 ──────────────────────────────────────────────────────────
// https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide#search-book

export const kakaoKey = () => process.env.KAKAO_REST_API_KEY;

interface KakaoDoc {
  title: string;
  contents: string;
  url: string;
  isbn: string;
  datetime: string;
  authors: string[];
  publisher: string;
  translators: string[];
  price: number;
  thumbnail: string;
}

/**
 * Kakao thumbnails are 120×174. The original Daum image (~460px wide) is in the `fname` param;
 * it is served over http in the param but also works over https (needed to avoid mixed content).
 */
export function kakaoCover(thumbnail: string): string | undefined {
  if (!thumbnail) return undefined;
  try {
    const original = new URL(thumbnail).searchParams.get('fname');
    if (original && /^https?:\/\/t\d\.daumcdn\.net\//.test(original)) return original.replace(/^http:/, 'https:');
  } catch {
    // fall through to the thumbnail
  }
  return thumbnail;
}

function mapKakao(doc: KakaoDoc): Book | null {
  return withId({
    source: 'kakao',
    title: cleanText(doc.title) ?? '',
    authors: doc.authors.filter(Boolean),
    translators: doc.translators?.filter(Boolean),
    publisher: doc.publisher || undefined,
    publishedDate: doc.datetime ? doc.datetime.slice(0, 10) : undefined,
    ...splitIsbns(doc.isbn),
    coverUrl: kakaoCover(doc.thumbnail),
    description: cleanText(doc.contents),
    price: doc.price > 0 ? doc.price : undefined,
    link: doc.url || undefined,
  });
}

export async function kakaoSearch(query: string, field: SearchField): Promise<Book[]> {
  const params = new URLSearchParams({ query, size: '30' });
  const target = { title: 'title', author: 'person', publisher: 'publisher', isbn: 'isbn' }[field as string];
  if (target) params.set('target', target);
  const data = await getJson<{ documents: KakaoDoc[] }>(
    'kakao',
    `https://dapi.kakao.com/v3/search/book?${params}`,
    { Authorization: `KakaoAK ${kakaoKey()}` },
  );
  return compact(data.documents.map(mapKakao));
}

// ─── 알라딘 TTB ─────────────────────────────────────────────────────────────
// https://blog.aladin.co.kr/openapi/category/29154402 (ItemSearch / ItemLookUp, Version 20131101)

export const aladinKey = () => process.env.ALADIN_TTB_KEY;

interface AladinItem {
  title: string;
  link: string;
  author: string;
  pubDate: string;
  description: string;
  isbn: string;
  isbn13: string;
  priceStandard: number;
  cover: string;
  categoryName: string;
  publisher: string;
  subInfo?: { itemPage?: number; subTitle?: string };
}

const TRANSLATOR_ROLE = /옮긴이|번역|역자|역/;

/** `"홍길동, 김철수 (지은이), 이영희 (옮긴이)"` → authors / translators. */
export function parseAladinAuthors(raw: string): { authors: string[]; translators: string[] } {
  const authors: string[] = [];
  const translators: string[] = [];
  const re = /([^()]+?)\s*\(([^)]+)\)\s*,?/g;
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = re.exec(raw))) {
    consumed = re.lastIndex;
    const names = match[1].split(',').map((n) => n.trim()).filter(Boolean);
    (TRANSLATOR_ROLE.test(match[2]) ? translators : authors).push(...names);
  }
  const rest = raw.slice(consumed).split(',').map((n) => n.trim()).filter(Boolean);
  authors.push(...rest);
  return { authors, translators };
}

function aladinCover(url: string | undefined) {
  if (!url) return undefined;
  return url.replace(/^http:/, 'https:').replace(/\/(cover|coversum|cover150|cover200)\//, '/cover500/');
}

function mapAladin(item: AladinItem): Book | null {
  const { authors, translators } = parseAladinAuthors(item.author ?? '');
  const category = item.categoryName?.split('>').filter(Boolean).slice(1, 3).join(' > ');
  return withId({
    source: 'aladin',
    title: cleanText(item.title) ?? '',
    authors,
    translators: translators.length ? translators : undefined,
    publisher: item.publisher || undefined,
    publishedDate: item.pubDate || undefined,
    isbn13: /^\d{13}$/.test(item.isbn13 ?? '') ? item.isbn13 : undefined,
    // Aladin returns internal codes like `K352836574` for some titles — not a real ISBN-10.
    isbn10: /^\d{9}[\dX]$/.test(item.isbn ?? '') ? item.isbn : undefined,
    coverUrl: aladinCover(item.cover),
    description: cleanText(item.description),
    pageCount: item.subInfo?.itemPage || undefined,
    price: item.priceStandard > 0 ? item.priceStandard : undefined,
    category: category || undefined,
    link: item.link?.replace(/&amp;/g, '&') || undefined,
  });
}

async function aladinCall(path: string, params: Record<string, string>): Promise<AladinItem[]> {
  const qs = new URLSearchParams({
    ttbkey: aladinKey() ?? '',
    output: 'js',
    Version: '20131101',
    Cover: 'Big',
    ...params,
  });
  const data = await getJson<{ item?: AladinItem[]; errorCode?: number; errorMessage?: string }>(
    'aladin',
    `https://www.aladin.co.kr/ttb/api/${path}?${qs}`,
  );
  if (data.errorCode) throw new UpstreamError('aladin', 502);
  return data.item ?? [];
}

export async function aladinSearch(query: string, field: SearchField): Promise<Book[]> {
  if (field === 'isbn') {
    const book = await aladinLookup(query);
    return book ? [book] : [];
  }
  const queryType = { title: 'Title', author: 'Author', publisher: 'Publisher' }[field as string] ?? 'Keyword';
  const items = await aladinCall('ItemSearch.aspx', {
    Query: query,
    QueryType: queryType,
    MaxResults: '30',
    start: '1',
    SearchTarget: 'Book',
  });
  return compact(items.map(mapAladin));
}

export async function aladinLookup(isbn: string): Promise<Book | null> {
  const items = await aladinCall('ItemLookUp.aspx', {
    ItemId: isbn,
    ItemIdType: isbn.length === 13 ? 'ISBN13' : 'ISBN',
    OptResult: 'subInfo',
  });
  return items[0] ? mapAladin(items[0]) : null;
}

// ─── 네이버 책 검색 ─────────────────────────────────────────────────────────
// https://developers.naver.com/docs/serviceapi/search/book/book.md

export const naverKeys = () =>
  process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET
    ? { id: process.env.NAVER_CLIENT_ID, secret: process.env.NAVER_CLIENT_SECRET }
    : null;

interface NaverItem {
  title: string;
  link: string;
  image: string;
  author: string;
  discount: string;
  publisher: string;
  pubdate: string;
  isbn: string;
  description: string;
}

function mapNaver(item: NaverItem): Book | null {
  const pub = item.pubdate?.match(/^(\d{4})(\d{2})(\d{2})$/);
  return withId({
    source: 'naver',
    title: cleanText(item.title) ?? '',
    authors: (cleanText(item.author) ?? '').split('^').map((a) => a.trim()).filter(Boolean),
    publisher: cleanText(item.publisher),
    publishedDate: pub ? `${pub[1]}-${pub[2]}-${pub[3]}` : undefined,
    ...splitIsbns(item.isbn),
    coverUrl: item.image || undefined,
    description: cleanText(item.description),
    link: item.link || undefined,
  });
}

export async function naverSearch(query: string, field: SearchField): Promise<Book[]> {
  const keys = naverKeys();
  if (!keys) return [];
  const url = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=${field === 'isbn' ? 10 : 30}`;
  const data = await getJson<{ items: NaverItem[] }>('naver', url, {
    'X-Naver-Client-Id': keys.id,
    'X-Naver-Client-Secret': keys.secret,
  });
  return compact(data.items.map(mapNaver));
}

// ─── Provider chain ─────────────────────────────────────────────────────────

export interface Provider {
  name: 'kakao' | 'aladin' | 'naver';
  enabled: boolean;
  search: (query: string, field: SearchField) => Promise<Book[]>;
}

export function providers(): Provider[] {
  return [
    { name: 'kakao', enabled: !!kakaoKey(), search: kakaoSearch },
    { name: 'aladin', enabled: !!aladinKey(), search: aladinSearch },
    { name: 'naver', enabled: !!naverKeys(), search: naverSearch },
  ];
}
