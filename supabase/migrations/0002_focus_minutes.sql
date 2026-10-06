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
