import { ensureSession } from '@/features/auth/useAuth';
import { awaitInitialSync } from '@/features/library/cloudSync';
import { getSupabase } from '@/lib/supabase';

import { imageBytes, type CapturedImage } from './capture';

/** One row of `gallery_feed()` — `quote`/`image_path` are null while the card is blurred for this viewer. */
export interface GalleryCard {
  id: string;
  isbn13: string | null;
  book_id: string | null;
  book_title: string;
  book_author: string | null;
  book_cover: string | null;
  quote: string | null;
  template: string;
  font: string;
  aspect: string;
  image_path: string | null;
  blur_path: string;
  progress_percent: number;
  progress_page: number | null;
  nickname: string | null;
  like_count: number;
  scrap_count: number;
  comment_count: number;
  created_at: string;
  blurred: boolean;
  viewer_progress: number | null;
  liked: boolean;
  scrapped: boolean;
  mine: boolean;
}

export interface CardComment {
  id: number;
  card_id: string;
  user_id: string;
  nickname: string | null;
  body: string;
  created_at: string;
}

export type FeedSort = 'latest' | 'popular';
export type FeedScope = 'all' | 'mine' | 'scraps';

export class GalleryOfflineError extends Error {
  constructor() {
    super('gallery needs Supabase');
  }
}

/** Signed-in client (anonymous sign-in if needed) whose library has been synced, so server-side blur sees real progress. */
async function client() {
  const sb = getSupabase();
  if (!sb) throw new GalleryOfflineError();
  const uid = await ensureSession();
  if (!uid) throw new GalleryOfflineError();
  await awaitInitialSync();
  return { sb, uid };
}

export async function fetchFeed(params: { sort: FeedSort; scope: FeedScope; isbn?: string | null; blurUnowned: boolean; offset?: number }) {
  const { sb } = await client();
  const { data, error } = await sb.rpc('gallery_feed', {
    p_sort: params.sort,
    p_scope: params.scope,
    p_isbn: params.isbn ?? null,
    p_blur_unowned: params.blurUnowned,
    p_limit: 30,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as GalleryCard[];
}

export async function fetchCard(id: string, blurUnowned: boolean): Promise<GalleryCard | null> {
  const { sb } = await client();
  const { data, error } = await sb.rpc('gallery_feed', { p_card: id, p_blur_unowned: blurUnowned, p_limit: 1 });
  if (error) throw error;
  return ((data ?? []) as GalleryCard[])[0] ?? null;
}

/** Logs the reveal server-side and returns the full quote + private image path. */
export async function revealCard(id: string): Promise<{ quote: string; image_path: string } | null> {
  const { sb } = await client();
  const { data, error } = await sb.rpc('reveal_card', { p_card: id });
  if (error) throw error;
  return (data as { quote: string; image_path: string } | null) ?? null;
}

/** Full image: a short-lived signed URL (storage policy only allows viewers who may see the card). */
export async function signedImageUrl(path: string): Promise<string> {
  const { sb } = await client();
  const { data, error } = await sb.storage.from('cards').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function blurImageUrl(path: string): string | null {
  const sb = getSupabase();
  return sb ? sb.storage.from('cards-blur').getPublicUrl(path).data.publicUrl : null;
}

export async function setLiked(cardId: string, on: boolean) {
  const { sb, uid } = await client();
  const { error } = on
    ? await sb.from('card_likes').insert({ card_id: cardId })
    : await sb.from('card_likes').delete().eq('card_id', cardId).eq('user_id', uid);
  if (error && error.code !== '23505') throw error;
}

export async function setScrapped(cardId: string, on: boolean) {
  const { sb, uid } = await client();
  const { error } = on
    ? await sb.from('card_scraps').insert({ card_id: cardId })
    : await sb.from('card_scraps').delete().eq('card_id', cardId).eq('user_id', uid);
  if (error && error.code !== '23505') throw error;
}

export async function fetchComments(cardId: string): Promise<CardComment[]> {
  const { sb } = await client();
  const { data, error } = await sb.from('card_comments').select('*').eq('card_id', cardId).order('created_at', { ascending: true }).limit(200);
  if (error) throw error;
  return (data ?? []) as CardComment[];
}

export async function addComment(cardId: string, nickname: string, body: string) {
  const { sb } = await client();
  const { error } = await sb.from('card_comments').insert({ card_id: cardId, nickname: nickname.slice(0, 32), body: body.trim().slice(0, 300) });
  if (error) throw error;
}

export async function deleteComment(id: number) {
  const { sb } = await client();
  const { error } = await sb.from('card_comments').delete().eq('id', id);
  if (error) throw error;
}

export async function reportCard(cardId: string, reason: string) {
  const { sb } = await client();
  const { error } = await sb.from('card_reports').insert({ card_id: cardId, reason: reason.slice(0, 200) });
  if (error && error.code !== '23505') throw error;
}

export async function deleteCard(card: Pick<GalleryCard, 'id' | 'image_path' | 'blur_path'>) {
  const { sb } = await client();
  const { error } = await sb.from('quote_cards').delete().eq('id', card.id);
  if (error) throw error;
  if (card.image_path) await sb.storage.from('cards').remove([card.image_path]);
  await sb.storage.from('cards-blur').remove([card.blur_path]);
}

function uuid4() {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export interface UploadCardInput {
  image: CapturedImage;
  blur: CapturedImage;
  isbn13?: string;
  bookId?: string;
  bookTitle: string;
  bookAuthor?: string;
  bookCover?: string;
  quote: string;
  template: string;
  font: string;
  aspect: string;
  progressPercent: number;
  progressPage: number | null;
  nickname: string;
}

/** Uploads the full card (private bucket) + blurred thumbnail (public bucket), then inserts the row. */
export async function uploadCard(input: UploadCardInput): Promise<string> {
  const { sb, uid } = await client();
  const id = uuid4();
  const imagePath = `${uid}/${id}.png`;
  const blurPath = `${uid}/${id}.jpg`;
  const full = await imageBytes(input.image);
  const thumb = await imageBytes(input.blur);
  const up1 = await sb.storage.from('cards').upload(imagePath, full.bytes, { contentType: full.contentType, upsert: false });
  if (up1.error) throw up1.error;
  const up2 = await sb.storage.from('cards-blur').upload(blurPath, thumb.bytes, { contentType: thumb.contentType, upsert: false });
  if (up2.error) {
    await sb.storage.from('cards').remove([imagePath]);
    throw up2.error;
  }
  const { error } = await sb.from('quote_cards').insert({
    id,
    isbn13: input.isbn13 && /^\d{13}$/.test(input.isbn13) ? input.isbn13 : null,
    book_id: input.bookId ?? null,
    book_title: input.bookTitle.slice(0, 200),
    book_author: input.bookAuthor?.slice(0, 200) ?? null,
    book_cover: input.bookCover?.slice(0, 600) ?? null,
    quote: input.quote.trim().slice(0, 500),
    template: input.template,
    font: input.font,
    aspect: input.aspect,
    image_path: imagePath,
    blur_path: blurPath,
    progress_percent: Math.max(0, Math.min(100, Math.round(input.progressPercent))),
    progress_page: input.progressPage,
    nickname: input.nickname.slice(0, 32),
  });
  if (error) {
    await sb.storage.from('cards').remove([imagePath]);
    await sb.storage.from('cards-blur').remove([blurPath]);
    throw error;
  }
  return id;
}

/** Postgres/PostgREST error code for "relation does not exist" etc. → migration 0003 not applied yet. */
export function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string })?.code;
  return code === 'PGRST202' || code === 'PGRST205' || code === '42P01' || code === '42883';
}
