export type BookSource = 'kakao' | 'aladin' | 'naver' | 'kyobo' | 'google' | 'openlibrary' | 'manual';

export interface Book {
  /**
   * Stable id. Korean market books use `kr_{ISBN}` (ISBN-13 preferred);
   * global providers use `g_` (Google volume id) / `o_` (Open Library work id).
   */
  id: string;
  source: BookSource;
  title: string;
  authors: string[];
  translators?: string[];
  publisher?: string;
  /** `YYYY-MM-DD` (or `YYYY` when only the year is known). */
  publishedDate?: string;
  pageCount?: number;
  isbn13?: string;
  isbn10?: string;
  coverUrl?: string;
  description?: string;
  /** List price in KRW. */
  price?: number;
  category?: string;
  /** Store page (Aladin / Kakao / Naver). */
  link?: string;
}
