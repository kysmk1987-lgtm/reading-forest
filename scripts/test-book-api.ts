// Offline test of the /api/books functions with mocked provider responses.
// Run: npx tsx scripts/test-book-api.ts
import assert from 'node:assert/strict';

import { GET as lookup } from '../api/books/[isbn]';
import { GET as search } from '../api/books/search';
import { splitIsbns } from '../api/_lib/isbn';
import { kakaoCover, parseAladinAuthors } from '../api/_lib/providers';

const ISBN13 = '9791187444725';

const kakaoDoc = {
  title: '부의 추월차선(10주년 스페셜 에디션)',
  contents: '부자 되기 방식의 패러다임을 바꾼 부의 추월차선이 한국 출간 10주년을 맞이했다...',
  url: 'https://search.daum.net/search?w=bookpage&bookId=1',
  isbn: `118744472X ${ISBN13}`,
  datetime: '2022-12-12T00:00:00.000+09:00',
  authors: ['엠제이 드마코'],
  publisher: '토트',
  translators: ['신소영'],
  price: 19800,
  thumbnail: 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x',
};

const aladinItem = {
  title: '부의 추월차선 - 10주년 스페셜 에디션',
  link: 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1&amp;partner=openAPI',
  author: '엠제이 드마코 (지은이), 신소영 (옮긴이)',
  pubDate: '2022-12-12',
  description: '부자 되기 방식의 패러다임을 바꾼 &lt;부의 추월차선&gt;이 독자들의 사랑과 지지 속에 한국 출간 10주년을 맞이했다. 이 책은 죽도록 일하며 수십 년 간 아끼고 모아서 휠체어에 탈 때쯤 부자 되는 40년짜리 플랜을 비웃으며...',
  isbn: 'K352836574',
  isbn13: ISBN13,
  priceStandard: 19800,
  cover: 'https://image.aladin.co.kr/product/30/1/cover500/x.jpg',
  categoryName: '국내도서>경제경영>재테크/투자>재테크/투자 일반',
  publisher: '토트',
  subInfo: { itemPage: 392 },
};

const naverItem = {
  title: '<b>부의 추월차선</b>',
  link: 'https://search.shopping.naver.com/book/catalog/1',
  image: 'https://shopping-phinf.pstatic.net/x.jpg',
  author: '엠제이 드마코^신소영',
  discount: '17820',
  publisher: '토트',
  pubdate: '20221212',
  isbn: ISBN13,
  description: '짧은 설명',
};

function mockFetch(handler: (url: string) => unknown) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const body = handler(url);
    return new Response(JSON.stringify(body), { status: body === 429 ? 429 : 200 });
  }) as typeof fetch;
}

const req = (path: string) => new Request(`https://example.test${path}`);

async function main() {
  // Helpers
  assert.deepEqual(splitIsbns(`118744472X ${ISBN13}`), { isbn10: '118744472X', isbn13: ISBN13 });
  assert.deepEqual(splitIsbns(` ${ISBN13}`), { isbn13: ISBN13 });
  assert.deepEqual(parseAladinAuthors('홍길동, 김철수 (지은이), 이영희 (옮긴이)'), {
    authors: ['홍길동', '김철수'],
    translators: ['이영희'],
  });
  assert.equal(
    kakaoCover(
      'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F5956574%3Ftimestamp%3D20260918121258',
    ),
    'https://t1.daumcdn.net/lbook/image/5956574?timestamp=20260918121258',
  );
  assert.equal(kakaoCover(kakaoDoc.thumbnail), kakaoDoc.thumbnail, 'unknown fname keeps the thumbnail');

  // No keys → Korean NO_KEYS error, no upstream calls.
  delete process.env.KAKAO_REST_API_KEY;
  delete process.env.ALADIN_TTB_KEY;
  delete process.env.NAVER_CLIENT_ID;
  delete process.env.NAVER_CLIENT_SECRET;
  mockFetch(() => assert.fail('should not call upstream without keys'));
  let res = await search(req('/api/books/search?q=부의%20추월차선'));
  assert.equal(res.status, 503);
  const noKeys = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(noKeys.error.code, 'NO_KEYS');
  console.log('✓ no keys →', noKeys.error.message);

  // Keys set (fake) + mocked upstreams.
  process.env.KAKAO_REST_API_KEY = 'test';
  process.env.ALADIN_TTB_KEY = 'test';
  process.env.NAVER_CLIENT_ID = 'id';
  process.env.NAVER_CLIENT_SECRET = 'secret';
  mockFetch((url) => {
    if (url.includes('dapi.kakao.com')) return { documents: [kakaoDoc, { ...kakaoDoc, isbn: '' }] };
    if (url.includes('ItemLookUp')) return { item: [aladinItem] };
    if (url.includes('ItemSearch')) return { item: [aladinItem] };
    if (url.includes('openapi.naver.com')) return { items: [naverItem] };
    throw new Error(`unexpected ${url}`);
  });

  res = await search(req('/api/books/search?q=부의%20추월차선'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=600/);
  const found = (await res.json()) as { books: { id: string; translators: string[] }[]; source: string };
  assert.equal(found.source, 'kakao');
  assert.equal(found.books.length, 1, 'books without ISBN are dropped');
  assert.equal(found.books[0].id, `kr_${ISBN13}`);
  assert.deepEqual(found.books[0].translators, ['신소영']);
  console.log('✓ search (kakao):', found.books[0]);

  res = await lookup(req(`/api/books/${ISBN13}`));
  assert.equal(res.status, 200);
  const { book } = (await res.json()) as { book: Record<string, unknown> };
  assert.equal(book.pageCount, 392);
  assert.equal(book.isbn10, '118744472X', 'Aladin K-codes must not override real ISBN-10');
  assert.equal(book.coverUrl, aladinItem.cover);
  assert.equal(book.category, '경제경영 > 재테크/투자');
  assert.deepEqual(book.translators, ['신소영']);
  assert.match(String(book.description), /<부의 추월차선>/);
  assert.equal(book.link, 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=1&partner=openAPI');
  console.log('✓ detail (merged):', book);

  // Kakao rate-limited → falls back to Aladin.
  mockFetch((url) => (url.includes('dapi.kakao.com') ? 429 : url.includes('ItemSearch') ? { item: [aladinItem] } : { items: [] }));
  res = await search(req('/api/books/search?q=추월차선'));
  const fallback = (await res.json()) as { source: string; books: unknown[] };
  assert.equal(fallback.source, 'aladin');
  console.log('✓ kakao 429 → aladin fallback');

  // Bad ISBN
  res = await lookup(req('/api/books/12345'));
  assert.equal(res.status, 400);
  console.log('✓ invalid ISBN → 400');

  console.log('\nAll book API tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
