/**
 * Page counts and the full 책소개 from the Daum book page that Kakao's book search links to (`documents[].url`,
 * e.g. https://search.daum.net/search?w=bookpage&bookId=5824679&q=…). This is HTML scraping, not an API:
 * it is used only for single-book detail lookups, cached for a long time, and can be switched off with
 * `ENABLE_DAUM_PAGES=false` if the markup changes or Daum objects.
 */
import { parsePageCount } from './pages';
import { cleanText } from './text';

const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 30 * 86400_000;
const CACHE_MAX = 500;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const daumPagesEnabled = () => !/^(0|false|off|no)$/i.test(process.env.ENABLE_DAUM_PAGES ?? '');

export interface DaumBookFacts {
  pageCount?: number;
  /** `130*193mm` */
  size?: string;
  /** `2021-09-09` */
  publishedDate?: string;
  /** Full 책소개 (Kakao's `contents` is cut at ~200 characters); paragraphs separated by a blank line. */
  description?: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Reads the `<dt>label</dt><dd>value</dd>` rows of the bookpage info box. */
export function parseDaumBookPage(html: string): DaumBookFacts {
  const rows = new Map<string, string>();
  for (const m of html.matchAll(/<dt[^>]*>([\s\S]{1,80}?)<\/dt>\s*<dd[^>]*>([\s\S]{0,600}?)<\/dd>/g)) {
    const label = decode(m[1]).replace(/\s/g, '');
    if (!rows.has(label)) rows.set(label, decode(m[2]));
  }
  const facts: DaumBookFacts = {};
  const pages = rows.get('페이지수') ?? rows.get('쪽수') ?? rows.get('페이지');
  if (pages) {
    const first = /^(\d{1,5})\b/.exec(pages.replace(/,/g, ''));
    facts.pageCount = first ? parsePageCount(Number(first[1])) : parsePageCount(pages);
  }
  const size = /(\d{2,3}\s*[*x×]\s*\d{2,3}\s*mm)/i.exec(pages ?? rows.get('사이즈') ?? rows.get('판형') ?? '');
  if (size) facts.size = size[1].replace(/\s/g, '');
  const date = /(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})/.exec(rows.get('출판') ?? rows.get('출간일') ?? rows.get('발행일') ?? '');
  if (date) facts.publishedDate = `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`;
  const description = parseDaumIntro(html);
  if (description) facts.description = description;
  return facts;
}

/** The `<h3 class="tit">책소개</h3> … <p class="desc">…</p>` section; long ones hide the rest in `.hide_desc`. */
export function parseDaumIntro(html: string): string | undefined {
  const m = /<h3[^>]*>\s*책\s*소개\s*<\/h3>\s*<\/div>\s*<p[^>]*class="desc"[^>]*>([\s\S]{1,20000}?)<\/p>/.exec(html);
  if (!m) return undefined;
  const text = cleanText(m[1].replace(/<span[^>]*class="ellipsis"[^>]*>[\s\S]*?<\/span>/g, ''));
  if (!text) return undefined;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, '\n').trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs.join('\n\n') : undefined;
}

/** Only Daum bookpage URLs are fetched (never arbitrary URLs from upstream data). */
export function isDaumBookPageUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'search.daum.net' && u.searchParams.get('w') === 'bookpage' && /^\d+$/.test(u.searchParams.get('bookId') ?? '');
  } catch {
    return false;
  }
}

const cache = new Map<string, { at: number; facts: DaumBookFacts }>();

/** Facts for one book, keyed by ISBN. `null` when disabled, not a bookpage URL, or the fetch/parse failed. */
export async function daumBookFacts(isbn13: string, url: string | undefined, now = Date.now()): Promise<DaumBookFacts | null> {
  if (!daumPagesEnabled() || !isDaumBookPageUrl(url)) return null;
  const hit = cache.get(isbn13);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.facts;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const facts = parseDaumBookPage(await res.text());
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(isbn13, { at: now, facts });
    return facts;
  } catch {
    return null;
  }
}
