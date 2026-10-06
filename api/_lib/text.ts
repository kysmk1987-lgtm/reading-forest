const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  middot: '·',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

/** Strips tags (Naver wraps matches in `<b>`) and decodes common HTML entities. */
export function cleanText(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text || undefined;
}

/** Picks the longer of two descriptions (providers truncate differently). */
export function longer(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.replace(/…|\.\.\.$/, '').length > a.replace(/…|\.\.\.$/, '').length ? b : a;
}
