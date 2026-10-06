import type { Book } from './book';

export const READING_STATUSES = ['read', 'reading', 'want', 'stopped'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export type ProgressUnit = 'page' | 'percent';

export interface LibraryEntry {
  id: string;
  book: Book;
  status: ReadingStatus;
  createdAt: number;
  updatedAt: number;
  /** ISO date `YYYY-MM-DD`. */
  startDate?: string;
  /** End date for `read`, stop date for `stopped`. */
  endDate?: string;
  /** 0–5 stars. */
  rating?: number;
  review?: string;
  progressUnit?: ProgressUnit;
  currentPage?: number;
  currentPercent?: number;
  /** 기대지수: 0–5 hearts (status `want`). */
  expectation?: number;
  expectationNote?: string;
  /** Tree species shown in the forest; defaults to a basic species derived from the book id. */
  treeSpecies?: TreeSpeciesId;
}

export type LibraryEntryDraft = Omit<LibraryEntry, 'id' | 'createdAt' | 'updatedAt'>;

export const TREE_SPECIES_IDS = ['round', 'pine', 'apple', 'cherry', 'baobab', 'maple'] as const;
export type TreeSpeciesId = (typeof TREE_SPECIES_IDS)[number];

/** `add`: started/added a book, `progress`: pages read, `complete`: finished the book. */
export type ReadingLogKind = 'add' | 'progress' | 'complete';

/** One reading activity on a day; powers the calendar and statistics. */
export interface ReadingLog {
  id: string;
  entryId: string;
  bookId: string;
  /** ISO date `YYYY-MM-DD` (local). */
  date: string;
  kind: ReadingLogKind;
  /** Pages read in this activity (0 when unknown). */
  pagesDelta: number;
  createdAt: number;
}

export const REVIEW_MAX_LENGTH = 500;
