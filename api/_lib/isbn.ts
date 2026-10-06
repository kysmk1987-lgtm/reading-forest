export function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn(isbn: string): boolean {
  return /^\d{13}$/.test(isbn) || /^\d{9}[\dX]$/.test(isbn);
}

/** Splits provider strings like `"8996991341 9788996991342"` (Kakao/Naver) into ISBN-10 / ISBN-13. */
export function splitIsbns(raw: string | undefined): { isbn10?: string; isbn13?: string } {
  const out: { isbn10?: string; isbn13?: string } = {};
  for (const part of (raw ?? '').split(/\s+/)) {
    const code = cleanIsbn(part);
    if (code.length === 13) out.isbn13 ??= code;
    else if (code.length === 10) out.isbn10 ??= code;
  }
  return out;
}

/** ISBN-10 → ISBN-13 (978 prefix). */
export function isbn10to13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = core.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

export function bookIdFor(isbn13?: string, isbn10?: string): string | null {
  const key = isbn13 ?? (isbn10 ? isbn10to13(isbn10) : undefined);
  return key ? `kr_${key}` : null;
}
