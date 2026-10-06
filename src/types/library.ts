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
}

export type LibraryEntryDraft = Omit<LibraryEntry, 'id' | 'createdAt' | 'updatedAt'>;

export const REVIEW_MAX_LENGTH = 500;
