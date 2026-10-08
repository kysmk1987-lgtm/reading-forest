-- 독서의숲 Supabase 전체 설정 (자동 생성: npm run build:sql)
-- 새 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요. 포함된 마이그레이션: 0001_init.sql, 0002_focus_minutes.sql, 0003_gallery.sql, 0004_garden_reviews.sql, 0005_profile_forest_avatar.sql, 0006_garden_unlimited.sql, 0007_room_leaderboard.sql
-- 이미 일부를 적용했다면 아직 적용하지 않은 supabase/setup_<번호>.sql 파일만 실행하세요.

-- ═══════════════ 0001_init.sql ═══════════════
-- 독서의숲 초기 스키마
-- Supabase 대시보드 → SQL Editor에 통째로 붙여넣고 Run 하거나, `npx supabase db push`로 적용합니다.
-- 모든 테이블에 RLS가 켜져 있어 publishable(anon) 키를 앱에 넣어도 안전합니다.

-- ─── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (char_length(nickname) <= 32),
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Rows are created by the trigger below; clients may only change their nickname (never is_premium).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, updated_at) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'user_name'
    ), 32)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── books (shared metadata cache, keyed by ISBN-13) ───────────────────────
create table public.books (
  isbn13 text primary key check (isbn13 ~ '^[0-9]{13}$'),
  title text not null,
  authors text[] not null default '{}',
  translators text[] not null default '{}',
  publisher text,
  published_date text,
  page_count integer check (page_count is null or page_count > 0),
  cover_url text,
  description text,
  category text,
  price integer,
  link text,
  source text,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "books: anyone can read" on public.books
  for select to anon, authenticated using (true);

-- First writer wins: signed-in users may add missing books but not overwrite existing rows.
create policy "books: signed-in users can add" on public.books
  for insert to authenticated with check (true);

revoke update, delete on public.books from anon, authenticated;
grant select on public.books to anon, authenticated;
grant insert on public.books to authenticated;

-- ─── user_books (one row per book in a user's library) ─────────────────────
create table public.user_books (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,                       -- client-generated entry id (stable across devices)
  book_id text not null,                  -- app book id, e.g. kr_9788936434120
  isbn13 text references public.books (isbn13),
  book jsonb not null,                    -- full Book snapshot (works for books without ISBN too)
  status text not null check (status in ('read', 'reading', 'want', 'stopped')),
  progress_unit text check (progress_unit in ('page', 'percent')),
  current_page integer check (current_page is null or current_page >= 0),
  current_percent numeric(5, 2) check (current_percent is null or current_percent between 0 and 100),
  total_pages integer check (total_pages is null or total_pages > 0),
  rating numeric(2, 1) check (rating is null or rating between 0 and 5),
  review text check (review is null or char_length(review) <= 500),
  expectation smallint check (expectation is null or expectation between 0 and 5),
  expectation_note text check (expectation_note is null or char_length(expectation_note) <= 500),
  start_date date,
  end_date date,
  tree_species text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index user_books_user_updated_idx on public.user_books (user_id, updated_at desc);

alter table public.user_books enable row level security;

create policy "user_books: owner can read" on public.user_books
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_books: owner can insert" on public.user_books
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_books: owner can update" on public.user_books
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_books: owner can delete" on public.user_books
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_books to authenticated;

-- ─── reading_logs (calendar / statistics / 독서 결산) ───────────────────────
create table public.reading_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  user_book_id text not null,
  book_id text not null,
  date date not null,
  kind text not null check (kind in ('add', 'progress', 'complete')),
  pages_delta integer not null default 0 check (pages_delta >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, user_book_id) references public.user_books (user_id, id) on delete cascade
);

create index reading_logs_user_date_idx on public.reading_logs (user_id, date);

alter table public.reading_logs enable row level security;

create policy "reading_logs: owner can read" on public.reading_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reading_logs: owner can insert" on public.reading_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reading_logs: owner can delete" on public.reading_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.reading_logs to authenticated;

-- ─── forests (public share page) ───────────────────────────────────────────
create table public.forests (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  share_slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    check (share_slug ~ '^[a-z0-9-]{6,32}$'),
  nickname text check (char_length(nickname) <= 32),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forests enable row level security;

create policy "forests: public or own can be read" on public.forests
  for select to anon, authenticated using (is_public or (select auth.uid()) = owner_id);
create policy "forests: owner can create" on public.forests
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "forests: owner can update" on public.forests
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

grant select on public.forests to anon, authenticated;
grant insert (owner_id, nickname, is_public) on public.forests to authenticated;
grant update (nickname, is_public, updated_at) on public.forests to authenticated;

-- ─── waterings (물 주기: 숲 하나에 방문자당 하루 한 번) ──────────────────────
create table public.waterings (
  id bigint generated always as identity primary key,
  forest_id uuid not null references public.forests (owner_id) on delete cascade,
  visitor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  watered_on date not null default (now() at time zone 'Asia/Seoul')::date,
  created_at timestamptz not null default now(),
  unique (forest_id, visitor_id, watered_on)
);

alter table public.waterings enable row level security;

-- Any signed-in user (including anonymous sign-ins) can water a public forest once per (KST) day.
create policy "waterings: visitors can water public forests today" on public.waterings
  for insert to authenticated
  with check (
    visitor_id = (select auth.uid())
    and watered_on = (now() at time zone 'Asia/Seoul')::date
    and exists (select 1 from public.forests f where f.owner_id = forest_id and f.is_public)
  );

create policy "waterings: visitor or forest owner can read" on public.waterings
  for select to authenticated using (visitor_id = (select auth.uid()) or forest_id = (select auth.uid()));

revoke update, delete on public.waterings from anon, authenticated;
grant select on public.waterings to authenticated;
grant insert (forest_id) on public.waterings to authenticated;

-- ─── Public forest RPC ─────────────────────────────────────────────────────
-- Returns only what the public page needs (no reviews/ratings), plus the total water count.
create function public.get_public_forest(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'forest_id', f.owner_id,
    'slug', f.share_slug,
    'nickname', coalesce(f.nickname, p.nickname),
    'is_premium', coalesce(p.is_premium, false),
    'water_count', (select count(*) from public.waterings w where w.forest_id = f.owner_id),
    'watered_today', exists (
      select 1 from public.waterings w
      where w.forest_id = f.owner_id
        and w.visitor_id = auth.uid()
        and w.watered_on = (now() at time zone 'Asia/Seoul')::date
    ),
    'trees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ub.id,
        'book_id', ub.book_id,
        'title', ub.book ->> 'title',
        'cover_url', ub.book ->> 'coverUrl',
        'status', ub.status,
        'progress_unit', ub.progress_unit,
        'current_page', ub.current_page,
        'current_percent', ub.current_percent,
        'total_pages', ub.total_pages,
        'tree_species', ub.tree_species,
        'created_at', ub.created_at
      ) order by ub.created_at)
      from public.user_books ub
      where ub.user_id = f.owner_id
    ), '[]'::jsonb)
  )
  from public.forests f
  left join public.profiles p on p.id = f.owner_id
  where f.share_slug = p_slug
    and (f.is_public or f.owner_id = auth.uid());
$$;

revoke execute on function public.get_public_forest(text) from public;
grant execute on function public.get_public_forest(text) to anon, authenticated;

-- ─── Monthly stats (for 통계 / 독서 결산) ───────────────────────────────────
create view public.monthly_reading_stats
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', date)::date as month,
  count(distinct date) as reading_days,
  coalesce(sum(pages_delta), 0)::integer as pages,
  count(*) filter (where kind = 'complete') as books_completed
from public.reading_logs
group by user_id, date_trunc('month', date);

grant select on public.monthly_reading_stats to authenticated;

-- ═══════════════ 0002_focus_minutes.sql ═══════════════
-- 3차: 뽀모도로 집중 시간을 독서 로그에 기록합니다.
alter table public.reading_logs
  add column minutes integer not null default 0 check (minutes between 0 and 600);

alter table public.reading_logs drop constraint if exists reading_logs_kind_check;
alter table public.reading_logs
  add constraint reading_logs_kind_check check (kind in ('add', 'progress', 'complete', 'focus'));

create or replace view public.monthly_reading_stats
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', date)::date as month,
  count(distinct date) as reading_days,
  coalesce(sum(pages_delta), 0)::integer as pages,
  count(*) filter (where kind = 'complete') as books_completed,
  coalesce(sum(minutes), 0)::integer as focus_minutes
from public.reading_logs
group by user_id, date_trunc('month', date);

grant select on public.monthly_reading_stats to authenticated;

-- 실시간 접속자(지도/독서실)와 조용한 응원은 Supabase Realtime(Presence/Broadcast)의 공개 채널
-- `reading-now`를 사용하므로 테이블이 필요 없습니다. 지역은 시·도 단위 코드만 주고받습니다.

-- ═══════════════ 0003_gallery.sql ═══════════════
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

-- ═══════════════ 0004_garden_reviews.sql ═══════════════
-- 6차: 나무 옮겨 심기(정원 좌표) · 책 리뷰(별점·한줄평 공개, 신고, 집계)
--
--   · user_books.garden_x / garden_y: 독서 숲에서 나무를 심은 칸 (null = 자동 배치). 공개 숲 RPC도 좌표를 돌려줍니다.
--   · book_reviews: ISBN별 리뷰 (한 사람당 책 한 권에 하나). 작성자 본인만 테이블을 직접 읽고,
--     다른 사람은 book_reviews_feed() / book_review_summary() RPC로만 봅니다 (user_id는 노출하지 않음).
--   · 신고 3회가 쌓이면 리뷰가 숨겨집니다 (작성자 본인에게는 계속 보임).

-- ─── 정원 좌표 ──────────────────────────────────────────────────────────────
alter table public.user_books
  add column if not exists garden_x smallint check (garden_x is null or garden_x between 0 and 11),
  add column if not exists garden_y smallint check (garden_y is null or garden_y between 0 and 11);

create or replace function public.get_public_forest(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'forest_id', f.owner_id,
    'slug', f.share_slug,
    'nickname', coalesce(f.nickname, p.nickname),
    'is_premium', coalesce(p.is_premium, false),
    'water_count', (select count(*) from public.waterings w where w.forest_id = f.owner_id),
    'watered_today', exists (
      select 1 from public.waterings w
      where w.forest_id = f.owner_id
        and w.visitor_id = auth.uid()
        and w.watered_on = (now() at time zone 'Asia/Seoul')::date
    ),
    'trees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ub.id,
        'book_id', ub.book_id,
        'title', ub.book ->> 'title',
        'cover_url', ub.book ->> 'coverUrl',
        'status', ub.status,
        'progress_unit', ub.progress_unit,
        'current_page', ub.current_page,
        'current_percent', ub.current_percent,
        'total_pages', ub.total_pages,
        'tree_species', ub.tree_species,
        'garden_x', ub.garden_x,
        'garden_y', ub.garden_y,
        'created_at', ub.created_at
      ) order by ub.created_at)
      from public.user_books ub
      where ub.user_id = f.owner_id
    ), '[]'::jsonb)
  )
  from public.forests f
  left join public.profiles p on p.id = f.owner_id
  where f.share_slug = p_slug
    and (f.is_public or f.owner_id = auth.uid());
$$;

revoke execute on function public.get_public_forest(text) from public;
grant execute on function public.get_public_forest(text) to anon, authenticated;

-- ─── book_reviews ───────────────────────────────────────────────────────────
create table public.book_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  isbn13 text not null check (isbn13 ~ '^[0-9]{13}$'),
  rating numeric(2, 1) not null check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  body text check (body is null or char_length(body) <= 500),
  nickname text check (nickname is null or char_length(nickname) <= 32),
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, isbn13)
);

create index book_reviews_isbn_idx on public.book_reviews (isbn13, updated_at desc);

alter table public.book_reviews enable row level security;

create policy "book_reviews: owner can read" on public.book_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "book_reviews: owner can delete" on public.book_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Writes go through upsert_book_review() so the counters/hidden flag can't be set by clients.
revoke insert, update, delete on public.book_reviews from anon, authenticated;
grant select, delete on public.book_reviews to authenticated;

create table public.book_review_reports (
  review_id bigint not null references public.book_reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.book_review_reports enable row level security;

create policy "book_review_reports: own" on public.book_review_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "book_review_reports: report others" on public.book_review_reports
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and not exists (select 1 from public.book_reviews r where r.id = review_id and r.user_id = (select auth.uid()))
  );

revoke insert, update, delete on public.book_review_reports from anon, authenticated;
grant select on public.book_review_reports to authenticated;
grant insert (review_id, reason) on public.book_review_reports to authenticated;

create function public.bump_review_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.book_reviews
    set report_count = report_count + 1, hidden = report_count + 1 >= 3
    where id = new.review_id;
  return null;
end;
$$;

create trigger book_review_reports_count after insert on public.book_review_reports
  for each row execute procedure public.bump_review_reports();

-- ─── RPCs ───────────────────────────────────────────────────────────────────
-- Create or update my review of a book (one per user and ISBN).
create function public.upsert_book_review(p_isbn text, p_rating numeric, p_body text, p_nickname text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  rid bigint;
begin
  if auth.uid() is null then
    raise exception 'sign-in required';
  end if;
  insert into public.book_reviews (user_id, isbn13, rating, body, nickname)
    values (auth.uid(), p_isbn, p_rating, nullif(btrim(p_body), ''), nullif(btrim(p_nickname), ''))
  on conflict (user_id, isbn13) do update
    set rating = excluded.rating, body = excluded.body, nickname = excluded.nickname, updated_at = now()
  returning id into rid;
  return rid;
end;
$$;

-- Average / count / distribution (1–5 stars; half stars round up) of the visible reviews of a book.
create function public.book_review_summary(p_isbn text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(r.rating), 2), 0),
    'dist', jsonb_build_array(
      count(*) filter (where ceil(r.rating) = 1),
      count(*) filter (where ceil(r.rating) = 2),
      count(*) filter (where ceil(r.rating) = 3),
      count(*) filter (where ceil(r.rating) = 4),
      count(*) filter (where ceil(r.rating) = 5)
    )
  )
  from public.book_reviews r
  where r.isbn13 = p_isbn and not r.hidden;
$$;

-- Review list for a book: mine first, then newest. Hidden reviews and ones I reported are left out.
create function public.book_reviews_feed(p_isbn text, p_limit integer default 20, p_offset integer default 0)
returns table (
  id bigint,
  rating numeric,
  body text,
  nickname text,
  created_at timestamptz,
  updated_at timestamptz,
  mine boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.body, r.nickname, r.created_at, r.updated_at, r.user_id = auth.uid()
  from public.book_reviews r
  where r.isbn13 = p_isbn
    and (not r.hidden or r.user_id = auth.uid())
    and not exists (select 1 from public.book_review_reports rp where rp.review_id = r.id and rp.user_id = auth.uid())
  order by (r.user_id = auth.uid()) desc nulls last, r.updated_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.bump_review_reports() from public;
revoke execute on function public.upsert_book_review(text, numeric, text, text) from public;
revoke execute on function public.book_review_summary(text) from public;
revoke execute on function public.book_reviews_feed(text, integer, integer) from public;
grant execute on function public.upsert_book_review(text, numeric, text, text) to authenticated;
grant execute on function public.book_review_summary(text) to anon, authenticated;
grant execute on function public.book_reviews_feed(text, integer, integer) to anon, authenticated;

-- ═══════════════ 0005_profile_forest_avatar.sql ═══════════════
-- 7차: 프로필 꾸미기 — 숲 이름 · 아바타
--
--   · profiles.forest_name: 홈 숲 카드 제목 (null = 기본 '나만의 독서 숲')
--   · profiles.avatar: 프로필 캐릭터 id (null = 기본 새싹). 프리미엄 캐릭터 여부는 앱에서 판단합니다.
--   · 클라이언트는 닉네임처럼 두 칸만 직접 고칠 수 있습니다 (is_premium은 계속 막힘).

alter table public.profiles
  add column if not exists forest_name text check (forest_name is null or char_length(forest_name) <= 32),
  add column if not exists avatar text check (avatar is null or avatar ~ '^[a-z][a-z0-9_-]{0,31}$');

grant update (forest_name, avatar) on public.profiles to authenticated;

-- ═══════════════ 0006_garden_unlimited.sql ═══════════════
-- 8차: 땅 넓히기 무제한
--
--   · 0004에서 user_books.garden_x / garden_y를 0~11로 막았던 check를 0~999로 넓힙니다 (앱의 GARDEN_MAX = 1000).
--   · 적용 전에는 앱이 12칸을 넘는 위치만 빼고 동기화합니다(그 나무 위치는 이 기기에만 저장).

alter table public.user_books
  drop constraint if exists user_books_garden_x_check,
  drop constraint if exists user_books_garden_y_check;

alter table public.user_books
  add constraint user_books_garden_x_check check (garden_x is null or garden_x between 0 and 999),
  add constraint user_books_garden_y_check check (garden_y is null or garden_y between 0 and 999);

-- ═══════════════ 0007_room_leaderboard.sql ═══════════════
-- 독서실 순위표: 테마 독서실에서 오늘 집중한 시간(분)을 방별로 모읍니다.
-- 실시간 접속자(Presence)는 방에 지금 있는 사람만 보이므로, 나간 사람도 오늘 순위에 남도록 하루 합계를 저장합니다.
-- 다른 사람에게는 닉네임 · 분 · 하루마다 바뀌는 익명 토큰만 보이고 계정 id는 노출하지 않습니다.
-- 하루 기준은 한국 시간(Asia/Seoul) 자정입니다.

create table public.room_daily_minutes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room text not null check (char_length(room) between 1 and 40),
  day date not null,
  minutes integer not null default 0 check (minutes between 0 and 1440),
  nickname text check (nickname is null or char_length(nickname) <= 32),
  updated_at timestamptz not null default now(),
  primary key (user_id, room, day)
);

create index room_daily_minutes_board_idx on public.room_daily_minutes (room, day, minutes desc);

alter table public.room_daily_minutes enable row level security;

create policy "room_daily_minutes: owner can read" on public.room_daily_minutes
  for select to authenticated using ((select auth.uid()) = user_id);

-- 쓰기는 add_room_minutes()로만 (분을 임의로 덮어쓰지 못하게).
revoke insert, update, delete on public.room_daily_minutes from anon, authenticated;
grant select on public.room_daily_minutes to authenticated;

-- 하루 단위 익명 토큰: 실시간 접속자(Presence)와 순위표 줄을 짝짓는 데만 씁니다.
create function public.room_player_token(p_user uuid, p_day date)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(md5(p_user::text || ':' || p_day::text || ':reading-room'), 12);
$$;

revoke execute on function public.room_player_token(uuid, date) from public;

-- 집중 한 번이 끝날 때 호출: 오늘 이 방의 내 분에 더합니다. 내 토큰을 돌려줍니다.
-- 부풀리기 방지: 한 번에 최대 180분, 그리고 마지막 기록 이후 흐른 시간(+1분)보다 많이 더할 수 없습니다.
create function public.add_room_minutes(p_room text, p_minutes integer, p_nickname text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_last timestamptz;
  v_add integer := least(greatest(coalesce(p_minutes, 0), 0), 180);
begin
  if auth.uid() is null then
    raise exception 'sign-in required';
  end if;
  if p_room is null or char_length(p_room) not between 1 and 40 then
    raise exception 'invalid room';
  end if;
  select updated_at into v_last
    from public.room_daily_minutes
    where user_id = auth.uid() and room = p_room and day = v_day;
  if v_last is not null then
    v_add := least(v_add, ceil(extract(epoch from (now() - v_last)) / 60)::integer + 1);
  end if;
  if v_add > 0 then
    insert into public.room_daily_minutes (user_id, room, day, minutes, nickname)
      values (auth.uid(), p_room, v_day, v_add, nullif(left(btrim(coalesce(p_nickname, '')), 32), ''))
    on conflict (user_id, room, day) do update
      set minutes = least(1440, public.room_daily_minutes.minutes + excluded.minutes),
          nickname = coalesce(excluded.nickname, public.room_daily_minutes.nickname),
          updated_at = now();
  end if;
  return public.room_player_token(auth.uid(), v_day);
end;
$$;

revoke execute on function public.add_room_minutes(text, integer, text) from public;
grant execute on function public.add_room_minutes(text, integer, text) to authenticated;

-- 오늘 이 방의 순위 (분이 많은 순, 최대 p_limit명 + 내 줄은 순위 밖이어도 포함).
create function public.room_leaderboard(p_room text, p_limit integer default 30)
returns table (player text, nickname text, minutes integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'Asia/Seoul')::date as d),
  board as (
    select r.user_id, r.nickname, r.minutes, r.updated_at
    from public.room_daily_minutes r, today
    where r.room = p_room and r.day = today.d and r.minutes > 0
  ),
  top as (
    select * from board order by minutes desc, updated_at asc limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ),
  picked as (
    select * from top
    union
    select * from board where user_id = auth.uid()
  )
  select public.room_player_token(p.user_id, (select d from today)), p.nickname, p.minutes, p.user_id = auth.uid()
  from picked p
  order by p.minutes desc, p.updated_at asc;
$$;

revoke execute on function public.room_leaderboard(text, integer) from public;
grant execute on function public.room_leaderboard(text, integer) to authenticated;

-- 독서실 목록용 요약: 방마다 오늘 읽은 사람 수와 1등.
create function public.room_today_summary()
returns table (room text, readers integer, top_nickname text, top_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (select (now() at time zone 'Asia/Seoul')::date as d),
  board as (
    select r.room, r.nickname, r.minutes, r.updated_at,
      row_number() over (partition by r.room order by r.minutes desc, r.updated_at asc) as rn,
      count(*) over (partition by r.room) as readers
    from public.room_daily_minutes r, today
    where r.day = today.d and r.minutes > 0
  )
  select b.room, b.readers::integer, b.nickname, b.minutes from board b where b.rn = 1;
$$;

revoke execute on function public.room_today_summary() from public;
grant execute on function public.room_today_summary() to authenticated;
