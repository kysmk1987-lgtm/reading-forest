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
