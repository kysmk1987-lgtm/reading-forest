import { CURATED_BESTSELLERS } from '../../src/config/bestsellers';
import type { Book } from '../../src/types/book';

import { cleanIsbn, isValidIsbn } from './isbn';
import { data4libraryKey, libraryPageCount, popularLoanIsbns } from './pages';
import { aladinKey, aladinLookup, kakaoKey, kakaoSearch, naverKeys, naverSearch, providers, UpstreamError, type SearchField } from './providers';
import { longer } from './text';

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; code: 'NO_KEYS' | 'BAD_REQUEST' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM' };

export const hasAnyKey = () => providers().some((p) => p.enabled);

/** Kakao → Aladin → Naver. Moves to the next provider on error or empty results. */
export async function searchBooks(rawQuery: string, field: SearchField): Promise<ServiceResult<{ books: Book[]; source: string | null }>> {
  const query = field === 'isbn' ? cleanIsbn(rawQuery) : rawQuery.trim();
  if (!query || query.length > 100 || (field === 'isbn' && !isValidIsbn(query))) return { ok: false, code: 'BAD_REQUEST' };
  const enabled = providers().filter((p) => p.enabled);
  if (!enabled.length) return { ok: false, code: 'NO_KEYS' };

  let failure: UpstreamError | null = null;
  let answered: string | null = null;
  for (const p of enabled) {
    try {
      const books = await p.search(query, field);
      if (books.length) return { ok: true, data: { books: dedupe(books), source: p.name } };
      answered ??= p.name;
    } catch (err) {
      console.warn(`[books] ${p.name} search failed`, err);
      if (err instanceof UpstreamError) failure = err;
      else failure ??= new UpstreamError(p.name, 500);
    }
  }
  if (answered) return { ok: true, data: { books: [], source: answered } };
  return { ok: false, code: failure?.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM' };
}

function dedupe(books: Book[]): Book[] {
  const seen = new Set<string>();
  return books.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

/** Full detail: Aladin (big cover, pages, category) merged with Kakao/Naver (translators, longer description). */
export async function lookupBook(rawIsbn: string): Promise<ServiceResult<Book>> {
  const isbn = cleanIsbn(rawIsbn);
  if (!isValidIsbn(isbn)) return { ok: false, code: 'BAD_REQUEST' };
  if (!hasAnyKey()) return { ok: false, code: 'NO_KEYS' };

  const safe = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[books] ${name} lookup failed`, err);
      return null;
    }
  };

  const [aladin, kakao, naver] = await Promise.all([
    aladinKey() ? safe('aladin', () => aladinLookup(isbn)) : null,
    kakaoKey() ? safe('kakao', async () => (await kakaoSearch(isbn, 'isbn'))[0] ?? null) : null,
    naverKeys() ? safe('naver', async () => (await naverSearch(isbn, 'isbn'))[0] ?? null) : null,
  ]);

  const parts = [aladin, kakao, naver].filter((b): b is Book => !!b);
  if (!parts.length) return { ok: false, code: 'NOT_FOUND' };
  const book = mergeBooks(parts);
  // Kakao/Naver have no page count: ask the library APIs (국립중앙도서관 → 정보나루) when keys are set.
  if (!book.pageCount && book.isbn13) {
    const pages = await safe('library-pages', () => libraryPageCount(book.isbn13!));
    if (pages) book.pageCount = pages;
  }
  return { ok: true, data: book };
}

const BESTSELLER_TTL_MS = 6 * 3600_000;
let bestsellerCache: { at: number; data: { books: Book[]; source: 'data4library' | 'curated' } } | null = null;

/**
 * 베스트셀러 추천: 정보나루 인기대출도서 (enriched with Kakao covers/descriptions) when `DATA4LIBRARY_KEY`
 * is set, otherwise the curated ISBN list resolved through Kakao. Cached for 6 hours per instance.
 */
export async function bestsellers(now = Date.now()): Promise<ServiceResult<{ books: Book[]; source: 'data4library' | 'curated' }>> {
  if (bestsellerCache && now - bestsellerCache.at < BESTSELLER_TTL_MS) return { ok: true, data: bestsellerCache.data };
  if (!kakaoKey()) return { ok: false, code: 'NO_KEYS' };

  const resolve = async (item: { isbn13: string; title?: string; cover?: string }): Promise<Book | null> => {
    try {
      const book = (await kakaoSearch(item.isbn13, 'isbn'))[0];
      if (book) return { ...book, coverUrl: book.coverUrl ?? item.cover };
    } catch (err) {
      console.warn('[books] bestseller lookup failed', item.isbn13, err);
    }
    return null;
  };

  let source: 'data4library' | 'curated' = 'curated';
  let list: { isbn13: string; title?: string; cover?: string }[] = [];
  if (data4libraryKey()) {
    list = await popularLoanIsbns(20).catch(() => []);
    if (list.length) source = 'data4library';
  }
  if (!list.length) list = CURATED_BESTSELLERS;

  const books = dedupe((await Promise.all(list.map(resolve))).filter((b): b is Book => !!b));
  if (!books.length) return { ok: false, code: 'UPSTREAM' };
  const data = { books, source };
  bestsellerCache = { at: now, data };
  return { ok: true, data };
}

/** First book wins per field, except description (longest) and authors/translators (Kakao's are cleanest). */
export function mergeBooks([primary, ...rest]: Book[]): Book {
  const all = [primary, ...rest];
  const pick = <K extends keyof Book>(key: K) => all.find((b) => b[key] !== undefined && b[key] !== '')?.[key];
  const kakao = all.find((b) => b.source === 'kakao');
  return {
    ...primary,
    title: kakao?.title || primary.title,
    authors: kakao?.authors.length ? kakao.authors : primary.authors,
    translators: kakao?.translators?.length ? kakao.translators : pick('translators'),
    publisher: pick('publisher'),
    publishedDate: pick('publishedDate'),
    pageCount: pick('pageCount'),
    isbn13: pick('isbn13'),
    isbn10: pick('isbn10'),
    coverUrl: pick('coverUrl'),
    description: all.reduce<string | undefined>((acc, b) => longer(acc, b.description), undefined),
    price: pick('price'),
    category: pick('category'),
    link: pick('link'),
  };
}
