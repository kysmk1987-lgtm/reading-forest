import type { Book } from '@/types';

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY;

interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { smallThumbnail?: string; thumbnail?: string };
  };
}

function withKey(url: string) {
  return API_KEY ? `${url}${url.includes('?') ? '&' : '?'}key=${API_KEY}` : url;
}

function stripHtml(text?: string) {
  return text?.replace(/<[^>]+>/g, '').trim();
}

export function mapGoogleVolume(volume: GoogleVolume): Book {
  const info = volume.volumeInfo;
  const ids = info.industryIdentifiers ?? [];
  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  return {
    id: `g_${volume.id}`,
    source: 'google',
    title: [info.title, info.subtitle].filter(Boolean).join(' - ') || '(제목 없음)',
    authors: info.authors ?? [],
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    pageCount: info.pageCount || undefined,
    isbn13: ids.find((i) => i.type === 'ISBN_13')?.identifier,
    isbn10: ids.find((i) => i.type === 'ISBN_10')?.identifier,
    coverUrl: cover?.replace(/^http:/, 'https:').replace('&edge=curl', ''),
    description: stripHtml(info.description),
  };
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(withKey(url), { signal });
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchGoogleBooks(query: string, signal?: AbortSignal): Promise<Book[]> {
  const url = `${BASE_URL}?q=${encodeURIComponent(query)}&maxResults=30&printType=books`;
  const data = await getJSON<{ items?: GoogleVolume[] }>(url, signal);
  return (data.items ?? []).map(mapGoogleVolume);
}

export async function getGoogleBook(volumeId: string, signal?: AbortSignal): Promise<Book> {
  const data = await getJSON<GoogleVolume>(`${BASE_URL}/${encodeURIComponent(volumeId)}`, signal);
  return mapGoogleVolume(data);
}
