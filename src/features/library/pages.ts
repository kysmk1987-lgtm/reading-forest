import type { ProgressUnit } from '@/types';

/** Page progress needs a total; without one the record sheet starts in percent mode. */
export function defaultProgressUnit(pageCount?: number | null, saved?: ProgressUnit): ProgressUnit {
  if (saved) return saved;
  return pageCount && pageCount > 0 ? 'page' : 'percent';
}

/** What the 현재 진행 row shows: the known total, or the "직접 입력" fallback. */
export function pagesDisplay(pageCount: number | null | undefined, manualText: string): { total?: number; fallback: boolean } {
  const manual = parseInt(manualText.replace(/[^0-9]/g, ''), 10);
  const total = Number.isFinite(manual) && manual > 0 ? manual : pageCount && pageCount > 0 ? pageCount : undefined;
  return { total, fallback: !(pageCount && pageCount > 0) };
}
