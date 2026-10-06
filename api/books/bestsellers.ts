import { bestsellers } from '../_lib/books';
import { apiError, json, preflight } from '../_lib/http';

/** GET /api/books/bestsellers — 요즘 많이 읽는 책 (정보나루 인기대출 or curated list), CDN-cached for 6 hours. */
export async function GET() {
  const result = await bestsellers();
  if (!result.ok) return apiError(result.code);
  return json(result.data, { maxAge: 21600 });
}

export function OPTIONS() {
  return preflight();
}
