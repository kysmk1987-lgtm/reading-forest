import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import { onLibraryMutation, useLibraryStore, type LibraryMutation } from '@/stores/libraryStore';
import { useProfileStore, isDefaultNickname } from '@/stores/profileStore';
import type { Book, LibraryEntry, ReadingLog } from '@/types';

import {
  bookToRow,
  entryToRow,
  logToRow,
  planUpload,
  rowToEntry,
  rowToLog,
  withoutGardenColumns,
  withoutSessionColumns,
  type BookRow,
  type ReadingLogRow,
  type UserBookRow,
} from './syncMapping';

/**
 * Mirrors the local library to Supabase (`user_books`, `reading_logs`, `books`).
 * Local storage stays the source of truth so the app works offline / without Supabase:
 * on sign-in we pull + merge, upload whatever the guest created locally, then write through every change.
 */

async function upsertBooks(sb: SupabaseClient, books: Book[]) {
  const rows = new Map<string, BookRow>();
  for (const b of books) {
    const row = bookToRow(b);
    if (row) rows.set(row.isbn13, row);
  }
  if (!rows.size) return;
  const { error } = await sb.from('books').upsert([...rows.values()], { onConflict: 'isbn13', ignoreDuplicates: true });
  if (error) throw error;
}

async function upsertEntries(sb: SupabaseClient, userId: string, entries: LibraryEntry[]) {
  if (!entries.length) return;
  await upsertBooks(sb, entries.map((e) => e.book));
  const rows = entries.map((e) => entryToRow(e, userId));
  const write = (r: UserBookRow[]) => sb.from('user_books').upsert(r, { onConflict: 'user_id,id' });
  let { error } = await write(rows);
  // PGRST204: column not found — migration 0004 (garden_x/garden_y) is not applied yet.
  if (error?.code === 'PGRST204') ({ error } = await write(rows.map(withoutGardenColumns)));
  if (error) throw error;
}

async function insertLogs(sb: SupabaseClient, userId: string, logs: ReadingLog[]) {
  if (!logs.length) return;
  const rows = logs.map((l) => logToRow(l, userId));
  const write = (r: ReadingLogRow[]) => sb.from('reading_logs').upsert(r, { onConflict: 'user_id,id', ignoreDuplicates: true });
  let { error } = await write(rows);
  // PGRST204: column not found — the project has not applied migration 0003 (sounds/room) yet.
  if (error?.code === 'PGRST204') ({ error } = await write(rows.map(withoutSessionColumns)));
  if (error) throw error;
}

let initialSync: Promise<void> | null = null;

/** Resolves once the first pull/upload after sign-in finished (or after `timeoutMs`), so server-side checks see local progress. */
export async function awaitInitialSync(timeoutMs = 6000) {
  if (!initialSync) return;
  await Promise.race([initialSync.catch(() => {}), new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** Pull remote rows, merge them locally, then upload local-only / newer data. */
export async function syncNow(userId: string) {
  const sb = getSupabase();
  if (!sb) return;
  const [booksRes, logsRes] = await Promise.all([
    sb.from('user_books').select('*').eq('user_id', userId),
    sb.from('reading_logs').select('*').eq('user_id', userId),
  ]);
  if (booksRes.error) throw booksRes.error;
  if (logsRes.error) throw logsRes.error;
  const remoteEntries = (booksRes.data as UserBookRow[]).map(rowToEntry);
  const remoteLogs = (logsRes.data as ReadingLogRow[]).map(rowToLog);

  useLibraryStore.getState().mergeRemote({ entries: remoteEntries, logs: remoteLogs });

  const { entries, logs } = useLibraryStore.getState();
  const upload = planUpload(
    { entries: Object.values(entries), logs },
    { entries: remoteEntries, logIds: new Set(remoteLogs.map((l) => l.id)) },
  );
  await upsertEntries(sb, userId, upload.entries);
  await insertLogs(sb, userId, upload.logs);
}

/** Remote nickname wins only over a default guest nickname; otherwise the local one (incl. the guest name) is written. */
async function syncProfile(sb: SupabaseClient, userId: string) {
  const { data, error: readError } = await sb.from('profiles').select('nickname').eq('id', userId).maybeSingle();
  if (readError) throw readError;
  const { nickname, setNickname } = useProfileStore.getState();
  if (data?.nickname && isDefaultNickname(nickname)) {
    setNickname(data.nickname);
    return;
  }
  if (data?.nickname === nickname) return;
  const { error } = await sb.from('profiles').update({ nickname, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw error;
}

export function startLibrarySync(userId: string): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  let active = true;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (task: () => Promise<unknown>) => {
    queue = queue.then(task).catch((err) => console.warn('[sync] write failed', err));
  };

  initialSync = syncNow(userId);
  enqueue(() => initialSync!);
  syncProfile(sb, userId).catch((err) => console.warn('[sync] profile failed', err));

  const unsubscribe = onLibraryMutation((event: LibraryMutation) => {
    if (!active) return;
    if (event.type === 'upsert') {
      enqueue(async () => {
        await upsertEntries(sb, userId, [event.entry]);
        await insertLogs(sb, userId, event.logs);
      });
    } else {
      enqueue(async () => {
        const { error } = await sb.from('user_books').delete().eq('user_id', userId).eq('id', event.id);
        if (error) throw error;
      });
    }
  });

  const unsubscribeProfile = useProfileStore.subscribe((s, prev) => {
    if (!active || s.nickname === prev.nickname) return;
    enqueue(async () => {
      await sb.from('profiles').update({ nickname: s.nickname, updated_at: new Date().toISOString() }).eq('id', userId);
    });
  });

  return () => {
    active = false;
    unsubscribe();
    unsubscribeProfile();
  };
}
