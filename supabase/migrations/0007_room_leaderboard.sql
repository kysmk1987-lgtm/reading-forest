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
