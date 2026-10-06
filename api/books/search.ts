import { searchBooks } from '../_lib/books';
import { apiError, json, preflight } from '../_lib/http';
import type { SearchField } from '../_lib/providers';

const FIELDS: SearchField[] = ['keyword', 'title', 'author', 'publisher', 'isbn'];

/** GET /api/books/search?q=부의%20추월차선&field=keyword|title|author|publisher|isbn */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const fieldParam = url.searchParams.get('field') ?? 'keyword';
  const field = (FIELDS as string[]).includes(fieldParam) ? (fieldParam as SearchField) : 'keyword';

  const result = await searchBooks(q, field);
  if (!result.ok) return apiError(result.code);
  return json(result.data, { maxAge: 600 });
}

export function OPTIONS() {
  return preflight();
}
