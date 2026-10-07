// Sprint 6 local e2e (mock Supabase with migration 0004): transplant, premium species, centered gallery buttons,
// OCR removal, book tabs + reviews (2 users), record-sheet page counts, records layout, settings.
// Usage: node e2e-s6.mjs <base> <sbUrl> <out>
import { writeFileSync } from 'node:fs';
import { openBrowser, sleep, SESSION_JS } from './cdp.mjs';

const BASE = process.argv[2] ?? 'http://localhost:8130';
const SB = process.argv[3] ?? 'http://localhost:54321';
const OUT = process.argv[4] ?? `${process.env.TEMP}\\rf-e2e\\s6-local`;
const report = { base: BASE, checks: {}, notes: [] };
const check = (k, v, extra) => { report.checks[k] = !!v; console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`); };
const note = (s) => { report.notes.push(s); console.log('  ·', s); };
// The local static server has no /api/books (book search/detail proxy): those 404s are expected here only.
const ignore = [/\[dialog\]/, /\/api\/books/, /Failed to load resource: the server responded with a status of 404/];

const now = Date.now();
const book = (isbn, title, author, pageCount) => ({ id: `kr_${isbn}`, source: 'kakao', title, authors: [author], publisher: '창비', isbn13: isbn, ...(pageCount ? { pageCount } : {}) });
const ENTRIES = {
  e1: { id: 'e1', book: book('9788936434120', '소년이 온다', '한강', 321), status: 'reading', createdAt: now - 9e6, updatedAt: now - 9e6, startDate: '2026-10-01', progressUnit: 'page', currentPage: 120, treeSpecies: 'ginkgo' },
  e2: { id: 'e2', book: book('9788954682152', '작별하지 않는다', '한강', 332), status: 'read', createdAt: now - 8e6, updatedAt: now - 8e6, startDate: '2026-09-01', endDate: '2026-09-20', rating: 4.5, review: '눈이 내리는 장면이 오래 남았다.', treeSpecies: 'birch' },
  e3: { id: 'e3', book: book('9791197221989', '첫 여름, 완주', '김금희'), status: 'reading', createdAt: now - 7e6, updatedAt: now - 7e6, startDate: '2026-10-03', treeSpecies: 'palm' },
  e4: { id: 'e4', book: book('9788998441012', '모순', '양귀자', 304), status: 'read', createdAt: now - 6e6, updatedAt: now - 6e6, startDate: '2026-08-01', endDate: '2026-08-12', treeSpecies: 'magnolia' },
  e5: { id: 'e5', book: book('9788936439743', '혼모노', '성해나', 268), status: 'read', createdAt: now - 5e6, updatedAt: now - 5e6, endDate: '2026-10-05', treeSpecies: 'cherry' },
  e6: { id: 'e6', book: book('9788937473401', '급류', '정대건', 300), status: 'want', createdAt: now - 4e6, updatedAt: now - 4e6 },
};

async function seed(P) {
  await P.visit('/', 2000);
  await P.evaluate(`localStorage.setItem('rf-library', JSON.stringify({ state: { entries: ${JSON.stringify(ENTRIES)}, logs: [] }, version: 1 }));
    localStorage.setItem('rf-entitlements', JSON.stringify({ state: { isPremium: true }, version: 0 }));
    localStorage.setItem('rf-settings', JSON.stringify({ state: { language: null, soundEnabled: true, hapticsEnabled: false, blurUnownedQuotes: false }, version: 0 }));`);
}
async function signIn(P) {
  await P.visit('/my', 3500);
  await P.click(`t => t.includes('익명으로 시작하기')`, 'first', '익명으로 시작하기');
  const s = await P.waitUntil(SESSION_JS, 15000);
  await sleep(3000);
  return s;
}
async function api(token, method, path, body, extra = {}) {
  const r = await fetch(SB + path, { method, headers: { apikey: 'x', Authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extra }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.slice(0, 300) };
}
const lib = (P) => P.evaluate(`JSON.parse(localStorage.getItem('rf-library')).state.entries`);
const rectByLabel = (P, label) => P.evaluate(`(() => { const el = document.querySelector('[aria-label=${JSON.stringify(label)}]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, top: b.top, bottom: b.bottom }; })()`);
const centeredRow = (P, labels, cardText) => P.evaluate(`(() => {
  const leaf = (t) => [...document.querySelectorAll('div')].filter(e => e.offsetParent && e.textContent.trim() === t && ![...e.children].some(c => c.textContent.trim() === t)).pop();
  const btns = ${JSON.stringify(labels)}.map(leaf).map(e => e && e.closest('[role=button]') || e);
  if (btns.some(b => !b)) return { ok: false, why: 'missing' };
  let card = btns[0]; while (card && !(card.textContent.includes(${JSON.stringify(cardText)}) && card.getBoundingClientRect().width > 300)) card = card.parentElement;
  const rs = btns.map(b => b.getBoundingClientRect()); const c = card.getBoundingClientRect();
  const left = Math.min(...rs.map(r => r.left)), right = Math.max(...rs.map(r => r.right));
  return { ok: Math.abs((left + right) / 2 - (c.left + c.right) / 2) < 3, delta: (left + right) / 2 - (c.left + c.right) / 2 };
})()`);

const A = await openBrowser('A', { base: BASE, out: OUT, ignore });
const B = await openBrowser('B', { base: BASE, out: OUT, ignore });
try {
  await seed(A);
  await A.visit('/', 4500);

  // ---- 3. home gallery card buttons centered ----
  const home = await centeredRow(A, ['🖋️ 카드 만들기', '🖼️ 갤러리 구경'], '문장 갤러리');
  check('3 home gallery buttons centered', home.ok, JSON.stringify(home));

  // ---- 1. transplant ----
  await A.evaluate('window.scrollTo(0, 0)');
  await A.clickText('🪴 옮겨 심기');
  check('1 edit mode hint', await A.waitFor('옮길 나무를 골라주세요', 4000));
  const tile = (c, r) => A.evaluate(`(() => { const el = document.querySelector('[data-testid="tile-${c}-${r}"]'); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  // tap-tap move
  await A.clickAt(await rectByLabel(A, '소년이 온다'));
  check('1 target hint after picking a tree', await A.waitFor('어디로 옮길까요?', 3000));
  const emptyTiles = await A.evaluate(`[...document.querySelectorAll('[data-testid^="tile-"]')].map(e => e.dataset.testid)`);
  note(`empty tiles while moving: ${emptyTiles.join(',')}`);
  const target = emptyTiles.includes('tile-0-0') ? [0, 0] : emptyTiles[0].split('-').slice(1).map(Number);
  await A.clickAt(await tile(...target));
  await sleep(250);
  await A.shot('forest-transplant');
  let entries = await lib(A);
  check('1 tap-tap move saved', entries.e1.gardenX === target[0] && entries.e1.gardenY === target[1], JSON.stringify([entries.e1.gardenX, entries.e1.gardenY]));
  check('1 every tree pinned after first move', Object.values(entries).every((e) => Number.isInteger(e.gardenX) && Number.isInteger(e.gardenY)));
  const audio = await A.evaluate('window.__audio.media');
  check('1 dig sound played', audio.includes('dig'), JSON.stringify(audio));
  await sleep(900);
  // swap
  const before = await lib(A);
  await A.clickAt(await rectByLabel(A, '작별하지 않는다'));
  await A.clickAt(await rectByLabel(A, '모순'));
  entries = await lib(A);
  check('1 swap exchanges tiles', entries.e2.gardenX === before.e4.gardenX && entries.e2.gardenY === before.e4.gardenY && entries.e4.gardenX === before.e2.gardenX && entries.e4.gardenY === before.e2.gardenY);
  await sleep(900);
  // expand then drag & drop
  await A.clickText('➕ 땅 넓히기');
  await sleep(600);
  check('1 garden expanded', (await A.evaluate(`JSON.parse(localStorage.getItem('rf-forest')).state.gardenExtra`)) === 1);
  const d0 = await lib(A);
  const from = await rectByLabel(A, '혼모노');
  await A.clickAt(await rectByLabel(A, '급류'));
  const freeNow = await A.evaluate(`[...document.querySelectorAll('[data-testid^="tile-"]')].map(e => e.dataset.testid)`);
  await A.clickAt(await rectByLabel(A, '급류')); // deselect
  const dropId = freeNow[freeNow.length - 1];
  const [dc, dr] = dropId.split('-').slice(1).map(Number);
  // drag 혼모노 by mouse to the far empty tile: compute the tile centre from its hit box before it disappears.
  await A.clickAt(await rectByLabel(A, '급류'));
  const dropAt = await tile(dc, dr);
  await A.clickAt(await rectByLabel(A, '급류'));
  const start = await rectByLabel(A, '혼모노');
  const base = { x: start.x, y: start.bottom - 6 };
  await A.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: base.x, y: base.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await A.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: base.x + ((dropAt.x - base.x) * i) / 12, y: base.y + ((dropAt.y - base.y) * i) / 12, button: 'left', buttons: 1 });
    await sleep(30);
  }
  await A.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dropAt.x, y: dropAt.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(700);
  entries = await lib(A);
  check('1 drag & drop moves a tree', entries.e5.gardenX === dc && entries.e5.gardenY === dr, JSON.stringify({ from: [d0.e5.gardenX, d0.e5.gardenY], to: [entries.e5.gardenX, entries.e5.gardenY], want: [dc, dr], start: from }));
  await A.clickText('완료');
  check('1 done leaves edit mode', await A.waitFor('나무를 누르면 책 정보를 볼 수 있어요', 3000));
  await A.fullShot('home-after');

  // ---- 2. premium species in 도감 ----
  await A.visit('/trees', 4000);
  const names = ['은행나무', '자작나무', '야자수', '목련'];
  const has = await Promise.all(names.map((n) => A.bodyHas(n)));
  check('2 four new species in 도감', has.every(Boolean));
  const premiumBadges = await A.evaluate(`(document.body.innerText.match(/👑 프리미엄/g) || []).length`);
  check('2 seven premium badges', premiumBadges === 7, `${premiumBadges}`);
  await A.fullShot('tree-premium');

  // ---- 4. OCR removed ----
  await A.visit('/card/new', 3500);
  check('4 no OCR UI in card maker', !(await A.bodyHas('사진에서 글자 읽기')) && !(await A.bodyHas('글자 인식')));

  // ---- 8. records layout ----
  await A.visit('/records', 4000);
  const banner = await A.evaluate(`(() => { const el = [...document.querySelectorAll('div')].filter(e => e.offsetParent && e.textContent.trim() === '독서 DNA 결산 리포트').pop(); return el ? el.getBoundingClientRect().top + window.scrollY : null; })()`);
  const lastDay = await A.evaluate(`(() => { const days = [...document.querySelectorAll('[role=button][aria-label]')].filter(e => /^\\d+$/.test(e.getAttribute('aria-label'))); const b = days.pop()?.getBoundingClientRect(); return b ? b.bottom + window.scrollY : null; })()`);
  check('8 결산 banner below the calendar', banner && lastDay && banner > lastDay, JSON.stringify({ banner, lastDay }));
  await A.fullShot('records-layout');

  // ---- 9 + 5(setting). settings ----
  await A.visit('/my', 3500);
  check('9 haptics toggle removed', !(await A.bodyHas('진동 피드백')));
  check('9 settings store migrated (no hapticsEnabled)', (await A.evaluate(`JSON.parse(localStorage.getItem('rf-settings'))`)).state.hapticsEnabled === undefined);
  check('5 한줄평 공개 범위 setting (default 전체 공개)', (await A.bodyHas('한줄평 공개 범위')) && (await A.evaluate(`JSON.parse(localStorage.getItem('rf-settings')).state.reviewVisibility`)) === 'public');
  const my = await centeredRow(A, ['🔖 내 스크랩', '🗂️ 내 카드', '✍️ 카드 만들기'], '문장 갤러리');
  check('3 my gallery buttons centered', my.ok, JSON.stringify(my));
  await A.fullShot('my-settings');

  // ---- 6. search simplified (bestsellers need /api → verified on the live site) ----
  await A.visit('/search', 3000);
  check('6 no ISBN tab / barcode button', !(await A.bodyHas('바코드 스캔')) && !(await A.evaluate(`[...document.querySelectorAll('[role=button]')].some(b => b.textContent.trim() === 'ISBN')`)));
  check('6 single box placeholder', await A.evaluate(`!!document.querySelector('input[placeholder="제목, 저자, 출판사를 입력하세요"]')`));

  // ---- 7. record sheet page counts ----
  await A.visit('/book/kr_9788936434120', 3500);
  check('5 tabs 책 소개 | 리뷰', (await A.bodyHas('책 소개')) && (await A.bodyHas('리뷰')));
  await A.clickText('기록 수정');
  await sleep(1200);
  check('7 record sheet shows 전체 321쪽 next to toggle', await A.waitFor('전체 321쪽', 3000));
  check('7 no 전체 쪽수 input when pages known', !(await A.evaluate(`!!document.querySelector('input[placeholder="예: 320"]')`)));
  await A.shot('record-sheet-pages');
  await A.visit('/book/kr_9791197221989', 3500);
  await A.clickText('기록 수정');
  await sleep(1200);
  check('7 unknown pages → fallback link', await A.waitFor('쪽수 정보가 없어요', 3000));
  check('7 unknown pages → % mode', await A.evaluate(`!!document.querySelector('input[placeholder="현재 %"]')`));
  await A.clickText('직접 입력');
  check('7 직접 입력 reveals the input', await A.evaluate(`!!document.querySelector('input[placeholder="예: 320"]')`));
  await A.shot('record-sheet-fallback');

  // ---- 5. reviews (server via mock 0004) ----
  const sA = await signIn(A);
  check('A signed in (mock)', !!sA?.access_token);
  await A.visit('/book/kr_9788954682152', 3500);
  await A.clickText('기록 수정');
  await sleep(1000);
  check('5 record sheet shows 전체 공개 note', await A.bodyHas('전체 공개 · 이 책의 리뷰 탭에 보여요'));
  await A.click(`t => t === '저장하기'`, 'last', 'save');
  await sleep(2500);
  const tokenA = (await A.evaluate(SESSION_JS)).access_token;
  const summary1 = await api(tokenA, 'POST', '/rest/v1/rpc/book_review_summary', { p_isbn: '9788954682152' });
  check('5 record rating auto-published', summary1.json?.count === 1 && Number(summary1.json?.average) === 4.5, summary1.text);
  await A.visit('/book/kr_9788954682152?tab=reviews', 4000);
  await A.waitFor('리뷰 1개', 6000);
  check('5 A sees own review', (await A.bodyHas('눈이 내리는 장면이 오래 남았다.')) && (await A.bodyHas('내 리뷰')));

  await seed(B);
  const sB = await signIn(B);
  check('B signed in (mock)', !!sB?.access_token);
  await B.visit('/book/kr_9788954682152?tab=reviews', 4500);
  check('5 B sees A\'s review', await B.waitFor('눈이 내리는 장면이 오래 남았다.', 6000));
  // B writes a 3.5★ review (B's library has e2 as read with 4.5★ seeded; use the form)
  if (await B.bodyHas('리뷰 쓰기') || await B.bodyHas('내 리뷰')) {
    await B.clickLabel('3.5');
    const ta = await B.rectOf(`[...document.querySelectorAll('textarea')].filter(i => i.placeholder.startsWith('이 책은 어땠나요?')).pop()`);
    await B.clickAt(ta);
    await B.evaluate(`document.activeElement.select && document.activeElement.select()`);
    await B.send('Input.insertText', { text: '조용하지만 강한 책. 반쯤 별을 뺐어요.' });
    await sleep(400);
    await B.clickStarts('리뷰 올리기');
    await sleep(2500);
  }
  const summary2 = await api(tokenA, 'POST', '/rest/v1/rpc/book_review_summary', { p_isbn: '9788954682152' });
  check('5 half-star review saved, average 4.0 over 2', summary2.json?.count === 2 && Number(summary2.json?.average) === 4, summary2.text);
  await B.waitFor('리뷰 2개', 5000);
  await B.evaluate('window.scrollTo(0, 0)');
  await B.fullShot('book-reviews');
  // B reports A's review
  const mores = await B.evaluate(`[...document.querySelectorAll('[aria-label="더보기"]')].length`);
  await B.evaluate(`window.__more = [...document.querySelectorAll('[aria-label="더보기"]')].pop(); window.__more.scrollIntoView({ block: 'center' })`);
  await B.clickAt(await B.evaluate(`(() => { const b = window.__more.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`));
  await sleep(500);
  const menuReport = await B.bodyHas('신고');
  if (menuReport) await B.clickText('신고');
  await sleep(2500);
  check('5 report via 더보기 menu', menuReport && (await B.bodyHas('신고가 접수됐어요') || !(await B.bodyHas('눈이 내리는 장면이 오래 남았다.'))), `more buttons ${mores}`);
  check('5 reported review hidden for reporter', !(await B.bodyHas('눈이 내리는 장면이 오래 남았다.')));
  // A deletes own review
  await A.visit('/book/kr_9788954682152?tab=reviews', 4000);
  await A.evaluate(`window.__more = [...document.querySelectorAll('[aria-label="더보기"]')][0]; window.__more.scrollIntoView({ block: 'center' })`);
  await A.clickAt(await A.evaluate(`(() => { const b = window.__more.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`));
  await sleep(400);
  await A.clickText('삭제');
  await sleep(2500);
  const summary3 = await api(tokenA, 'POST', '/rest/v1/rpc/book_review_summary', { p_isbn: '9788954682152' });
  check('5 own review deleted', summary3.json?.count === 1, summary3.text);

  // ---- 1. positions sync to user_books + public forest RPC ----
  const rows = await api(tokenA, 'GET', '/rest/v1/user_books?select=id,garden_x,garden_y');
  check('1 garden_x/garden_y synced to user_books', Array.isArray(rows.json) && rows.json.length === 6 && rows.json.every((r) => Number.isInteger(r.garden_x)), rows.text);
  const forest = await api(tokenA, 'POST', '/rest/v1/forests?select=share_slug', { nickname: 'e2e', is_public: true }, { Prefer: 'return=representation', Accept: 'application/vnd.pgrst.object+json' });
  const slug = forest.json?.share_slug ?? forest.json?.[0]?.share_slug;
  const pub = await api(tokenA, 'POST', '/rest/v1/rpc/get_public_forest', { p_slug: slug });
  check('1 public forest RPC returns saved tiles', pub.json?.trees?.every((t) => Number.isInteger(t.garden_x)), `${slug} ${pub.text.slice(0, 120)}`);
  if (slug) {
    await B.visit(`/forest/${slug}`, 5000);
    await B.shot('public-forest');
    check('1 public forest page renders saved layout', await B.bodyHas('소년이 온다') || (await B.evaluate(`!!document.querySelector('[aria-label="소년이 온다"]')`)));
  }

  const real = (list) => list.filter((e) => !e.startsWith('[dialog]'));
  report.dialogs = [...A.errors, ...B.errors].filter((e) => e.startsWith('[dialog]'));
  note(`confirm dialogs accepted: ${report.dialogs.length}`);
  report.errors = { A: real(A.errors), B: real(B.errors), failedA: A.failed, failedB: B.failed };
  check('zero console errors', report.errors.A.length === 0 && report.errors.B.length === 0, JSON.stringify(report.errors).slice(0, 800));
} catch (err) {
  console.error(err);
  report.crash = String(err?.stack ?? err);
  report.errors = { A: A.errors, B: B.errors };
} finally {
  writeFileSync(`${OUT}\\report.json`, JSON.stringify(report, null, 2));
  const fails = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n${Object.keys(report.checks).length - fails.length}/${Object.keys(report.checks).length} PASS${fails.length ? ' — FAIL: ' + fails.join(' | ') : ''}`);
  A.close();
  B.close();
}
