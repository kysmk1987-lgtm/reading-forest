import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';
import type { LibraryEntry, LibraryEntryDraft } from '@/types';

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

interface LibraryState {
  entries: Record<string, LibraryEntry>;
  addEntry: (draft: LibraryEntryDraft) => LibraryEntry;
  updateEntry: (id: string, patch: Partial<LibraryEntryDraft>) => void;
  removeEntry: (id: string) => void;
  /** Merge remote entries (last write wins by `updatedAt`). */
  mergeEntries: (remote: LibraryEntry[]) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      addEntry: (draft) => {
        const now = Date.now();
        const entry: LibraryEntry = { ...draft, id: newId(), createdAt: now, updatedAt: now };
        set((s) => ({ entries: { ...s.entries, [entry.id]: entry } }));
        emit({ type: 'upsert', entry });
        return entry;
      },
      updateEntry: (id, patch) => {
        const current = get().entries[id];
        if (!current) return;
        const entry: LibraryEntry = { ...current, ...patch, updatedAt: Date.now() };
        set((s) => ({ entries: { ...s.entries, [id]: entry } }));
        emit({ type: 'upsert', entry });
      },
      removeEntry: (id) => {
        set((s) => {
          const { [id]: _removed, ...rest } = s.entries;
          return { entries: rest };
        });
        emit({ type: 'delete', id });
      },
      mergeEntries: (remote) => {
        set((s) => {
          const entries = { ...s.entries };
          for (const r of remote) {
            const local = entries[r.id];
            if (!local || local.updatedAt < r.updatedAt) entries[r.id] = r;
          }
          return { entries };
        });
      },
    }),
    { name: 'rf-library', storage: persistStorage },
  ),
);

export function findEntryByBookId(entries: Record<string, LibraryEntry>, bookId: string) {
  return Object.values(entries).find((e) => e.book.id === bookId);
}
