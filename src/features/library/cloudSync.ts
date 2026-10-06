import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';
import { onLibraryMutation, useLibraryStore } from '@/stores/libraryStore';
import type { LibraryEntry } from '@/types';

/**
 * Mirrors the local library to Firestore at `users/{uid}/library/{entryId}`.
 * Local storage stays the source of truth so the app works offline / without Firebase.
 */
export function startLibrarySync(uid: string): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  const col = collection(fb.db, 'users', uid, 'library');

  getDocs(col)
    .then((snap) => {
      const remote = snap.docs.map((d) => d.data() as LibraryEntry);
      useLibraryStore.getState().mergeEntries(remote);
      const remoteIds = new Set(remote.map((r) => r.id));
      Object.values(useLibraryStore.getState().entries)
        .filter((e) => !remoteIds.has(e.id))
        .forEach((e) => setDoc(doc(col, e.id), e).catch(() => {}));
    })
    .catch((err) => console.warn('[sync] pull failed', err));

  const unsubscribe = onLibraryMutation((event) => {
    const op =
      event.type === 'upsert' ? setDoc(doc(col, event.entry.id), event.entry) : deleteDoc(doc(col, event.id));
    op.catch((err) => console.warn('[sync] write failed', err));
  });
  return () => {
    unsubscribe();
  };
}
