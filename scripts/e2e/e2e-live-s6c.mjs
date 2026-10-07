// Live: Kyobo bestsellers on the search screen + automatic 전체 N쪽 in the record sheet (Daum pages).
import { writeFileSync } from 'node:fs';
import { openBrowser, sleep } from './cdp.mjs';

const BASE = 'https://reading-forest-nine.vercel.app';
const OUT = `${process.env.TEMP}\\rf-e2e\\s6c-live`;
const report = { checks: {}, notes: [] };
const check = (k, v, extra) => { report.checks[k] = !!v; console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`); };
const P = await openBrowser('K', { base: BASE, out: OUT });
try {
  await P.visit('/search', 7000);
  check('search: 교보문고 베스트셀러 title', await P.waitFor('교보문고 베스트셀러', 10000));
  const n = await P.evaluate(`document.querySelector('[data-testid="bestsellers"]')?.querySelectorAll('[role=button]').length ?? 0`);
  check('search: 20 ranked books', n === 20, `${n}`);
  const caption = await P.evaluate(`document.querySelector('[data-testid="bestsellers-source"]')?.textContent ?? ''`);
  check('search: 출처 caption with 기준일', /출처: 교보문고 · 2026\.\d{2}\.\d{2}~\d{2}\.\d{2} 기준/.test(caption), caption);
  await sleep(2500);
  const covers = await P.evaluate(`[...document.querySelectorAll('[data-testid="bestsellers"] img')].map(i => ({ ok: i.complete && i.naturalWidth > 0, src: i.src.slice(0, 60) }))`);
  check('search: Kyobo covers load', covers.length >= 6 && covers.slice(0, 6).every((c) => c.ok), `${covers.filter((c) => c.ok).length}/${covers.length}`);
  await P.shot('search-bestsellers');

  const sheet = async (id, label) => {
    await P.visit(`/book/${id}`, 6000);
    await P.clickEnds('서재에 담기');
    await sleep(800);
    await P.clickStarts('읽고 있는 책');
    await sleep(800);
    const m = await P.waitUntil(`(document.body.innerText.match(/전체 (\\d+)쪽/) || [])[1]`, 10000);
    return m;
  };
  const books = [
    ['kr_9788954682152', '작별하지 않는다', 332],
    ['kr_9791187444725', '부의 추월차선 10주년', 392],
    ['kr_9791141601591', '한강 스페셜 에디션', 1100],
    ['kr_9791168473690', '세이노의 가르침', 736],
  ];
  for (const [id, label, want] of books) {
    const got = await sheet(id, label);
    check(`record sheet auto 전체 N쪽: ${label}`, Number(got) === want, `got ${got}`);
    if (id === 'kr_9791187444725') await P.shot('record-sheet-pages');
  }
  // a Kyobo bestseller opened from the search grid
  await P.visit('/search', 6000);
  await P.waitFor('교보문고 베스트셀러', 10000);
  await P.clickAt(await P.rectOf(`document.querySelector('[data-testid="bestsellers"] [role=button]')`));
  await sleep(5000);
  await P.clickEnds('서재에 담기');
  await sleep(800);
  await P.clickStarts('읽고 있는 책');
  const top = await P.waitUntil(`(document.body.innerText.match(/전체 (\\d+)쪽/) || [])[1]`, 10000);
  check('record sheet auto pages for Kyobo #1', Number(top) > 0, `got ${top}`);

  report.errors = P.errors.filter((e) => !e.startsWith('[dialog]'));
  report.failed = P.failed;
  check('zero console errors', report.errors.length === 0, JSON.stringify(report.errors).slice(0, 600));
} catch (err) {
  console.error(err);
  report.crash = String(err?.stack ?? err);
  report.errors = P.errors;
} finally {
  writeFileSync(`${OUT}\\report.json`, JSON.stringify(report, null, 2));
  const fails = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n${Object.keys(report.checks).length - fails.length}/${Object.keys(report.checks).length} PASS${fails.length ? ' — FAIL: ' + fails.join(' | ') : ''}`);
  P.close();
}

