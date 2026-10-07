-- 7차: 프로필 꾸미기 — 숲 이름 · 아바타
--
--   · profiles.forest_name: 홈 숲 카드 제목 (null = 기본 '나만의 독서 숲')
--   · profiles.avatar: 프로필 캐릭터 id (null = 기본 새싹). 프리미엄 캐릭터 여부는 앱에서 판단합니다.
--   · 클라이언트는 닉네임처럼 두 칸만 직접 고칠 수 있습니다 (is_premium은 계속 막힘).

alter table public.profiles
  add column if not exists forest_name text check (forest_name is null or char_length(forest_name) <= 32),
  add column if not exists avatar text check (avatar is null or avatar ~ '^[a-z][a-z0-9_-]{0,31}$');

grant update (forest_name, avatar) on public.profiles to authenticated;
