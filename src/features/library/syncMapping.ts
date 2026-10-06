import type { Book, LibraryEntry, ReadingLog, ReadingStatus, TreeSpeciesId } from '@/types';
import { TREE_SPECIES_IDS } from '@/types';

/** Row shapes of `supabase/migrations/0001_init.sql` (snake_case, timestamps as ISO strings). */
export interface BookRow {
  isbn13: string;
  title: string;
  authors: string[];
  translators: string[];
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  cover_url: string | null;
  description: string | null;
  category: string | null;
  price: number | null;
  link: string | null;
  source: string | null;
}

export interface UserBookRow {
  user_id: string;
  id: string;
  book_id: string;
  isbn13: string | null;
  book: Book;
  status: ReadingStatus;
  progress_unit: 'page' | 'percent' | null;
  current_page: number | null;
  current_percent: number | null;
  total_pages: number | null;
  rating: number | null;
  review: string | null;
  expectation: number | null;
  expectation_note: string | null;
  start_date: string | null;
  end_date: string | null;
  tree_species: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingLogRow {
  user_id: string;
  id: string;
  user_book_id: string;
  book_id: string;
  date: string;
  kind: ReadingLog['kind'];
  pages_delta: number;
  minutes: number;
  created_at: string;
}

const ISBN13 = /^\d{13}$/;

function nn<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function un<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

function toIso(ms: number) {
  return new Date(Number.isFinite(ms) ? ms : Date.now()).toISOString();
}

function toMs(iso: string | null | undefined) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : Date.now();
}

/** Only ISBN-13 books go into the shared `books` cache. */
export function validIsbn13(book: Book): string | null {
  return book.isbn13 && ISBN13.test(book.isbn13) ? book.isbn13 : null;
}

export function bookToRow(book: Book): BookRow | null {
  const isbn13 = validIsbn13(book);
  if (!isbn13) return null;
  return {
    isbn13,
    title: book.title,
    authors: book.authors ?? [],
    translators: book.translators ?? [],
    publisher: nn(book.publisher),
    published_date: nn(book.publishedDate),
    page_count: book.pageCount && book.pageCount > 0 ? Math.round(book.pageCount) : null,
    cover_url: nn(book.coverUrl),
    description: nn(book.description),
    category: nn(book.category),
    price: book.price != null ? Math.round(book.price) : null,
    link: nn(book.link),
    source: book.source,
  };
}

export function entryToRow(entry: LibraryEntry, userId: string): UserBookRow {
  return {
    user_id: userId,
    id: entry.id,
    book_id: entry.book.id,
    isbn13: validIsbn13(entry.book),
    book: entry.book,
    status: entry.status,
    progress_unit: nn(entry.progressUnit),
    current_page: entry.currentPage != null ? Math.max(0, Math.round(entry.currentPage)) : null,
    current_percent: entry.currentPercent != null ? Math.max(0, Math.min(100, entry.currentPercent)) : null,
    total_pages: entry.book.pageCount && entry.book.pageCount > 0 ? Math.round(entry.book.pageCount) : null,
    rating: nn(entry.rating),
    review: nn(entry.review),
    expectation: nn(entry.expectation),
    expectation_note: nn(entry.expectationNote),
    start_date: nn(entry.startDate),
    end_date: nn(entry.endDate),
    tree_species: nn(entry.treeSpecies),
    created_at: toIso(entry.createdAt),
    updated_at: toIso(entry.updatedAt),
  };
}

function speciesOrUndefined(value: string | null | undefined): TreeSpeciesId | undefined {
  return value && (TREE_SPECIES_IDS as readonly string[]).includes(value) ? (value as TreeSpeciesId) : undefined;
}

export function rowToEntry(row: UserBookRow): LibraryEntry {
  const book: Book = { ...row.book };
  if (!book.pageCount && row.total_pages) book.pageCount = row.total_pages;
  const entry: LibraryEntry = {
    id: row.id,
    book,
    status: row.status,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
    startDate: un(row.start_date),
    endDate: un(row.end_date),
    rating: row.rating != null ? Number(row.rating) : undefined,
    review: un(row.review),
    progressUnit: un(row.progress_unit),
    currentPage: un(row.current_page),
    currentPercent: row.current_percent != null ? Number(row.current_percent) : undefined,
    expectation: un(row.expectation),
    expectationNote: un(row.expectation_note),
    treeSpecies: speciesOrUndefined(row.tree_species),
  };
  for (const key of Object.keys(entry) as (keyof LibraryEntry)[]) {
    if (entry[key] === undefined) delete entry[key];
  }
  return entry;
}

export function logToRow(log: ReadingLog, userId: string): ReadingLogRow {
  return {
    user_id: userId,
    id: log.id,
    user_book_id: log.entryId,
    book_id: log.bookId,
    date: log.date,
    kind: log.kind,
    pages_delta: Math.max(0, Math.round(log.pagesDelta || 0)),
    minutes: Math.max(0, Math.min(600, Math.round(log.minutes ?? 0))),
    created_at: toIso(log.createdAt),
  };
}

export function rowToLog(row: ReadingLogRow): ReadingLog {
  const log: ReadingLog = {
    id: row.id,
    entryId: row.user_book_id,
    bookId: row.book_id,
    date: row.date,
    kind: row.kind,
    pagesDelta: row.pages_delta,
    createdAt: toMs(row.created_at),
  };
  if (row.minutes) log.minutes = row.minutes;
  return log;
}

/** What the first sync after sign-in has to upload so a guest's local data ends up in the account. */
export function planUpload(
  local: { entries: LibraryEntry[]; logs: ReadingLog[] },
  remote: { entries: LibraryEntry[]; logIds: Set<string> },
) {
  const remoteById = new Map(remote.entries.map((e) => [e.id, e]));
  const entries = local.entries.filter((e) => {
    const r = remoteById.get(e.id);
    return !r || r.updatedAt < e.updatedAt;
  });
  const entryIds = new Set([...remoteById.keys(), ...entries.map((e) => e.id)]);
  const logs = local.logs.filter((l) => !remote.logIds.has(l.id) && entryIds.has(l.entryId));
  return { entries, logs };
}
