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
