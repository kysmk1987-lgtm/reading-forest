/**
 * Offline tests for the scraped sources: Daum bookpage page counts and the 교보문고 bestseller JSON,
 * against fixtures saved from the live pages on 2026-10-07 (scripts/fixtures).
 * Run: npm run test:scrapers
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { daumBookFacts, daumPagesEnabled, isDaumBookPageUrl, parseDaumBookPage, parseDaumIntro } from '../api/_lib/daum';
import { kyoboBestsellers, kyoboEnabled, parseKyoboBestsellers } from '../api/_lib/kyobo';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log('daum bookpage');
  await test('작별하지 않는다: 페이지수 332, 사이즈, 출간일', () => {
    const facts = parseDaumBookPage(fixture('daum-bookpage-9788954682152.html'));
    assert.deepEqual(facts, { pageCount: 332, size: '130*193mm', publishedDate: '2021-09-09' });
  });
  await test('흰: no 페이지수 row → no page count (falls back to library APIs / 직접 입력)', () => {
    const facts = parseDaumBookPage(fixture('daum-bookpage-9788954651134.html'));
    assert.equal(facts.pageCount, undefined);
    assert.equal(facts.publishedDate, '2018-04-25');
  });
  await test('label variants and odd markup', () => {
    assert.equal(parseDaumBookPage('<dl><dt class="x"> 쪽수 </dt><dd class="cont">1,100&nbsp;|</dd></dl>').pageCount, 1100);
    assert.equal(parseDaumBookPage('<dt>페이지수</dt><dd>392 | <span>사이즈</span> 158*233mm</dd>').pageCount, 392);
    assert.equal(parseDaumBookPage('<dt>페이지수</dt><dd>정보 없음</dd>').pageCount, undefined);
    assert.equal(parseDaumBookPage('<html>changed layout</html>').pageCount, undefined);
  });
  await test('언스크립티드: full 책소개 (Kakao cuts it at ~250 chars), not the 목차', () => {
    const facts = parseDaumBookPage(fixture('daum-bookpage-9791187444213.html'));
    assert.equal(facts.pageCount, 496);
    const intro = facts.description!;
    assert.ok(intro.startsWith('30대에 자수성가한 백만장자'), intro.slice(0, 40));
    assert.ok(intro.endsWith('동기부여가 되어준다.'), intro.slice(-40));
    assert.ok(intro.length > 600, String(intro.length));
    assert.equal(intro.split('\n\n').length, 3);
    assert.ok(!intro.includes('PART 1') && !intro.includes('<'));
  });
  await test('책소개 with a collapsed tail (.ellipsis + .hide_desc) is joined; missing section → undefined', () => {
    const html =
      '<div class="coll_tit"> <h3 class="tit">책소개</h3> </div> <p class="desc"> 첫 문단 &amp; 끝. <br> <br>둘째 문단의 앞<span class="ellipsis">...</span><span class="hide_desc">과 뒤.</span> </p>';
    assert.equal(parseDaumIntro(html), '첫 문단 & 끝.\n\n둘째 문단의 앞과 뒤.');
    assert.equal(parseDaumIntro('<h3 class="tit">목차</h3></div><p class="desc">1장</p>'), undefined);
    assert.equal(parseDaumBookPage(fixture('daum-bookpage-9788954682152.html')).description, undefined);
  });
  await test('only https://search.daum.net bookpage URLs are fetched', () => {
    assert.ok(isDaumBookPageUrl('https://search.daum.net/search?w=bookpage&bookId=5824679&q=%EC%9E%91'));
    assert.ok(!isDaumBookPageUrl('http://search.daum.net/search?w=bookpage&bookId=1'));
    assert.ok(!isDaumBookPageUrl('https://evil.example/search?w=bookpage&bookId=1'));
    assert.ok(!isDaumBookPageUrl('https://search.daum.net/search?w=book&q=x'));
    assert.ok(!isDaumBookPageUrl(undefined));
  });
  await test('ENABLE_DAUM_PAGES=false turns the provider off without fetching', async () => {
    const before = process.env.ENABLE_DAUM_PAGES;
    assert.equal(daumPagesEnabled(), true);
    process.env.ENABLE_DAUM_PAGES = 'false';
    assert.equal(daumPagesEnabled(), false);
    assert.equal(await daumBookFacts('9788954682152', 'https://search.daum.net/search?w=bookpage&bookId=5824679'), null);
    process.env.ENABLE_DAUM_PAGES = before ?? '';
    if (before === undefined) delete process.env.ENABLE_DAUM_PAGES;
  });

  console.log('kyobo bestsellers');
  await test('weekly 종합 JSON → ranked books with ISBN, cover, period', () => {
    const ranking = parseKyoboBestsellers(JSON.parse(fixture('kyobo-bestseller-weekly.json')));
    assert.equal(ranking.items.length, 20);
    assert.equal(ranking.periodStart, '2026-09-30');
    assert.equal(ranking.periodEnd, '2026-10-06');
    const first = ranking.items[0];
    assert.equal(first.rank, 1);
    assert.equal(first.isbn13, '9791141691370');
    assert.equal(first.book.id, 'kr_9791141691370');
    assert.equal(first.book.source, 'kyobo');
    assert.equal(first.book.title, '가호');
    assert.deepEqual(first.book.authors, ['무라카미 하루키']);
    assert.equal(first.book.publisher, '문학동네');
    assert.equal(first.book.publishedDate, '2026-10-21');
    assert.match(first.book.coverUrl!, /^https:\/\/contents\.kyobobook\.co\.kr\/.+9791141691370\.jpg$/);
    assert.match(first.book.link!, /^https:\/\/product\.kyobobook\.co\.kr\/detail\/S\d+$/);
    assert.deepEqual(ranking.items.map((i) => i.rank), Array.from({ length: 20 }, (_, i) => i + 1));
  });
  await test('rows without an ISBN-13 are skipped; limit applies; junk input is empty', () => {
    const json = { data: { ymw: 'bad', bestSeller: [{ prstRnkn: 1, cmdtCode: 'S0001', cmdtName: 'e-book' }, { prstRnkn: 2, cmdtCode: '9788954682152', cmdtName: '작별하지 않는다' }, { prstRnkn: 3, cmdtCode: '9788936434120', cmdtName: '소년이 온다' }] } };
    const ranking = parseKyoboBestsellers(json, 1);
    assert.deepEqual(ranking.items.map((i) => i.isbn13), ['9788954682152']);
    assert.equal(ranking.items[0].rank, 2);
    assert.equal(ranking.periodStart, undefined);
    assert.deepEqual(parseKyoboBestsellers(null).items, []);
    assert.deepEqual(parseKyoboBestsellers({ data: { bestSeller: 'x' } }).items, []);
  });
  await test('ENABLE_KYOBO_BESTSELLERS=off turns the provider off without fetching', async () => {
    process.env.ENABLE_KYOBO_BESTSELLERS = 'off';
    assert.equal(kyoboEnabled(), false);
    assert.equal(await kyoboBestsellers(), null);
    delete process.env.ENABLE_KYOBO_BESTSELLERS;
    assert.equal(kyoboEnabled(), true);
  });

  console.log(`\n${passed} scraper parser tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
