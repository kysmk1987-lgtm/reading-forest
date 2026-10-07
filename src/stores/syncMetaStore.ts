import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

/** Bookkeeping for the cloud sync of the account that owns this device's records (`profileStore.dataOwner`). */
interface SyncMetaState {
  /** Last local change of the account preferences (forest decor, settings, forest name / avatar); 0 = never changed here. */
  prefsUpdatedAt: number;
  /** Library entry ids the server has confirmed — one missing from a later pull was deleted on another device. */
  knownEntryIds: string[];
  /** Deletes that did not reach the server yet (offline); retried on the next sync so the entry does not come back. */
  pendingDeletes: string[];
  set: (patch: Partial<Omit<SyncMetaState, 'set'>>) => void;
}

export const useSyncMeta = create<SyncMetaState>()(
  persist(
    (set) => ({
      prefsUpdatedAt: 0,
      knownEntryIds: [],
      pendingDeletes: [],
      set: (patch) => set(patch),
    }),
    { name: 'rf-sync-meta', storage: persistStorage },
  ),
);

/** A different account (or a guest's data) now owns the device: forget the previous account's sync state. */
export function resetSyncMeta() {
  useSyncMeta.getState().set({ prefsUpdatedAt: 0, knownEntryIds: [], pendingDeletes: [] });
}
