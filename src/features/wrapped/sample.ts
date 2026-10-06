import type { LibraryEntry, ReadingLog } from '@/types';

import type { WrappedInput, WrappedPeriod } from './compute';

const SAMPLE_BOOKS: { title: string; author: string; category: string; pages: number }[] = [
  { title: '작별하지 않는다', author: '한강', category: '국내도서>소설/시/희곡>한국소설', pages: 332 },
  { title: '아몬드', author: '손원평', category: '국내도서>소설/시/희곡>한국소설', pages: 264 },
  { title: '불편한 편의점', author: '김호연', category: '국내도서>소설/시/희곡>한국소설', pages: 268 },
  { title: '어린 왕자', author: '앙투안 드 생텍쥐페리', category: '국내도서>소설/시/희곡>프랑스소설', pages: 150 },
  { title: '데미안', author: '헤르만 헤세', category: '국내도서>소설/시/희곡>독일소설', pages: 228 },
  { title: '코스모스', author: '칼 세이건', category: '국내도서>과학>천문학', pages: 719 },
  { title: '소년이 온다', author: '한강', category: '국내도서>소설/시/희곡>한국소설', pages: 216 },
  { title: '사피엔스', author: '유발 하라리', category: '국내도서>역사>세계사', pages: 636 },
  { title: '채식주의자', author: '한강', category: '국내도서>소설/시/희곡>한국소설', pages: 247 },
  { title: '여행의 이유', author: '김영하', category: '국내도서>에세이>한국에세이', pages: 216 },
];

/** Deterministic PRNG so the sample report looks the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A believable "심야의 사색가" reader for the given period (체험용 샘플 리포트). */
export function sampleWrappedInput(period: WrappedPeriod): WrappedInput {
  const rand = rng(period.kind === 'year' ? 2026 : period.month * 31 + period.year);
  const months = period.kind === 'year' ? Array.from({ length: 12 }, (_, i) => i + 1) : [period.month];
  const perMonthTrees = period.kind === 'year' ? 3.5 : 6;
  const entries: LibraryEntry[] = [];
  const logs: ReadingLog[] = [];
  const sessions: WrappedInput['sessions'] = [];
  const cards: WrappedInput['cards'] = [];
  let n = 0;
  for (const month of months) {
    const days = new Date(period.year, month, 0).getDate();
    const trees = Math.round(perMonthTrees + (rand() - 0.5) * 2);
    for (let i = 0; i < trees; i++) {
      const b = SAMPLE_BOOKS[n % SAMPLE_BOOKS.length];
      const day = 1 + Math.floor(rand() * (days - 5));
      const finished = rand() < (period.kind === 'year' ? 0.45 : 0.55);
      const created = new Date(period.year, month - 1, day, 21, 0).getTime();
      const id = `sample_${n}`;
      entries.push({
        id,
        book: { id: `sample_book_${n}`, source: 'aladin', title: b.title, authors: [b.author], category: b.category, pageCount: b.pages },
        status: finished ? 'read' : 'reading',
        createdAt: created,
        updatedAt: created,
        startDate: `${period.year}-${pad(month)}-${pad(day)}`,
        endDate: finished ? `${period.year}-${pad(month)}-${pad(Math.min(days, day + 4))}` : undefined,
        rating: finished ? (b.author === '한강' ? 5 : 3 + Math.floor(rand() * 2)) : undefined,
      } as LibraryEntry);
      n++;
    }
    const streakStart = 3 + Math.floor(rand() * 5);
    for (let d = 1; d <= days; d++) {
      const inStreak = d >= streakStart && d < streakStart + (period.kind === 'year' && month === 11 ? 23 : 9);
      if (!inStreak && rand() < 0.45) continue;
      const date = `${period.year}-${pad(month)}-${pad(d)}`;
      const late = rand() < 0.75;
      const ended = new Date(period.year, month - 1, d, late ? 2 : 20, Math.floor(rand() * 50)).getTime();
      const minutes = 25 + Math.floor(rand() * 4) * 10;
      sessions.push({ endedAt: ended, minutes, sounds: late ? ['rain', 'library'] : ['cafe'], room: late ? 'rainy-bookstore' : null });
      logs.push({
        id: `sample_log_${date}`,
        entryId: entries[Math.floor(rand() * entries.length)]?.id ?? 'sample_0',
        bookId: 'sample',
        date,
        kind: 'progress',
        pagesDelta: 20 + Math.floor(rand() * 40),
        createdAt: ended,
      });
    }
    const cardCount = period.kind === 'year' ? 2 : 4;
    for (let i = 0; i < cardCount; i++) cards.push({ createdAt: new Date(period.year, month - 1, 2 + i * 5, 23).getTime() });
  }
  return { entries, logs, sessions, cards };
}
