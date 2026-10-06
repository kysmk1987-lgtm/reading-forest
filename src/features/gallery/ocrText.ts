const HANGUL = /[\uAC00-\uD7A3]/;

/**
 * Tidies OCR output for a quote: joins wrapped lines into paragraphs (blank lines stay as breaks),
 * removes the stray spaces Tesseract often puts between Hangul syllables, and collapses whitespace.
 */
export function cleanOcrText(raw: string): string {
  const paragraphs = raw
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  return paragraphs
    .map((p) => {
      const tokens = p.split(/\s+/);
      const singles = tokens.filter((t) => t.length === 1 && HANGUL.test(t)).length;
      // Mostly one-syllable tokens → the spaces are OCR artifacts, not word breaks.
      const text = tokens.length >= 4 && singles / tokens.length > 0.6 ? p.replace(/(?<=[\uAC00-\uD7A3])\s+(?=[\uAC00-\uD7A3])/g, '') : p;
      return text.replace(/\s+([.,!?…”’)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    })
    .join('\n');
}
