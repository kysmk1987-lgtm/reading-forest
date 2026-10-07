import { API_BASE_URL } from '@/config/app';
import { BOOK_REGION } from '@/config/locale';
import type { Book, BookSource } from '@/types';

import { getGoogleBook, searchGoogleBooks } from './global/googleBooks';
import { getOpenLibraryWork, searchOpenLibrary, searchOpenLibraryByIsbn } from './global/openLibrary';

export type SearchMode = 'keyword' | 'isbn';

export interface SearchResult {
  books: Book[];
  source: BookSource | null;
}

export type BookApiErrorCode = 'NO_KEYS' | 'BAD_REQUEST' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM' | 'NETWORK';

export class BookApiError extends Error {
  constructor(public code: BookApiErrorCode) {
    super(code);
  }
}

export function normalizeIsbn(input: string) {
  return input.replace(/[^0-9Xx]/g, '').toUpperCase();
}

async function callApi<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new BookApiError('NETWORK');
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: { code: BookApiErrorCode } }) | null;
  if (!res.ok || !body) throw new BookApiError(body?.error?.code ?? 'UPSTREAM');
  return body;
}

/** Korea: server proxy (Kakao → Aladin → Naver). Global (future): Google Books → Open Library from the client. */
export async function searchBooks(query: string, mode: SearchMode, signal?: AbortSignal): Promise<SearchResult> {
  const q = mode === 'isbn' ? normalizeIsbn(query) : query.trim();
  if (BOOK_REGION === 'KR') {
    const params = new URLSearchParams({ q, field: mode });
    return callApi<SearchResult>(`/api/books/search?${params}`, signal);
  }
  try {
    const books = await searchGoogleBooks(mode === 'isbn' ? `isbn:${q}` : q, signal);
    if (books.length) return { books, source: 'google' };
  } catch (err) {
    if (signal?.aborted) throw err;
  }
  const books = mode === 'isbn' ? await searchOpenLibraryByIsbn(q, signal) : await searchOpenLibrary(q, signal);
  return { books, source: 'openlibrary' };
}

export interface BestsellerResult {
  books: Book[];
  /** `kyobo`: 교보문고 주간 종합; `data4library`: 도서관 정보나루 인기대출도서; `curated`: our hand-picked list. */
  source: 'kyobo' | 'data4library' | 'curated';
  /** Ranking period (`YYYY-MM-DD`) and the page to credit, for 교보문고. */
  periodStart?: string;
  periodEnd?: string;
  sourceUrl?: string;
}

export async function fetchBestsellers(signal?: AbortSignal): Promise<BestsellerResult> {
  return callApi<BestsellerResult>('/api/books/bestsellers', signal);
}

/** A typed query that is really an ISBN (hyphens/spaces allowed) is looked up by ISBN. */
export function looksLikeIsbn(query: string) {
  const digits = query.replace(/[-\s]/g, '');
  return /^(97[89]\d{10}|\d{9}[\dXx])$/.test(digits);
}

/** Full book info by id (`kr_{ISBN}` → merged Aladin/Kakao/Naver detail). */
export async function fetchBookById(id: string, signal?: AbortSignal): Promise<Book | null> {
  if (id.startsWith('kr_')) {
    const { book } = await callApi<{ book: Book }>(`/api/books/${encodeURIComponent(id.slice(3))}`, signal);
    return book;
  }
  if (id.startsWith('g_')) return getGoogleBook(id.slice(2), signal);
  if (id.startsWith('o_')) return getOpenLibraryWork(id.slice(2), signal);
  return null;
}
