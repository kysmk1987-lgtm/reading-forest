import { create } from 'zustand';

import type { Book } from '@/types';

/** In-memory cache of books seen in search results so the detail page opens instantly. */
interface BookCacheState {
  books: Record<string, Book>;
  remember: (books: Book[]) => void;
}

export const useBookCacheStore = create<BookCacheState>()((set) => ({
  books: {},
  remember: (books) =>
    set((s) => {
      const next = { ...s.books };
      books.forEach((b) => (next[b.id] = b));
      return { books: next };
    }),
}));
