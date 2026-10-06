import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { growthStageFor, progressPercent, stageIndex } from '@/features/library/growth';
import { backfillLogs, logsForChange, type ReadingLogDraft } from '@/features/library/readingLog';
import { persistStorage } from '@/lib/storage';
import type { LibraryEntry, LibraryEntryDraft, ReadingLog } from '@/types';

import { useCelebrationStore } from './celebrationStore';

type Listener = (event: { type: 'upsert'; entry: LibraryEntry } | { type: 'delete'; id: string }) => void;
const listeners = new Set<Listener>();

/** Lets the cloud sync layer mirror local mutations without coupling the store to Firebase. */
export function onLibraryMutation(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: Parameters<Listener>[0]) {
  listeners.forEach((l) => l(event));
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toLogs(drafts: ReadingLogDraft[]): ReadingLog[] {
  const now = Date.now();
  return drafts.map((d) => ({ ...d, id: newId(), createdAt: now }));
}

/** Celebrate when a reading/finished book reaches a new growth stage. */
function maybeCelebrate(before: LibraryEntry | undefined, after: LibraryEntry) {
  if (after.status !== 'reading' && after.status !== 'read') return;
  const from = growthStageFor(before && before.status !== 'want' ? progressPercent(before) : 0).stage;
  const to = growthStageFor(progressPercent(after)).stage;
  if (stageIndex(to) > stageIndex(from)) useCelebrationStore.getState().celebrate({ entry: after, from, to });
}

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  /** Reading activity history (newest last). */
  logs: ReadingLog[];
  addEntry: (draft: LibraryEntryDraft) => LibraryEntry;
  updateEntry: (id: string, patch: Partial<LibraryEntryDraft>) => void;
  removeEntry: (id: string) => void;
  /** Merge remote entries (last write wins by `updatedAt`). */
  mergeEntries: (remote: LibraryEntry[]) => void;
}

interface PersistedV0 {
  entries?: Record<string, LibraryEntry>;
  logs?: ReadingLog[];
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      logs: [],
      addEntry: (draft) => {
        const now = Date.now();
        const entry: LibraryEntry = { ...draft, id: newId(), createdAt: now, updatedAt: now };
        const logs = toLogs(logsForChange(undefined, entry));
        set((s) => ({ entries: { ...s.entries, [entry.id]: entry }, logs: [...s.logs, ...logs] }));
        emit({ type: 'upsert', entry });
        maybeCelebrate(undefined, entry);
        return entry;
      },
      updateEntry: (id, patch) => {
        const current = get().entries[id];
        if (!current) return;
        const entry: LibraryEntry = { ...current, ...patch, updatedAt: Date.now() };
        const logs = toLogs(logsForChange(current, entry));
        set((s) => ({ entries: { ...s.entries, [id]: entry }, logs: logs.length ? [...s.logs, ...logs] : s.logs }));
        emit({ type: 'upsert', entry });
        maybeCelebrate(current, entry);
      },
      removeEntry: (id) => {
        set((s) => {
          const { [id]: _removed, ...rest } = s.entries;
          return { entries: rest, logs: s.logs.filter((l) => l.entryId !== id) };
        });
        emit({ type: 'delete', id });
      },
      mergeEntries: (remote) => {
        set((s) => {
          const entries = { ...s.entries };
          const added: LibraryEntry[] = [];
          for (const r of remote) {
            const local = entries[r.id];
            if (!local) added.push(r);
            if (!local || local.updatedAt < r.updatedAt) entries[r.id] = r;
          }
          return { entries, logs: [...s.logs, ...toLogs(backfillLogs(added))] };
        });
      },
    }),
    {
      name: 'rf-library',
      storage: persistStorage,
      version: 1,
      // v0 had no reading logs: rebuild them from the saved entries.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedV0;
        if (version < 1) {
          state.logs = toLogs(backfillLogs(Object.values(state.entries ?? {})));
        }
        return state as LibraryState;
      },
    },
  ),
);

export function findEntryByBookId(entries: Record<string, LibraryEntry>, bookId: string) {
  return Object.values(entries).find((e) => e.book.id === bookId);
}
