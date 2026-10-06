import type { Book } from '@/types';

const SEARCH_URL = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,subtitle,author_name,publisher,first_publish_year,number_of_pages_median,isbn,cover_i';

interface OpenLibraryDoc {
  key: string;
  title: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  isbn?: string[];
  cover_i?: number;
}

export function mapOpenLibraryDoc(doc: OpenLibraryDoc): Book {
  const isbn13 = doc.isbn?.find((i) => i.length === 13);
  const isbn10 = doc.isbn?.find((i) => i.length === 10);
  return {
    id: `o_${doc.key.replace('/works/', '')}`,
    source: 'openlibrary',
    title: [doc.title, doc.subtitle].filter(Boolean).join(' - '),
    authors: doc.author_name ?? [],
    publisher: doc.publisher?.[0],
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    pageCount: doc.number_of_pages_median || undefined,
    isbn13,
    isbn10,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
  };
}

async function search(params: Record<string, string>, signal?: AbortSignal): Promise<Book[]> {
  const qs = new URLSearchParams({ ...params, fields: FIELDS, limit: '30' });
  const res = await fetch(`${SEARCH_URL}?${qs}`, { signal });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs: OpenLibraryDoc[] };
  return data.docs.map(mapOpenLibraryDoc);
}

export function searchOpenLibrary(query: string, signal?: AbortSignal) {
  return search({ q: query }, signal);
}

export function searchOpenLibraryByIsbn(isbn: string, signal?: AbortSignal) {
  return search({ isbn }, signal);
}

export async function getOpenLibraryWork(workId: string, signal?: AbortSignal): Promise<Book | null> {
  const books = await search({ q: `key:/works/${workId}` }, signal);
  return books[0] ?? null;
}
