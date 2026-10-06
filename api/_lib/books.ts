import type { Book } from '../../src/types/book';

import { cleanIsbn, isValidIsbn } from './isbn';
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
  return { ok: true, data: mergeBooks(parts) };
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
