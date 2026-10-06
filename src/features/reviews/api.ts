import { ensureSession } from '@/features/auth/useAuth';
import { getSupabase } from '@/lib/supabase';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { LibraryEntry } from '@/types';

import { cleanReviewBody, normalizeRating, summarize, type ReviewSummary } from './aggregate';

/** One row of `book_reviews_feed()`. */
export interface BookReview {
  id: number;
  rating: number;
  body: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
  mine: boolean;
}

export interface ReviewsResult {
  /** `server`: community reviews; `local`: Supabase not configured; `unavailable`: migration 0004 not applied. */
  mode: 'server' | 'local' | 'unavailable';
  summary: ReviewSummary;
  reviews: BookReview[];
}

const ISBN13 = /^\d{13}$/;
/** Set once the server answers "no such function" so later screens don't repeat the 404 until a reload. */
let schemaMissing = false;

export const isReviewsConfigured = () => getSupabase() !== null;

/** PostgREST codes for "function/table not found" (migration 0004 not applied yet). */
function isMissingSchema(error: { code?: string } | null) {
  return !!error && ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '');
}

/** The reader's own review built from the library entry (used when there is no server). */
function localReview(entry: LibraryEntry | undefined): BookReview[] {
  const rating = normalizeRating(entry?.rating);
  if (!entry || !rating) return [];
  const at = new Date(entry.updatedAt).toISOString();
  return [
    {
      id: -1,
      rating,
      body: cleanReviewBody(entry.review) || null,
      nickname: useProfileStore.getState().nickname,
      created_at: at,
      updated_at: at,
      mine: true,
    },
  ];
}

export async function fetchReviews(isbn13: string | undefined, entry?: LibraryEntry): Promise<ReviewsResult> {
  const sb = getSupabase();
  const local = localReview(entry);
  if (!sb || !isbn13 || !ISBN13.test(isbn13)) {
    return { mode: 'local', summary: summarize(local.map((r) => r.rating)), reviews: local };
  }
  const unavailable = (): ReviewsResult => ({ mode: 'unavailable', summary: summarize(local.map((r) => r.rating)), reviews: local });
  if (schemaMissing) return unavailable();
  const [summary, feed] = await Promise.all([
    sb.rpc('book_review_summary', { p_isbn: isbn13 }),
    sb.rpc('book_reviews_feed', { p_isbn: isbn13, p_limit: 50, p_offset: 0 }),
  ]);
  if (isMissingSchema(summary.error) || isMissingSchema(feed.error)) {
    schemaMissing = true;
    return unavailable();
  }
  if (summary.error) throw summary.error;
  if (feed.error) throw feed.error;
  const s = summary.data as { count: number; average: number; dist: number[] } | null;
  const reviews = ((feed.data ?? []) as BookReview[]).map((r) => ({ ...r, rating: Number(r.rating) }));
  return {
    mode: 'server',
    summary: {
      count: Number(s?.count ?? 0),
      average: Number(s?.average ?? 0),
      dist: [0, 1, 2, 3, 4].map((i) => Number(s?.dist?.[i] ?? 0)) as ReviewSummary['dist'],
    },
    reviews,
  };
}

async function writer() {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await ensureSession();
  return uid ? { sb, uid } : null;
}

/** Publishes (or updates) my review. Returns false when it could not be saved on the server. */
export async function saveReview(isbn13: string, rating: number, body: string): Promise<boolean> {
  const value = normalizeRating(rating);
  if (!value || !ISBN13.test(isbn13) || schemaMissing) return false;
  const w = await writer();
  if (!w) return false;
  const { error } = await w.sb.rpc('upsert_book_review', {
    p_isbn: isbn13,
    p_rating: value,
    p_body: cleanReviewBody(body),
    p_nickname: useProfileStore.getState().nickname.slice(0, 32),
  });
  if (isMissingSchema(error)) schemaMissing = true;
  return !error;
}

export async function deleteMyReview(isbn13: string): Promise<boolean> {
  const w = await writer();
  if (!w) return false;
  const { error } = await w.sb.from('book_reviews').delete().eq('user_id', w.uid).eq('isbn13', isbn13);
  return !error;
}

export async function reportReview(id: number, reason = ''): Promise<'ok' | 'already' | 'failed'> {
  const w = await writer();
  if (!w) return 'failed';
  const { error } = await w.sb.from('book_review_reports').insert({ review_id: id, reason: reason.slice(0, 200) || null });
  if (!error) return 'ok';
  return error.code === '23505' ? 'already' : 'failed';
}

/** 나만 보기로 바꿀 때: removes every review I published. */
export async function hideMyReviews(): Promise<boolean> {
  const w = await writer();
  if (!w) return false;
  const { error } = await w.sb.from('book_reviews').delete().eq('user_id', w.uid);
  return !error || isMissingSchema(error);
}

/**
 * Record sheet → 리뷰 탭: when 한줄평 공개 범위 is 전체 공개, the rating/한줄평 of a finished (or paused) book
 * is published as the reader's review. Silent no-op without Supabase, an ISBN or a rating.
 */
export async function publishFromRecord(entry: LibraryEntry): Promise<void> {
  if (useSettingsStore.getState().reviewVisibility !== 'public') return;
  const isbn = entry.book.isbn13;
  const rating = normalizeRating(entry.rating);
  if (!isbn || !rating || !isReviewsConfigured()) return;
  if (entry.status !== 'read' && entry.status !== 'stopped') return;
  await saveReview(isbn, rating, entry.review ?? '').catch(() => false);
}
