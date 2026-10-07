import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { validGardenCoord, type Tile } from '@/features/forest/layout';
import { growthStageFor, progressPercent, stageIndex } from '@/features/library/growth';
import { backfillLogs, logsForChange, type ReadingLogDraft } from '@/features/library/readingLog';
import { persistStorage } from '@/lib/storage';
import type { LibraryEntry, LibraryEntryDraft, ReadingLog } from '@/types';

import { useCelebrationStore } from './celebrationStore';

export type LibraryMutation =
  | { type: 'upsert'; entry: LibraryEntry; logs: ReadingLog[] }
  | { type: 'delete'; id: string };
type Listener = (event: LibraryMutation) => void;
const listeners = new Set<Listener>();

/** Lets the cloud sync layer mirror local mutations without coupling the store to the backend. */
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
  /** Records a finished focus (timer) session for a book. */
  addFocusLog: (entryId: string, minutes: number, date: string, extra?: { sounds?: string[]; room?: string }) => void;
  /** Merge remote entries (last write wins by `updatedAt`) and logs (union by id). */
  mergeRemote: (remote: { entries: LibraryEntry[]; logs: ReadingLog[] }) => void;
  /** 옮겨 심기: saves garden tiles (only entries whose tile changed are touched). */
  plantTrees: (positions: Record<string, Tile>) => void;
  /** Drops the on-device copy without syncing deletes (used when a different account signs in). */
  clearLocal: () => void;
  /** Removes entries (and their logs) that were deleted on another device, without emitting deletes. */
  dropLocal: (ids: string[]) => void;
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
        emit({ type: 'upsert', entry, logs });
        maybeCelebrate(undefined, entry);
        return entry;
      },
      updateEntry: (id, patch) => {
        const current = get().entries[id];
        if (!current) return;
        const entry: LibraryEntry = { ...current, ...patch, updatedAt: Date.now() };
        const logs = toLogs(logsForChange(current, entry));
        set((s) => ({ entries: { ...s.entries, [id]: entry }, logs: logs.length ? [...s.logs, ...logs] : s.logs }));
        emit({ type: 'upsert', entry, logs });
        maybeCelebrate(current, entry);
      },
      removeEntry: (id) => {
        set((s) => {
          const { [id]: _removed, ...rest } = s.entries;
          return { entries: rest, logs: s.logs.filter((l) => l.entryId !== id) };
        });
        emit({ type: 'delete', id });
      },
      addFocusLog: (entryId, minutes, date, extra) => {
        const entry = get().entries[entryId];
        if (!entry || minutes <= 0) return;
        const draft: ReadingLogDraft = { entryId, bookId: entry.book.id, date, kind: 'focus', pagesDelta: 0, minutes: Math.round(minutes) };
        if (extra?.sounds?.length) draft.sounds = extra.sounds;
        if (extra?.room) draft.room = extra.room;
        const logs = toLogs([draft]);
        set((s) => ({ logs: [...s.logs, ...logs] }));
        emit({ type: 'upsert', entry, logs });
      },
      mergeRemote: (remote) => {
        set((s) => {
          const entries = { ...s.entries };
          for (const r of remote.entries) {
            const local = entries[r.id];
            if (!local || local.updatedAt < r.updatedAt) entries[r.id] = r;
          }
          const seen = new Set(s.logs.map((l) => l.id));
          const incoming = remote.logs.filter((l) => !seen.has(l.id) && entries[l.entryId]);
          const covered = new Set([...s.logs, ...incoming].map((l) => l.entryId));
          const missing = remote.entries.filter((r) => !covered.has(r.id));
          const logs = [...s.logs, ...incoming, ...toLogs(backfillLogs(missing))].sort((a, b) => a.createdAt - b.createdAt);
          return { entries, logs };
        });
      },
      plantTrees: (positions) => {
        const now = Date.now();
        const changed: LibraryEntry[] = [];
        const entries = { ...get().entries };
        for (const [id, tile] of Object.entries(positions)) {
          const current = entries[id];
          if (!current || (current.gardenX === tile.c && current.gardenY === tile.r)) continue;
          const entry = { ...current, gardenX: tile.c, gardenY: tile.r, updatedAt: now };
          entries[id] = entry;
          changed.push(entry);
        }
        if (!changed.length) return;
        set({ entries });
        changed.forEach((entry) => emit({ type: 'upsert', entry, logs: [] }));
      },
      clearLocal: () => set({ entries: {}, logs: [] }),
      dropLocal: (ids) => {
        if (!ids.length) return;
        const gone = new Set(ids);
        set((s) => ({
          entries: Object.fromEntries(Object.entries(s.entries).filter(([id]) => !gone.has(id))),
          logs: s.logs.filter((l) => !gone.has(l.entryId)),
        }));
      },
    }),
    {
      name: 'rf-library',
      storage: persistStorage,
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as PersistedV0;
        // v0 had no reading logs: rebuild them from the saved entries.
        if (version < 1) {
          state.logs = toLogs(backfillLogs(Object.values(state.entries ?? {})));
        }
        // v2 added garden tiles (옮겨 심기): keep only valid, paired coordinates.
        if (version < 2) {
          for (const entry of Object.values(state.entries ?? {})) {
            if (!validGardenCoord(entry.gardenX) || !validGardenCoord(entry.gardenY)) {
              delete entry.gardenX;
              delete entry.gardenY;
            }
          }
        }
        return state as LibraryState;
      },
    },
  ),
);

export function findEntryByBookId(entries: Record<string, LibraryEntry>, bookId: string) {
  return Object.values(entries).find((e) => e.book.id === bookId);
}
