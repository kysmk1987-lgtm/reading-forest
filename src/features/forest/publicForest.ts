import { ensureSession } from '@/features/auth/useAuth';
import { syncNow } from '@/features/library/cloudSync';
import { rowToEntry, type UserBookRow } from '@/features/library/syncMapping';
import { getSupabase } from '@/lib/supabase';
import type { ReadingStatus } from '@/types';

import { treeFromEntry, type ForestTree } from './model';

/**
 * Public forests live in `forests` (owner-writable, readable when `is_public`), trees come from the owner's
 * `user_books` through the `get_public_forest` RPC (no reviews/ratings exposed), and each visitor can insert one
 * `waterings` row per forest per KST day (unique constraint + RLS in `supabase/migrations/0001_init.sql`).
 */
export interface PublicForest {
  forestId: string;
  slug: string;
  nickname: string;
  trees: ForestTree[];
  waterCount: number;
  wateredToday: boolean;
}

interface PublicTreeRow {
  id: string;
  book_id: string;
  title: string | null;
  cover_url: string | null;
  status: ReadingStatus;
  progress_unit: 'page' | 'percent' | null;
  current_page: number | null;
  current_percent: number | null;
  total_pages: number | null;
  tree_species: string | null;
  created_at: string;
}

interface PublicForestRpc {
  forest_id: string;
  slug: string;
  nickname: string | null;
  is_premium: boolean;
  water_count: number;
  watered_today: boolean;
  trees: PublicTreeRow[];
}

/** KST calendar day, matching the `watered_on` default in the database. */
export function kstDay(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function treeFromPublicRow(row: PublicTreeRow, ownerIsPremium: boolean): ForestTree {
  const entry = rowToEntry({
    user_id: '',
    id: row.id,
    book_id: row.book_id,
    isbn13: null,
    book: { id: row.book_id, source: 'manual', title: row.title ?? '', authors: [], coverUrl: row.cover_url ?? undefined },
    status: row.status,
    progress_unit: row.progress_unit,
    current_page: row.current_page,
    current_percent: row.current_percent,
    total_pages: row.total_pages,
    rating: null,
    review: null,
    expectation: null,
    expectation_note: null,
    start_date: null,
    end_date: null,
    tree_species: row.tree_species,
    created_at: row.created_at,
    updated_at: row.created_at,
  } satisfies UserBookRow);
  return treeFromEntry(entry, ownerIsPremium);
}

/** Uploads the library, makes the forest public and returns its share slug. */
export async function publishMyForest(nickname: string): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error('supabase-not-configured');
  const userId = await ensureSession();
  if (!userId) throw new Error('no-session');
  await syncNow(userId);
  const existing = await sb.from('forests').select('share_slug').eq('owner_id', userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const { error } = await sb
      .from('forests')
      .update({ nickname, is_public: true, updated_at: new Date().toISOString() })
      .eq('owner_id', userId);
    if (error) throw error;
    return existing.data.share_slug as string;
  }
  const { data, error } = await sb
    .from('forests')
    .insert({ owner_id: userId, nickname, is_public: true })
    .select('share_slug')
    .single();
  if (error) throw error;
  return data.share_slug as string;
}

export async function fetchPublicForest(slug: string): Promise<PublicForest | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_public_forest', { p_slug: slug });
  if (error) throw error;
  const forest = data as PublicForestRpc | null;
  if (!forest) return null;
  return {
    forestId: forest.forest_id,
    slug: forest.slug,
    nickname: forest.nickname ?? '',
    trees: (forest.trees ?? []).map((row) => treeFromPublicRow(row, forest.is_premium)),
    waterCount: Number(forest.water_count) || 0,
    wateredToday: Boolean(forest.watered_today),
  };
}

export type WaterResult = 'ok' | 'already' | 'failed';

export async function waterForest(forestId: string): Promise<WaterResult> {
  const sb = getSupabase();
  if (!sb) return 'failed';
  try {
    await ensureSession();
    const { error } = await sb.from('waterings').insert({ forest_id: forestId });
    if (!error) return 'ok';
    if (error.code === '23505') return 'already';
    console.warn('[forest] watering failed', error);
    return 'failed';
  } catch (err) {
    console.warn('[forest] watering failed', err);
    return 'failed';
  }
}
