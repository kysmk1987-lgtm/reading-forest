import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { BOOK_REGION } from '@/config/locale';
import { BookApiError, fetchBestsellers, fetchBookById, searchBooks, type SearchMode } from '@/lib/api/books';
import { useBookCacheStore } from '@/stores/bookCacheStore';
import { findEntryByBookId, useLibraryStore } from '@/stores/libraryStore';
import type { Book } from '@/types';

/** Don't hammer the proxy when the failure is a config problem rather than a blip. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof BookApiError && ['NO_KEYS', 'BAD_REQUEST', 'NOT_FOUND'].includes(error.code)) return false;
  return failureCount < 1;
}

export function useBookSearch(query: string, mode: SearchMode) {
  const remember = useBookCacheStore((s) => s.remember);
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['bookSearch', mode, trimmed],
    enabled: trimmed.length >= (mode === 'isbn' ? 10 : 1),
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const result = await searchBooks(trimmed, mode, signal);
      remember(result.books);
      return result;
    },
  });
}

/** 베스트셀러 추천 (Korea only; served by `/api/books/bestsellers`, cached 6h on the CDN). */
export function useBestsellers() {
  const remember = useBookCacheStore((s) => s.remember);
  return useQuery({
    queryKey: ['bestsellers'],
    enabled: BOOK_REGION === 'KR',
    staleTime: 1000 * 60 * 60 * 6,
    retry: shouldRetry,
    queryFn: async ({ signal }) => {
      const result = await fetchBestsellers(signal);
      remember(result.books);
      return result;
    },
  });
}

function definedFields(book: Book): Partial<Book> {
  return Object.fromEntries(Object.entries(book).filter(([, v]) => v !== undefined && v !== '')) as Partial<Book>;
}

/**
 * Book for the detail page. Shows library/search-cache data instantly, then merges the full detail
 * (big cover, description, pages…) from the API and backfills it into the saved library entry.
 */
export function useBook(id: string) {
  const cached = useBookCacheStore((s) => s.books[id]);
  const entry = useLibraryStore((s) => findEntryByBookId(s.entries, id));
  const updateEntry = useLibraryStore((s) => s.updateEntry);
  const local = entry?.book ?? cached;

  const query = useQuery({
    queryKey: ['book', id],
    enabled: id.startsWith('kr_') || !local,
    retry: shouldRetry,
    staleTime: 1000 * 60 * 60,
    queryFn: ({ signal }) => fetchBookById(id, signal),
  });

  const book = useMemo<Book | null>(() => {
    if (local && query.data) return { ...local, ...definedFields(query.data), id: local.id };
    return local ?? query.data ?? null;
  }, [local, query.data]);

  useEffect(() => {
    if (!entry || !query.data) return;
    const missing = (['pageCount', 'description', 'coverUrl', 'category', 'translators'] as const).some(
      (k) => entry.book[k] === undefined && query.data?.[k] !== undefined,
    );
    if (missing) updateEntry(entry.id, { book: { ...entry.book, ...definedFields(query.data), id: entry.book.id } });
  }, [entry, query.data, updateEntry]);

  return { book, isLoading: !local && query.isLoading, isEnriching: query.isFetching, error: query.error };
}
