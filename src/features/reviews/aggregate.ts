/** Pure review helpers (same rules as `book_review_summary()` in supabase/migrations/0004_garden_reviews.sql). */

export interface ReviewSummary {
  count: number;
  /** 0 when there are no reviews; otherwise rounded to 2 decimals. */
  average: number;
  /** Counts for 1★…5★ (index 0 = 1★); half stars round up (3.5 → 4★). */
  dist: [number, number, number, number, number];
}

export const REVIEW_BODY_MAX = 500;

/** Clamp to 0.5–5 in half-star steps, or null when there is no rating. */
export function normalizeRating(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(5, Math.max(0.5, Math.round(value * 2) / 2));
}

export function summarize(ratings: number[]): ReviewSummary {
  const valid = ratings.map(normalizeRating).filter((r): r is number => r !== null);
  const dist: ReviewSummary['dist'] = [0, 0, 0, 0, 0];
  for (const r of valid) dist[Math.ceil(r) - 1]++;
  const average = valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100 : 0;
  return { count: valid.length, average, dist };
}

/** Bar widths (0–100) for the distribution chart, relative to the busiest bucket. */
export function distributionPercents(summary: ReviewSummary): number[] {
  const max = Math.max(...summary.dist, 0);
  return summary.dist.map((n) => (max ? Math.round((n / max) * 100) : 0));
}

/** The text that will be published for a review (trimmed, capped). */
export function cleanReviewBody(text: string | null | undefined): string {
  return (text ?? '').trim().slice(0, REVIEW_BODY_MAX);
}
