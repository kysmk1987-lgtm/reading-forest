// Sprint 6 live check (https://reading-forest-nine.vercel.app). No sign-in: production has no migration 0004 yet,
// so review RPC 404s are reported separately as "expected until setup_0004.sql".
import { writeFileSync } from 'node:fs';
import { openBrowser, sleep } from './cdp.mjs';

const BASE = process.argv[2] ?? 'https://reading-forest-nine.vercel.app';
const OUT = process.argv[3] ?? `${process.env.TEMP}\\rf-e2e\\s6-live`;
const report = { base: BASE, checks: {}, notes: [] };
const check = (k, v, extra) => { report.checks[k] = !!v; console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`); };
const note = (s) => { report.notes.push(s); console.log('  ·', s); };

const now = Date.now();
const book = (isbn, title, author, pageCount) => ({ id: `kr_${isbn}`, source: 'kakao', title, authors: [author], publisher: '창비', isbn13: isbn, ...(pageCount ? { pageCount } : {}) });
const ENTRIES = {
  e1: { id: 'e1', book: book('9788936434120', '소년이 온다', '한강', 216), status: 'reading', createdAt: now - 9e6, updatedAt: now - 9e6, startDate: '2026-10-01', progressUnit: 'page', currentPage: 120, treeSpecies: 'ginkgo' },
  e2: { id: 'e2', book: book('9788954682152', '작별하지 않는다', '한강', 332), status: 'read', createdAt: now - 8e6, updatedAt: now - 8e6, endDate: '2026-09-20', rating: 4.5, review: '눈이 내리는 장면이 오래 남았다.', treeSpecies: 'birch' },
  e3: { id: 'e3', book: book('9791197221989', '첫 여름, 완주', '김금희'), status: 'reading', createdAt: now - 7e6, updatedAt: now - 7e6, startDate: '2026-10-03', treeSpecies: 'palm' },
  e4: { id: 'e4', book: book('9788998441012', '모순', '양귀자', 304), status: 'read', createdAt: now - 6e6, updatedAt: now - 6e6, endDate: '2026-08-12', treeSpecies: 'magnolia' },
};

const P = await openBrowser('L', { base: BASE, out: OUT });
const rectByLabel = (label) => P.evaluate(`(() => { const el = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, bottom: b.bottom }; })()`);
const lib = () => P.evaluate(`JSON.parse(localStorage.getItem('rf-library')).state.entries`);
const centered = (labels) => P.evaluate(`(() => {
  const leaf = (t) => [...document.querySelectorAll('div')].filter(e => e.offsetParent && e.textContent.trim() === t && ![...e.children].some(c => c.textContent.trim() === t)).pop();
  const btns = ${JSON.stringify(labels)}.map(leaf).map(e => e && e.closest('[role=button]') || e);
  if (btns.some(b => !b)) return { ok: false, why: 'missing' };
  let card = btns[0]; while (card && !(card.textContent.includes('문장 갤러리') && card.getBoundingClientRect().width > 300)) card = card.parentElement;
  const rs = btns.map(b => b.getBoundingClientRect()); const c = card.getBoundingClientRect();
  const mid = (Math.min(...rs.map(r => r.left)) + Math.max(...rs.map(r => r.right))) / 2;
  return { ok: Math.abs(mid - (c.left + c.right) / 2) < 3, delta: mid - (c.left + c.right) / 2 };
})()`);
try {
  await P.visit('/', 2500);
  await P.evaluate(`localStorage.setItem('rf-library', JSON.stringify({ state: { entries: ${JSON.stringify(ENTRIES)}, logs: [] }, version: 1 }));
    localStorage.setItem('rf-entitlements', JSON.stringify({ state: { isPremium: true }, version: 0 }));
    localStorage.setItem('rf-settings', JSON.stringify({ state: { language: null, soundEnabled: true, hapticsEnabled: true, blurUnownedQuotes: false }, version: 0 }));`);
  await P.visit('/', 5000);

  // 3
  const home = await centered(['🖋️ 카드 만들기', '🖼️ 갤러리 구경']);
  check('3 home gallery buttons centered', home.ok, JSON.stringify(home));
  // 1
  await P.evaluate('window.scrollTo(0, 0)');
  await P.clickText('🪴 옮겨 심기');
  check('1 edit mode', await P.waitFor('옮길 나무를 골라주세요', 4000));
  await P.clickAt(await rectByLabel('소년이 온다'));
  check('1 tree picked → target hint', await P.waitFor('어디로 옮길까요?', 3000));
  const tiles = await P.evaluate(`[...document.querySelectorAll('[data-testid^="tile-"]')].map(e => { const b = e.getBoundingClientRect(); return { id: e.dataset.testid, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })`);
  check('1 empty tiles highlighted as targets', tiles.length > 0, `${tiles.length}`);
  const t0 = tiles[0];
  await P.clickAt(t0);
  let e = await lib();
  const [tc, tr] = t0.id.split('-').slice(1).map(Number);
  check('1 tap-tap move saved locally', e.e1.gardenX === tc && e.e1.gardenY === tr);
  check('1 dig sound', (await P.evaluate('window.__audio.media')).includes('dig'));
  await sleep(900);
  const before = await lib();
  await P.clickAt(await rectByLabel('작별하지 않는다'));
  await P.clickAt(await rectByLabel('모순'));
  e = await lib();
  check('1 swap', e.e2.gardenX === before.e4.gardenX && e.e4.gardenY === before.e2.gardenY);
  await sleep(900);
  await P.clickText('➕ 땅 넓히기');
  await sleep(500);
  check('1 expand garden', (await P.evaluate(`JSON.parse(localStorage.getItem('rf-forest')).state.gardenExtra`)) >= 1);
  // drag 첫 여름, 완주 onto a free tile
  await P.clickAt(await rectByLabel('모순'));
  const free = await P.evaluate(`[...document.querySelectorAll('[data-testid^="tile-"]')].map(e => { const b = e.getBoundingClientRect(); return { id: e.dataset.testid, x: b.x + b.width / 2, y: b.y + b.height / 2 }; })`);
  await P.clickAt(await rectByLabel('모순'));
  const dest = free.filter((f) => f.x > 20 && f.x < 370 && f.y > 60 && f.y < 800).pop();
  const s = await rectByLabel('첫 여름, 완주');
  const from = { x: s.x, y: s.bottom - 6 };
  await P.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await P.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + ((dest.x - from.x) * i) / 12, y: from.y + ((dest.y - from.y) * i) / 12, button: 'left', buttons: 1 });
    await sleep(30);
  }
  await P.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dest.x, y: dest.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(700);
  e = await lib();
  const [dc, dr] = dest.id.split('-').slice(1).map(Number);
  check('1 drag & drop', e.e3.gardenX === dc && e.e3.gardenY === dr, JSON.stringify([e.e3.gardenX, e.e3.gardenY, dc, dr]));
  await P.clickText('완료');
  check('1 library store migrated to v2', (await P.evaluate(`JSON.parse(localStorage.getItem('rf-library')).version`)) === 2);

  // 2
  await P.visit('/trees', 4000);
  check('2 new species', (await Promise.all(['은행나무', '자작나무', '야자수', '목련'].map((n) => P.bodyHas(n)))).every(Boolean));
  check('2 seven premium badges', (await P.evaluate(`(document.body.innerText.match(/👑 프리미엄/g) || []).length`)) === 7);
  // 4
  await P.visit('/card/new', 3500);
  check('4 no OCR', !(await P.bodyHas('사진에서 글자 읽기')) && !(await P.bodyHas('글자 인식')));
  // 8
  await P.visit('/records', 4500);
  const pos = await P.evaluate(`(() => { const el = [...document.querySelectorAll('div')].filter(e => e.offsetParent && e.textContent.trim() === '독서 DNA 결산 리포트').pop(); const days = [...document.querySelectorAll('[role=button][aria-label]')].filter(e => /^\\d+$/.test(e.getAttribute('aria-label'))); return { banner: el && el.getBoundingClientRect().top, cal: days.length && days.pop().getBoundingClientRect().bottom }; })()`);
  check('8 banner below calendar', pos.banner > pos.cal, JSON.stringify(pos));
  // 9 + 5 setting + 3
  await P.visit('/my', 4000);
  check('9 no 진동 피드백', !(await P.bodyHas('진동 피드백')));
  check('9 settings migrated', (await P.evaluate(`JSON.parse(localStorage.getItem('rf-settings'))`)).state.hapticsEnabled === undefined);
  check('5 한줄평 공개 범위 (기본 전체 공개)', (await P.bodyHas('한줄평 공개 범위')) && (await P.bodyHas('🌏 전체 공개')));
  const my = await centered(['🔖 내 스크랩', '🗂️ 내 카드', '✍️ 카드 만들기']);
  check('3 my gallery buttons centered', my.ok, JSON.stringify(my));
  // 6
  await P.visit('/search', 6000);
  check('6 no ISBN tab / barcode', !(await P.bodyHas('바코드 스캔')) && !(await P.evaluate(`[...document.querySelectorAll('[role=button]')].some(b => b.textContent.trim() === 'ISBN')`)));
  check('6 bestsellers grid', await P.waitFor('요즘 많이 읽는 책', 8000));
  const items = await P.evaluate(`document.querySelector('[data-testid="bestsellers"]')?.querySelectorAll('[role=button]').length ?? 0`);
  check('6 bestsellers items', items >= 9, `${items}`);
  await P.shot('search-bestsellers');
  await P.typeInto('제목, 저자, 출판사를 입력하세요', '9788936434120');
  await P.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await P.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  check('6 ISBN typed in the box finds the book', await P.waitFor('소년이 온다', 8000));
  // bestseller tap → detail
  await P.visit('/search', 5000);
  await P.waitFor('요즘 많이 읽는 책', 8000);
  await P.clickAt(await P.rectOf(`document.querySelector('[data-testid="bestsellers"] [role=button]')`));
  await sleep(3000);
  check('6 bestseller opens book detail', await P.evaluate(`location.pathname.startsWith('/book/')`));

  // 5 tabs + 7 pages
  await P.visit('/book/kr_9788936434120', 5000);
  check('5 tabs 책 소개 | 리뷰', (await P.bodyHas('책 소개')) && (await P.bodyHas('리뷰')));
  await P.clickText('기록 수정');
  await sleep(1200);
  check('7 전체 216쪽 next to toggle', await P.waitFor('전체 216쪽', 3000));
  await P.shot('record-sheet-live');
  await P.visit('/book/kr_9791197221989', 5000);
  await P.clickText('기록 수정');
  await sleep(1200);
  check('7 no page info → 직접 입력 link + % mode', (await P.waitFor('쪽수 정보가 없어요', 3000)) && (await P.evaluate(`!!document.querySelector('input[placeholder="현재 %"]')`)));
  await P.visit('/book/kr_9788954682152?tab=reviews', 6000);
  const reviewsState = (await P.bodyHas('리뷰 모아보기를 준비하고 있어요')) ? 'unavailable (0004 not applied)' : (await P.bodyHas('리뷰 1개')) || (await P.bodyHas('아직 리뷰가 없어요')) ? 'server' : 'other';
  note(`reviews tab on live: ${reviewsState}`);
  check('5 reviews tab renders (own record shown)', await P.bodyHas('눈이 내리는 장면이 오래 남았다.'));
  await P.shot('reviews-live');

  const pre0004 = (s) => /rpc\/book_review|book_review_summary|book_reviews_feed/.test(s);
  report.expectedPre0004 = P.errors.filter(pre0004);
  report.errors = P.errors.filter((x) => !pre0004(x) && !x.startsWith('[dialog]'));
  note(`review RPC 404s (until setup_0004.sql): ${report.expectedPre0004.length}`);
  check('zero console errors (excluding pre-0004 review RPC 404s)', report.errors.length === 0, JSON.stringify(report.errors).slice(0, 600));
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
