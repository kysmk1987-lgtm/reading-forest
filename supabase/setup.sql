-- 독서의숲 Supabase 전체 설정 (자동 생성: npm run build:sql)
-- 새 프로젝트의 SQL Editor에 통째로 붙여넣고 Run 하세요. 포함된 마이그레이션: 0001_init.sql, 0002_focus_minutes.sql
-- 이미 일부를 적용했다면 아직 적용하지 않은 supabase/migrations/*.sql 파일만 실행하세요.

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
