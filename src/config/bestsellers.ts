/**
 * Fallback for 베스트셀러 추천 when 도서관 정보나루 (DATA4LIBRARY_KEY) is not configured: recent Korean
 * bestsellers / steady sellers by ISBN-13. `/api/books/bestsellers` resolves each one through Kakao
 * (cover, description), so only the ISBN matters; titles are here for humans.
 * Every ISBN below was checked against the live Kakao book API (target=isbn) on 2026-10-07.
 */
export const CURATED_BESTSELLERS: { isbn13: string; title: string }[] = [
  { isbn13: '9788936434120', title: '소년이 온다' },
  { isbn13: '9788954682152', title: '작별하지 않는다' },
  { isbn13: '9788936434595', title: '채식주의자' },
  { isbn13: '9788932043562', title: '빛과 실' },
  { isbn13: '9788936439743', title: '혼모노' },
  { isbn13: '9788998441012', title: '모순' },
  { isbn13: '9791197221989', title: '첫 여름, 완주' },
  { isbn13: '9791141602376', title: '안녕이라 그랬어' },
  { isbn13: '9788937473401', title: '급류' },
  { isbn13: '9791169851053', title: '어른의 행복은 조용하다' },
  { isbn13: '9791192300818', title: '마흔에 읽는 쇼펜하우어' },
  { isbn13: '9791193638859', title: '트렌드 코리아 2026' },
  { isbn13: '9788901297453', title: '나는 메트로폴리탄 미술관의 경비원입니다' },
  { isbn13: '9791130646381', title: '이처럼 사소한 것들' },
  { isbn13: '9791161571188', title: '불편한 편의점' },
  { isbn13: '9791168473690', title: '세이노의 가르침' },
  { isbn13: '9791167740984', title: '도둑맞은 집중력' },
  { isbn13: '9788956608556', title: '구의 증명' },
  { isbn13: '9791189327156', title: '물고기는 존재하지 않는다' },
  { isbn13: '9788936434267', title: '아몬드' },
  { isbn13: '9788954651134', title: '흰' },
  { isbn13: '9791162203620', title: '파과' },
];
