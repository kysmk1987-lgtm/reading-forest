import type { SupabaseClient } from '@supabase/supabase-js';

import { DEFAULT_CRITTERS } from '@/features/forest/critters';
import { DEFAULT_AVATAR, isAvatarId } from '@/features/profile/avatars';
import { getSupabase } from '@/lib/supabase';
import { useCardsStore } from '@/stores/cardsStore';
import { useForestStore } from '@/stores/forestStore';
import { onLibraryMutation, useLibraryStore, type LibraryMutation } from '@/stores/libraryStore';
import { useProfileStore, isDefaultNickname } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncMeta } from '@/stores/syncMetaStore';
import type { Book, LibraryEntry, ReadingLog } from '@/types';

import { parsePrefs, PREFS_METADATA_KEY, reconcilePrefs, type AccountPrefs, type PrefsValues } from './accountPrefs';
import {
  bookToRow,
  entryToRow,
  logToRow,
  planUpload,
  reconcileDeletes,
  rowToEntry,
  rowToLog,
  withLegacyGardenColumns,
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
  // 23514: check violation — a tile beyond 11 on a project without migration 0006 (unlimited 땅 넓히기).
  if (error?.code === '23514') ({ error } = await write(rows.map(withLegacyGardenColumns)));
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
  const meta = useSyncMeta.getState();
  const allRemote = (booksRes.data as UserBookRow[]).map(rowToEntry);
  const deletes = reconcileDeletes(
    Object.keys(useLibraryStore.getState().entries),
    allRemote.map((e) => e.id),
    meta.knownEntryIds,
    meta.pendingDeletes,
  );
  for (const id of deletes.deleteRemote) await deleteEntry(sb, userId, id);
  const pending = new Set(meta.pendingDeletes);
  const remoteEntries = allRemote.filter((e) => !pending.has(e.id));
  const remoteIds = new Set(remoteEntries.map((e) => e.id));
  const remoteLogs = (logsRes.data as ReadingLogRow[]).map(rowToLog).filter((l) => remoteIds.has(l.entryId));

  useLibraryStore.getState().dropLocal(deletes.dropLocal);
  useLibraryStore.getState().mergeRemote({ entries: remoteEntries, logs: remoteLogs });

  const { entries, logs } = useLibraryStore.getState();
  const upload = planUpload(
    { entries: Object.values(entries), logs },
    { entries: remoteEntries, logIds: new Set(remoteLogs.map((l) => l.id)) },
  );
  await upsertEntries(sb, userId, upload.entries);
  await insertLogs(sb, userId, upload.logs);
  useSyncMeta.getState().set({ knownEntryIds: [...remoteIds, ...upload.entries.map((e) => e.id)] });
}

async function deleteEntry(sb: SupabaseClient, userId: string, id: string) {
  const { error } = await sb.from('user_books').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
  const meta = useSyncMeta.getState();
  meta.set({ pendingDeletes: meta.pendingDeletes.filter((p) => p !== id), knownEntryIds: meta.knownEntryIds.filter((k) => k !== id) });
}

function markKnown(id: string) {
  const meta = useSyncMeta.getState();
  if (!meta.knownEntryIds.includes(id)) meta.set({ knownEntryIds: [...meta.knownEntryIds, id] });
}

/** Account-level things outside the library tables: share slug of the public forest, gallery cards made elsewhere. */
async function syncAccountExtras(sb: SupabaseClient, userId: string) {
  const [forest, cards] = await Promise.all([
    sb.from('forests').select('share_slug').eq('owner_id', userId).maybeSingle(),
    sb.from('quote_cards').select('id, book_title, created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(1000),
  ]);
  if (!forest.error) useForestStore.getState().setPublishedSlug((forest.data?.share_slug as string | undefined) ?? null);
  if (!cards.error && cards.data) {
    const rows = cards.data as { id: string; book_title: string; created_at: string }[];
    useCardsStore.getState().mergeGallery(rows.map((r) => ({ galleryId: r.id, bookTitle: r.book_title, createdAt: Date.parse(r.created_at) || Date.now() })));
  }
}

function currentPrefs(): PrefsValues {
  const forest = useForestStore.getState();
  const settings = useSettingsStore.getState();
  const profile = useProfileStore.getState();
  return {
    forest: { weather: forest.weather, critters: [...forest.critters], gardenExtra: forest.gardenExtra },
    settings: { soundEnabled: settings.soundEnabled, blurUnownedQuotes: settings.blurUnownedQuotes, reviewVisibility: settings.reviewVisibility },
    look: { forestName: profile.forestName, avatar: profile.avatar },
  };
}

let applyingRemotePrefs = false;

function applyPrefs(prefs: AccountPrefs) {
  applyingRemotePrefs = true;
  try {
    const forest = useForestStore.getState();
    forest.setWeather(prefs.forest.weather);
    forest.setCritters(prefs.forest.critters);
    forest.setGardenExtra(prefs.forest.gardenExtra);
    const settings = useSettingsStore.getState();
    settings.setSoundEnabled(prefs.settings.soundEnabled);
    settings.setBlurUnownedQuotes(prefs.settings.blurUnownedQuotes);
    settings.setReviewVisibility(prefs.settings.reviewVisibility);
    const profile = useProfileStore.getState();
    profile.setForestName(prefs.look.forestName);
    profile.setAvatar(prefs.look.avatar);
  } finally {
    applyingRemotePrefs = false;
  }
  useSyncMeta.getState().set({ prefsUpdatedAt: prefs.updatedAt });
}

async function pushPrefs(sb: SupabaseClient) {
  const updatedAt = useSyncMeta.getState().prefsUpdatedAt || Date.now();
  const prefs: AccountPrefs = { v: 1, updatedAt, ...currentPrefs() };
  const { error } = await sb.auth.updateUser({ data: { [PREFS_METADATA_KEY]: prefs } });
  if (error) throw error;
}

/** Forest decor / settings / forest name + avatar: newer side wins (`user_metadata.rf_prefs`). */
async function syncPrefs(sb: SupabaseClient) {
  const { data, error } = await sb.auth.getUser();
  if (error) throw error;
  const remote = parsePrefs(data.user?.user_metadata?.[PREFS_METADATA_KEY]);
  const action = reconcilePrefs(currentPrefs(), useSyncMeta.getState().prefsUpdatedAt, remote);
  if (action === 'pull') applyPrefs(remote!);
  else if (action === 'push') await pushPrefs(sb);
}

/** Puts back the forest decor and share slug of no account (another account signed in on this device). */
export function resetAccountPrefs() {
  const forest = useForestStore.getState();
  forest.setWeather('clear');
  forest.setCritters([...DEFAULT_CRITTERS]);
  forest.setGardenExtra(0);
  forest.setPublishedSlug(null);
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

/** Postgres 42703 / PostgREST PGRST204: the forest_name/avatar columns (migration 0005) are not there yet. */
function missingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

/** Forest name and avatar: the remote value wins only over a local default; otherwise the local one is written. */
async function syncProfileLook(sb: SupabaseClient, userId: string) {
  const { data, error: readError } = await sb.from('profiles').select('forest_name, avatar').eq('id', userId).maybeSingle();
  if (missingColumn(readError)) return;
  if (readError) throw readError;
  const { forestName, avatar, setForestName, setAvatar } = useProfileStore.getState();
  const remote = data as { forest_name: string | null; avatar: string | null } | null;
  if (remote?.forest_name && !forestName) setForestName(remote.forest_name);
  if (isAvatarId(remote?.avatar) && avatar === DEFAULT_AVATAR) setAvatar(remote.avatar);
  const local = useProfileStore.getState();
  const patch = { forest_name: local.forestName || null, avatar: local.avatar === DEFAULT_AVATAR ? null : local.avatar };
  if (remote && remote.forest_name === patch.forest_name && remote.avatar === patch.avatar) return;
  await writeProfileLook(sb, userId, patch);
}

async function writeProfileLook(sb: SupabaseClient, userId: string, patch: { forest_name: string | null; avatar: string | null }) {
  const { error } = await sb.from('profiles').update(patch).eq('id', userId);
  if (error && !missingColumn(error)) throw error;
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
  // Prefs first: they may bring the account's forest name / avatar, which the profile-look sync then mirrors.
  syncPrefs(sb)
    .catch((err) => console.warn('[sync] prefs failed', err))
    .then(() => syncProfileLook(sb, userId))
    .catch((err) => console.warn('[sync] profile look failed', err));
  syncAccountExtras(sb, userId).catch((err) => console.warn('[sync] extras failed', err));

  const unsubscribe = onLibraryMutation((event: LibraryMutation) => {
    if (!active) return;
    if (event.type === 'upsert') {
      enqueue(async () => {
        await upsertEntries(sb, userId, [event.entry]);
        await insertLogs(sb, userId, event.logs);
        markKnown(event.entry.id);
      });
    } else {
      const meta = useSyncMeta.getState();
      if (!meta.pendingDeletes.includes(event.id)) meta.set({ pendingDeletes: [...meta.pendingDeletes, event.id] });
      enqueue(() => deleteEntry(sb, userId, event.id));
    }
  });

  let prefsTimer: ReturnType<typeof setTimeout> | null = null;
  const prefsChanged = () => {
    if (!active || applyingRemotePrefs) return;
    useSyncMeta.getState().set({ prefsUpdatedAt: Date.now() });
    if (prefsTimer) clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => enqueue(() => pushPrefs(sb)), 1500);
  };
  const unsubscribeForest = useForestStore.subscribe((s, prev) => {
    if (s.weather !== prev.weather || s.critters !== prev.critters || s.gardenExtra !== prev.gardenExtra) prefsChanged();
  });
  const unsubscribeSettings = useSettingsStore.subscribe((s, prev) => {
    if (s.soundEnabled !== prev.soundEnabled || s.blurUnownedQuotes !== prev.blurUnownedQuotes || s.reviewVisibility !== prev.reviewVisibility) prefsChanged();
  });

  const unsubscribeProfile = useProfileStore.subscribe((s, prev) => {
    if (!active) return;
    if (s.nickname !== prev.nickname) {
      enqueue(async () => {
        await sb.from('profiles').update({ nickname: s.nickname, updated_at: new Date().toISOString() }).eq('id', userId);
      });
    }
    if (s.forestName !== prev.forestName || s.avatar !== prev.avatar) {
      enqueue(() => writeProfileLook(sb, userId, { forest_name: s.forestName || null, avatar: s.avatar === DEFAULT_AVATAR ? null : s.avatar }));
      prefsChanged();
    }
  });

  return () => {
    active = false;
    if (prefsTimer) clearTimeout(prefsTimer);
    unsubscribe();
    unsubscribeProfile();
    unsubscribeForest();
    unsubscribeSettings();
  };
}
