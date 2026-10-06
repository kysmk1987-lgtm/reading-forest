import { progressPercent } from '@/features/library/growth';
import type { LibraryEntry } from '@/types';

/** Page → % of the book (rounded, 0–100); null when the total page count is unknown. */
export function pageToPercent(page: number, totalPages: number | undefined): number | null {
  if (!totalPages || totalPages <= 0 || !Number.isFinite(page)) return null;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, page) / totalPages) * 100)));
}

export interface CardProgressInput {
  unit: 'page' | 'percent';
  page?: number;
  percent?: number;
  totalPages?: number;
}

/** Where in the book a quote comes from; `percent` is null when it can't be determined (upload is blocked). */
export function cardProgress({ unit, page, percent, totalPages }: CardProgressInput): { percent: number | null; page: number | null } {
  if (unit === 'percent') {
    if (percent === undefined || !Number.isFinite(percent)) return { percent: null, page: null };
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    return { percent: p, page: totalPages ? Math.round((p / 100) * totalPages) : null };
  }
  if (page === undefined || !Number.isFinite(page) || page < 0) return { percent: null, page: null };
  return { percent: pageToPercent(page, totalPages), page: Math.round(page) };
}

/** Viewer's progress for the card's book (null = not in their library). Mirrors `viewer_progress()` in SQL. */
export function viewerProgressOf(entry: LibraryEntry | undefined): number | null {
  return entry ? progressPercent(entry) : null;
}

export interface BlurInput {
  mine: boolean;
  revealed: boolean;
  cardProgress: number;
  viewerProgress: number | null;
  /** Setting "읽지 않은 책의 문구도 가리기". */
  blurUnowned: boolean;
}

/** Same rule as `card_blurred_for_me()` in supabase/migrations/0003_gallery.sql. */
export function shouldBlur({ mine, revealed, cardProgress: card, viewerProgress, blurUnowned }: BlurInput): boolean {
  if (mine || revealed) return false;
  if (viewerProgress === null) return blurUnowned;
  return viewerProgress < card;
}

/** Finds the viewer's library entry for a card (ISBN-13 first, then app book id). */
export function findEntryForCard(
  entries: Record<string, LibraryEntry>,
  card: { isbn13: string | null; book_id: string | null },
): LibraryEntry | undefined {
  const list = Object.values(entries);
  return (
    (card.isbn13 ? list.find((e) => e.book.isbn13 === card.isbn13) : undefined) ??
    (card.book_id ? list.find((e) => e.book.id === card.book_id) : undefined)
  );
}
