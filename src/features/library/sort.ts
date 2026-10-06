import type { LibraryEntry } from '@/types';

export const SORT_OPTIONS = ['createdDesc', 'createdAsc', 'updatedDesc', 'title', 'rating'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export function sortEntries(entries: LibraryEntry[], sort: SortOption): LibraryEntry[] {
  const list = [...entries];
  switch (sort) {
    case 'createdDesc':
      return list.sort((a, b) => b.createdAt - a.createdAt);
    case 'createdAsc':
      return list.sort((a, b) => a.createdAt - b.createdAt);
    case 'updatedDesc':
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'title':
      return list.sort((a, b) => a.book.title.localeCompare(b.book.title, 'ko'));
    case 'rating':
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt - a.updatedAt);
  }
}
