-- 4차: 문구 카드 · 문장 갤러리 · 스마트 블러 (+ 5차 결산용 타이머 소리/독서실 기록)
--
-- 스포일러 방지(스마트 블러)는 서버에서 결정합니다.
--   · quote_cards 테이블은 작성자 본인만 직접 읽을 수 있고, 다른 사람은 gallery_feed() RPC로만 봅니다.
--   · 보는 사람의 서재 진행률이 카드의 진행률보다 낮으면 RPC가 문구(quote)와 원본 이미지 경로를 null로 돌려주고,
--     공개 버킷 `cards-blur`의 흐린 썸네일 경로만 줍니다.
--   · 원본 이미지는 비공개 버킷 `cards`에 있고, 볼 수 있는 사람만 서명 URL을 만들 수 있습니다(storage 정책).
--   · "펼쳐 보기"는 reveal_card() RPC가 기록(card_reveals)을 남긴 뒤 문구·이미지 경로를 돌려줍니다.

-- ─── 결산용: 타이머 세션에 들은 소리 / 독서실 ─────────────────────────────────
alter table public.reading_logs
  add column if not exists sounds text[] not null default '{}' check (cardinality(sounds) <= 12),
  add column if not exists room text check (room is null or char_length(room) <= 40);

-- ─── quote_cards ────────────────────────────────────────────────────────────
create table public.quote_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  isbn13 text check (isbn13 is null or isbn13 ~ '^[0-9]{13}$'),
  book_id text check (book_id is null or char_length(book_id) <= 80),
  book_title text not null check (char_length(book_title) between 1 and 200),
  book_author text check (book_author is null or char_length(book_author) <= 200),
  book_cover text check (book_cover is null or char_length(book_cover) <= 600),
  quote text not null check (char_length(quote) between 1 and 500),
  template text not null default 'paper' check (char_length(template) <= 32),
  font text not null default 'gowun' check (char_length(font) <= 32),
  aspect text not null default 'story' check (aspect in ('story', 'square', 'portrait')),
  image_path text not null check (char_length(image_path) <= 200),
  blur_path text not null check (char_length(blur_path) <= 200),
  progress_percent smallint not null check (progress_percent between 0 and 100),
  progress_page integer check (progress_page is null or progress_page >= 0),
  nickname text check (nickname is null or char_length(nickname) <= 32),
  like_count integer not null default 0,
  scrap_count integer not null default 0,
  comment_count integer not null default 0,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index quote_cards_created_idx on public.quote_cards (created_at desc);
create index quote_cards_isbn_idx on public.quote_cards (isbn13, created_at desc);
create index quote_cards_user_idx on public.quote_cards (user_id, created_at desc);

alter table public.quote_cards enable row level security;

create policy "quote_cards: owner can read" on public.quote_cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "quote_cards: owner can create" on public.quote_cards
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and split_part(image_path, '/', 1) = (select auth.uid())::text
    and split_part(blur_path, '/', 1) = (select auth.uid())::text
  );
create policy "quote_cards: owner can delete" on public.quote_cards
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.quote_cards from anon, authenticated;
grant select, delete on public.quote_cards to authenticated;
grant insert (id, isbn13, book_id, book_title, book_author, book_cover, quote, template, font, aspect,
  image_path, blur_path, progress_percent, progress_page, nickname) on public.quote_cards to authenticated;

-- ─── likes / scraps / comments / reports / reveals ─────────────────────────
create table public.card_likes (
  card_id uuid not null references public.quote_cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create table public.card_scraps (
  card_id uuid not null references public.quote_cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create index card_scraps_user_idx on public.card_scraps (user_id, created_at desc);
create table public.card_comments (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.quote_cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) <= 32),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index card_comments_card_idx on public.card_comments (card_id, created_at);
create table public.card_reports (
  card_id uuid not null references public.quote_cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);
create table public.card_reveals (
  card_id uuid not null references public.quote_cards (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

alter table public.card_likes enable row level security;
alter table public.card_scraps enable row level security;
alter table public.card_comments enable row level security;
alter table public.card_reports enable row level security;
alter table public.card_reveals enable row level security;

-- ─── Visibility helpers (security definer, used by RPCs and policies) ──────
-- Viewer's reading progress (0–100) for a book, or null when the book is not in their library.
create function public.viewer_progress(p_isbn text, p_book_id text)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select max(
    case
      when ub.status = 'read' then 100
      when ub.status = 'want' then 0
      when ub.progress_unit = 'percent' then coalesce(ub.current_percent, 0)
      else coalesce(
        least(100, round(coalesce(ub.current_page, 0) * 100.0 / nullif(coalesce(
          ub.total_pages,
          case when (ub.book ->> 'pageCount') ~ '^[0-9]+$' then (ub.book ->> 'pageCount')::integer end
        ), 0))),
        0)
    end
  )::smallint
  from public.user_books ub
  where ub.user_id = auth.uid()
    and ((p_isbn is not null and ub.isbn13 = p_isbn) or (p_book_id is not null and ub.book_id = p_book_id));
$$;

-- Same rule as src/features/gallery/blur.ts → shouldBlur().
create function public.card_blurred_for_me(c public.quote_cards, p_blur_unowned boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select c.user_id is distinct from auth.uid()
    and not exists (select 1 from public.card_reveals r where r.card_id = c.id and r.user_id = auth.uid())
    and coalesce(public.viewer_progress(c.isbn13, c.book_id) < c.progress_percent, coalesce(p_blur_unowned, false));
$$;

create function public.card_visible_to_me(p_card uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quote_cards c
    where c.id = p_card
      and (not c.hidden or c.user_id = auth.uid())
      and not public.card_blurred_for_me(c, false)
  );
$$;

create function public.card_object_visible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quote_cards c
    where c.image_path = p_name and public.card_visible_to_me(c.id)
  );
$$;

-- ─── Policies for the interaction tables ───────────────────────────────────
create policy "card_likes: own" on public.card_likes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_likes: like visible cards" on public.card_likes
  for insert to authenticated with check ((select auth.uid()) = user_id and public.card_visible_to_me(card_id));
create policy "card_likes: unlike" on public.card_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "card_scraps: own" on public.card_scraps
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_scraps: scrap visible cards" on public.card_scraps
  for insert to authenticated with check ((select auth.uid()) = user_id and public.card_visible_to_me(card_id));
create policy "card_scraps: unscrap" on public.card_scraps
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Comments can quote the passage, so they follow the card's blur state too.
create policy "card_comments: read on visible cards" on public.card_comments
  for select to authenticated using (public.card_visible_to_me(card_id));
create policy "card_comments: comment on visible cards" on public.card_comments
  for insert to authenticated with check ((select auth.uid()) = user_id and public.card_visible_to_me(card_id));
create policy "card_comments: delete own" on public.card_comments
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "card_reports: own" on public.card_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_reports: report" on public.card_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "card_reveals: own" on public.card_reveals
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.card_likes, public.card_scraps, public.card_comments,
  public.card_reports, public.card_reveals from anon, authenticated;
grant select, delete on public.card_likes, public.card_scraps, public.card_comments to authenticated;
grant select on public.card_reports, public.card_reveals to authenticated;
grant insert (card_id) on public.card_likes, public.card_scraps to authenticated;
grant insert (card_id, nickname, body) on public.card_comments to authenticated;
grant insert (card_id, reason) on public.card_reports to authenticated;

-- ─── Counters (triggers keep like/scrap/comment/report counts; 3 reports hide a card) ───
create function public.bump_card_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := case when tg_op = 'INSERT' then 1 else -1 end;
  cid uuid;
begin
  if tg_op = 'INSERT' then cid := new.card_id; else cid := old.card_id; end if;
  if tg_table_name = 'card_likes' then
    update public.quote_cards set like_count = greatest(0, like_count + d) where id = cid;
  elsif tg_table_name = 'card_scraps' then
    update public.quote_cards set scrap_count = greatest(0, scrap_count + d) where id = cid;
  elsif tg_table_name = 'card_comments' then
    update public.quote_cards set comment_count = greatest(0, comment_count + d) where id = cid;
  elsif tg_table_name = 'card_reports' then
    update public.quote_cards
      set report_count = greatest(0, report_count + d), hidden = greatest(0, report_count + d) >= 3
      where id = cid;
  end if;
  return null;
end;
$$;

create trigger card_likes_count after insert or delete on public.card_likes
  for each row execute procedure public.bump_card_counts();
create trigger card_scraps_count after insert or delete on public.card_scraps
  for each row execute procedure public.bump_card_counts();
create trigger card_comments_count after insert or delete on public.card_comments
  for each row execute procedure public.bump_card_counts();
create trigger card_reports_count after insert or delete on public.card_reports
  for each row execute procedure public.bump_card_counts();

-- ─── Gallery RPCs ──────────────────────────────────────────────────────────
-- p_sort: 'latest' | 'popular'; p_scope: 'all' | 'mine' | 'scraps'; p_card: a single card (detail page).
create function public.gallery_feed(
  p_sort text default 'latest',
  p_isbn text default null,
  p_blur_unowned boolean default false,
  p_scope text default 'all',
  p_card uuid default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  isbn13 text,
  book_id text,
  book_title text,
  book_author text,
  book_cover text,
  quote text,
  template text,
  font text,
  aspect text,
  image_path text,
  blur_path text,
  progress_percent smallint,
  progress_page integer,
  nickname text,
  like_count integer,
  scrap_count integer,
  comment_count integer,
  created_at timestamptz,
  blurred boolean,
  viewer_progress smallint,
  liked boolean,
  scrapped boolean,
  mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select c.*,
      public.viewer_progress(c.isbn13, c.book_id) as vp,
      public.card_blurred_for_me(c, p_blur_unowned) as is_blurred
    from public.quote_cards c
    where auth.uid() is not null
      and (not c.hidden or c.user_id = auth.uid())
      and (p_card is null or c.id = p_card)
      and (p_isbn is null or c.isbn13 = p_isbn)
      and (coalesce(p_scope, 'all') <> 'mine' or c.user_id = auth.uid())
      and (coalesce(p_scope, 'all') <> 'scraps'
        or exists (select 1 from public.card_scraps s where s.card_id = c.id and s.user_id = auth.uid()))
      and not exists (select 1 from public.card_reports rp where rp.card_id = c.id and rp.user_id = auth.uid())
  )
  select b.id, b.isbn13, b.book_id, b.book_title, b.book_author, b.book_cover,
    case when b.is_blurred then null else b.quote end,
    b.template, b.font, b.aspect,
    case when b.is_blurred then null else b.image_path end,
    b.blur_path, b.progress_percent, b.progress_page, b.nickname,
    b.like_count, b.scrap_count, b.comment_count, b.created_at,
    b.is_blurred, b.vp,
    exists (select 1 from public.card_likes l where l.card_id = b.id and l.user_id = auth.uid()),
    exists (select 1 from public.card_scraps s where s.card_id = b.id and s.user_id = auth.uid()),
    b.user_id = auth.uid()
  from base b
  order by
    case when p_sort = 'popular' then b.like_count + b.scrap_count * 2 + b.comment_count end desc nulls last,
    b.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- "펼쳐 보기": logs the reveal, then returns the full quote and the private image path.
create function public.reveal_card(p_card uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'sign-in required';
  end if;
  insert into public.card_reveals (card_id, user_id)
    select c.id, auth.uid() from public.quote_cards c where c.id = p_card and not c.hidden
    on conflict do nothing;
  select jsonb_build_object('quote', c.quote, 'image_path', c.image_path) into result
    from public.quote_cards c
    where c.id = p_card and (not c.hidden or c.user_id = auth.uid());
  return result;
end;
$$;

revoke execute on function public.viewer_progress(text, text) from public;
revoke execute on function public.card_blurred_for_me(public.quote_cards, boolean) from public;
revoke execute on function public.card_visible_to_me(uuid) from public;
revoke execute on function public.card_object_visible(text) from public;
revoke execute on function public.gallery_feed(text, text, boolean, text, uuid, integer, integer) from public;
revoke execute on function public.reveal_card(uuid) from public;
revoke execute on function public.bump_card_counts() from public;
grant execute on function public.viewer_progress(text, text) to authenticated;
grant execute on function public.card_blurred_for_me(public.quote_cards, boolean) to authenticated;
grant execute on function public.card_visible_to_me(uuid) to authenticated;
grant execute on function public.card_object_visible(text) to authenticated;
grant execute on function public.gallery_feed(text, text, boolean, text, uuid, integer, integer) to authenticated;
grant execute on function public.reveal_card(uuid) to authenticated;

-- ─── Storage: cards (비공개 원본) / cards-blur (공개 흐린 썸네일) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cards', 'cards', false, 4194304, array['image/png', 'image/jpeg']),
  ('cards-blur', 'cards-blur', true, 524288, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "cards: owner uploads into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('cards', 'cards-blur') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cards: owner deletes own files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('cards', 'cards-blur') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Full-resolution images: only viewers allowed to see the card can create a signed URL.
create policy "cards: visible card images" on storage.objects
  for select to authenticated
  using (bucket_id = 'cards' and public.card_object_visible(name));
