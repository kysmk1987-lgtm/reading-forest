import { lookupBook } from '../_lib/books';
import { apiError, json, preflight } from '../_lib/http';

/** GET /api/books/9791187444725 — merged detail (cover, description, pages, translators, price, category). */
export async function GET(request: Request) {
  const isbn = decodeURIComponent(new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '');
  const result = await lookupBook(isbn);
  if (!result.ok) return apiError(result.code);
  // A found page count (often scraped from Daum) is kept at the CDN for 30 days so the page is fetched rarely.
  return json({ book: result.data }, { maxAge: result.data.pageCount ? 30 * 86400 : 86400 });
}

export function OPTIONS() {
  return preflight();
}
