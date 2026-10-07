// Two-browser e2e for Sprint 4/5: card maker (typing + OCR), export, upload, smart blur (RPC returns null text),
// reveal / like / scrap / comment, Wrapped sample slides + export. Usage: node e2e-gallery.mjs <base> <sbUrl> <out>
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { openBrowser, sleep, SESSION_JS } from './cdp.mjs';

const BASE = process.argv[2] ?? 'http://localhost:8130';
const SB = process.argv[3] ?? 'http://localhost:54321';
const OUT = process.argv[4] ?? `${process.env.TEMP}\\rf-e2e\\gallery-e2e`;
const report = { base: BASE, sb: SB, steps: [], checks: {} };
const log = (s) => { report.steps.push(s); console.log(s); };
const check = (k, v, extra) => { report.checks[k] = v; console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`); };
const ignore = [/\[dialog\]/];

const ISBN = '9788936434120';
const entry = (page) => ({
  id: 'e1',
  book: { id: `kr_${ISBN}`, source: 'kakao', title: '소년이 온다', authors: ['한강'], publisher: '창비', pageCount: 216, isbn13: ISBN },
  status: 'reading',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  startDate: '2026-10-01',
  progressUnit: 'page',
  currentPage: page,
});

async function setup(P, page) {
  await P.visit('/', 2500);
  await P.evaluate(`localStorage.setItem('rf-library', JSON.stringify({ state: { entries: { e1: ${JSON.stringify(entry(page))} }, logs: [] }, version: 1 }))`);
  await P.visit('/my', 3500);
  await P.click(`t => t.includes('익명으로 시작하기')`, 'first', '익명으로 시작하기');
  const s = await P.waitUntil(SESSION_JS, 15000);
  await sleep(2500);
  return s;
}
async function setText(P, placeholder, text) {
  const r = await P.rectOf(`[...document.querySelectorAll('input,textarea')].filter(i => i.placeholder === ${JSON.stringify(placeholder)} && i.offsetParent !== null).pop()`);
  if (!r) throw new Error(`input not found ${placeholder}`);
  await P.clickAt(r);
  await P.evaluate(`document.activeElement.select && document.activeElement.select()`);
  await P.send('Input.insertText', { text });
  await sleep(500);
}
async function api(token, method, path, body) {
  const r = await fetch(SB + path, { method, headers: { apikey: 'x', Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.slice(0, 200) };
}
const path = (P) => P.evaluate('location.pathname');

const A = await openBrowser('A', { base: BASE, out: OUT, ignore });
const B = await openBrowser('B', { base: BASE, out: OUT, ignore });
try {
  // ---------- A: writer at p.200 / 216 ----------
  const sA = await setup(A, 200);
  log(`A signed in ${sA?.user?.id}`);
  await A.visit('/card/new?entryId=e1', 4000);

  // OCR on a generated Korean image.
  const png = await A.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 380; const g = c.getContext('2d'); g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 1000, 380); g.fillStyle = '#1f1f1f'; g.font = '64px "Malgun Gothic", sans-serif'; g.fillText('오늘 읽은 한 줄이', 70, 150); g.fillText('내일의 나를 만든다.', 70, 270); return c.toDataURL('image/png'); })()`);
  const ocrFile = `${OUT}\\ocr-input.png`;
  writeFileSync(ocrFile, Buffer.from(png.split(',')[1], 'base64'));
  await A.send('DOM.getDocument');
  await A.send('Page.setInterceptFileChooserDialog', { enabled: true });
  A.on('Page.fileChooserOpened', (p) => { A.send('DOM.setFileInputFiles', { files: [ocrFile], backendNodeId: p.backendNodeId }); });
  await A.clickText('📷 사진에서 글자 읽기');
  const sawProgress = await A.waitUntil(`document.body.innerText.includes('중…')`, 20000);
  if (sawProgress) await A.shot('ocr-progress');
  const ocrText = await A.waitUntil(`(() => { const v = document.querySelector('textarea')?.value; return v && v.length > 3 && !document.body.innerText.includes('중…') ? v : null; })()`, 240000);
  report.ocr = { text: ocrText, progressShown: !!sawProgress };
  check('OCR recognised Korean text', !!ocrText && /읽은|한 줄|내일|만든다/.test(ocrText), JSON.stringify(ocrText));
  check('OCR text editable', await A.evaluate(`!document.querySelector('textarea').readOnly && !document.querySelector('textarea').disabled`));

  // Typing + design.
  const quote1 = '우리는 서로에게 작은 숲이 되어 줄 수 있을까. 한 문장이 오래 마음에 남는 밤이었다.';
  await setText(A, '마음에 남은 문장을 적어주세요', quote1);
  await A.clickText('숲');
  await A.clickText('나눔손글씨 펜');
  await sleep(2000);
  await A.fullShot('card-editor');
  await A.clickText('📥 이미지 저장');
  await sleep(5000);
  const pngs = readdirSync(OUT).filter((f) => f.startsWith('독서의숲-문구카드'));
  report.exported = pngs;
  check('card PNG exported (download)', pngs.length > 0 || A.downloads.length > 0, JSON.stringify({ pngs, downloads: A.downloads }));

  // Upload card 1 at p.130 (60%).
  await setText(A, '예: 120', '130');
  report.progressSummary = await A.match(/책의 \d+% 지점[^\n]*/);
  await A.click(`t => t === '🌿 갤러리에 올리기'`, 'last', 'publish');
  const id1 = await A.waitUntil(`location.pathname.startsWith('/card/') && !location.pathname.endsWith('/new') ? location.pathname.split('/').pop() : null`, 40000);
  check('card 1 uploaded', !!id1, `${id1} ${report.progressSummary}`);
  await sleep(3000);
  check('owner sees own card unblurred', (await A.bodyHas('우리는 서로에게')) && !(await A.bodyHas('아직 읽지 않은 부분이에요')));

  // Upload card 2 at 5% (visible to B).
  await A.visit('/card/new?entryId=e1', 4000);
  await setText(A, '마음에 남은 문장을 적어주세요', '첫 장을 넘기는 순간, 조용히 숲의 문이 열렸다.');
  await A.clickText('밤하늘');
  await setText(A, '예: 120', '11');
  await A.click(`t => t === '🌿 갤러리에 올리기'`, 'last', 'publish2');
  const id2 = await A.waitUntil(`location.pathname.startsWith('/card/') && !location.pathname.endsWith('/new') ? location.pathname.split('/').pop() : null`, 40000);
  check('card 2 uploaded', !!id2, id2);
  const tokenA = (await A.evaluate(SESSION_JS)).access_token;
  const ownFeed = await api(tokenA, 'POST', '/rest/v1/rpc/gallery_feed', { p_scope: 'mine' });
  const imagePath1 = ownFeed.json?.find((c) => c.id === id1)?.image_path;
  log(`A mine feed: ${ownFeed.json?.length} cards, image ${imagePath1}`);

  // ---------- B: reader at p.40 / 216 (19%) ----------
  const sB = await setup(B, 40);
  log(`B signed in ${sB?.user?.id}`);
  await B.visit('/gallery', 6000);
  await B.waitFor('아직 읽지 않은 부분이에요', 15000);
  await sleep(1500);
  await B.fullShot('gallery');
  check('B gallery shows blurred tile', await B.bodyHas('아직 읽지 않은 부분이에요'));
  const tokenB = (await B.evaluate(SESSION_JS)).access_token;
  const feedB = await api(tokenB, 'POST', '/rest/v1/rpc/gallery_feed', {});
  const c1 = feedB.json?.find((c) => c.id === id1);
  const c2 = feedB.json?.find((c) => c.id === id2);
  report.rpcB = { c1, c2: c2 && { quote: c2.quote, blurred: c2.blurred } };
  check('RPC: blurred card has null quote + null image_path', c1?.blurred === true && c1?.quote === null && c1?.image_path === null && c1?.viewer_progress < c1?.progress_percent, JSON.stringify({ blurred: c1?.blurred, quote: c1?.quote, image: c1?.image_path, vp: c1?.viewer_progress, at: c1?.progress_percent }));
  check('RPC: earlier card visible to B', c2?.blurred === false && !!c2?.quote);
  const direct = await api(tokenB, 'GET', '/rest/v1/quote_cards?select=quote');
  check('B cannot read quote_cards table directly', Array.isArray(direct.json) && direct.json.length === 0, direct.text);
  const sign = await api(tokenB, 'POST', `/storage/v1/object/sign/cards/${imagePath1}`, { expiresIn: 60 });
  check('B cannot sign the full image while blurred', sign.status >= 400, `${sign.status} ${sign.text}`);

  await B.visit(`/card/${id1}`, 5000);
  await B.waitFor('아직 읽지 않은 부분이에요', 10000);
  await sleep(1200);
  await B.shot('blur');
  check('detail blurred, quote hidden', !(await B.bodyHas('우리는 서로에게')));
  await B.clickText('👀 그래도 볼래요');
  const revealed = await B.waitFor('우리는 서로에게', 15000);
  check('reveal shows the quote', revealed);
  await sleep(2500);
  await B.shot('reveal');
  const signAfter = await api(tokenB, 'POST', `/storage/v1/object/sign/cards/${imagePath1}`, { expiresIn: 60 });
  check('after reveal B may sign the full image', signAfter.status === 200, String(signAfter.status));

  await B.clickLabel('좋아요');
  await sleep(1500);
  await B.clickLabel('스크랩');
  await sleep(1500);
  await B.typeInto('따뜻한 한마디를 남겨요', '이 문장 덕분에 다시 읽고 싶어졌어요');
  await B.clickText('등록');
  const commented = await B.waitFor('이 문장 덕분에 다시 읽고 싶어졌어요', 10000);
  check('comment posted', commented);
  await sleep(1500);
  await B.fullShot('card-detail');
  const after = (await api(tokenB, 'POST', '/rest/v1/rpc/gallery_feed', { p_card: id1 })).json?.[0];
  check('like/scrap/comment counted', after?.liked && after?.scrapped && after?.like_count === 1 && after?.scrap_count === 1 && after?.comment_count === 1 && !!after?.quote, JSON.stringify({ l: after?.like_count, s: after?.scrap_count, c: after?.comment_count }));
  const reveals = await api(tokenB, 'GET', '/rest/v1/card_reveals?select=card_id');
  check('reveal logged', reveals.json?.length === 1, reveals.text);

  await B.visit('/gallery?tab=scraps', 5000);
  check('scraps tab lists the card', await B.waitFor('소년이 온다', 8000));

  await A.visit(`/card/${id1}`, 5000);
  check('A sees B comment', await A.waitFor('이 문장 덕분에 다시 읽고 싶어졌어요', 10000));

  // ---------- Wrapped (sample, premium preview on) ----------
  await B.evaluate(`localStorage.setItem('rf-entitlements', JSON.stringify({ state: { isPremium: true }, version: 0 }))`);
  await B.visit('/wrapped?period=year&y=2026&sample=1', 4500);
  await B.shot('wrapped-intro');
  const next = () => B.clickAt({ x: 320, y: 520 });
  for (let i = 0; i < 3; i++) { await next(); await sleep(400); }
  await sleep(2200);
  report.treesText = await B.match(/올해 당신의 숲에는[\s\S]{0,30}심어졌어요/);
  await B.shot('wrapped-1');
  check('wrapped trees slide', !!report.treesText, JSON.stringify(report.treesText));
  for (let i = 0; i < 5; i++) { await next(); await sleep(400); }
  await sleep(1500);
  report.persona = await B.match(/[^\n]*들으며 읽는 '[^']+'/);
  await B.shot('wrapped-persona');
  check('wrapped persona slide', !!report.persona, report.persona);
  await next();
  await sleep(1800);
  await B.shot('wrapped-share');
  const before = readdirSync(OUT).filter((f) => f.startsWith('독서의숲-결산')).length;
  await B.clickText('📥 이미지 저장');
  await sleep(5000);
  const wrappedPngs = readdirSync(OUT).filter((f) => f.startsWith('독서의숲-결산'));
  check('wrapped summary exported', wrappedPngs.length > before, JSON.stringify(wrappedPngs));
  await B.clickText('1:1');
  await sleep(800);
  await B.shot('wrapped-share-square');

  await B.visit('/wrapped?period=year&y=2024', 4000);
  check('wrapped empty state + sample button', (await B.bodyHas('기록이 아직 없어요')) && (await B.bodyHas('체험용 샘플 리포트')));
  await B.shot('wrapped-empty');
  await A.visit('/records', 4000);
  check('records banner', await A.bodyHas('독서 DNA 결산 리포트'));
  await A.shot('records-banner');
  await A.clickStarts('📅');
  await sleep(4000);
  check('real monthly report opens', !(await A.bodyHas('기록이 아직 없어요')) && (await A.bodyHas('독서 DNA')), await A.evaluate('location.search'));
  await A.shot('wrapped-real');
  await A.visit('/', 4000);
  check('home gallery section', await A.bodyHas('카드 만들기'));
  await A.fullShot('home');
} catch (err) {
  report.failed = err.message;
  console.log('FAILED', err.message);
  await A.shot('failure-A').catch(() => {});
  await B.shot('failure-B').catch(() => {});
} finally {
  report.errorsA = A.errors; report.errorsB = B.errors; report.failedA = A.failed; report.failedB = B.failed;
  console.log('errors A', JSON.stringify(A.errors), 'B', JSON.stringify(B.errors));
  console.log('failed A', JSON.stringify(A.failed), 'B', JSON.stringify(B.failed));
  writeFileSync(`${OUT}\\report.json`, JSON.stringify(report, null, 1), 'utf8');
  A.close(); B.close();
  process.exit(0);
}
