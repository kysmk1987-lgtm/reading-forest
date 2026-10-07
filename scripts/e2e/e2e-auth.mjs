// Login gate E2E against the mock Supabase: gate redirect, inline validation, sign-up, logout, remember email,
// 자동 로그인 off, password reset mail, anonymous data carry-over and account switching.
// Usage: node e2e-auth.mjs http://localhost:8105 http://localhost:54329
import { writeFileSync } from 'node:fs';
import { openBrowser, SESSION_JS, sleep } from './cdp.mjs';

const BASE = process.argv[2] ?? 'http://localhost:8105';
const SB = process.argv[3] ?? 'http://localhost:54329';
const OUT = `${process.env.TEMP}\\rf-e2e\\auth`;
const report = { checks: {} };
const check = (k, v, extra) => { report.checks[k] = !!v; console.log(`${v ? 'PASS' : 'FAIL'} ${k}${extra ? ' ' + extra : ''}`); };
const stamp = Date.now().toString(36);
const A = { email: `a${stamp}@forest.kr`, nickname: '도토리숲', password: 'forest2026' };
const B = { email: `b${stamp}@forest.kr`, nickname: '솔방울숲', password: 'pinecone77' };

// Headless Edge can stop answering input on a new-password field after earlier login submits in the same
// profile, so the sign-up / account phase runs in a second, fresh browser.
// Deliberate failures: wrong password (400), the second reset mail within 60 s (429), duplicate sign-up (422).
const ignore = [/auth\/v1\/token\?grant_type=password/, /429 .*auth\/v1\/recover/, /422 .*auth\/v1\/signup/];
let P = await openBrowser('auth', { base: BASE, out: OUT, ignore });
const fill = async (placeholder, text) => {
  // Clear through the native setter so React sees the change, then type like a user.
  await P.evaluate(`(() => {
    const i = [...document.querySelectorAll('input')].filter(i => i.placeholder === ${JSON.stringify(placeholder)} && i.offsetParent !== null).pop();
    if (!i.value) return true;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await P.typeInto(placeholder, text);
};
const signUp = async (u) => {
  await P.visit('/signup', 4000);
  await fill('example@email.com', u.email);
  await fill('숲에서 불릴 이름 (2~16자)', u.nickname);
  await fill('영문 + 숫자 8자 이상', u.password);
  await fill('비밀번호를 한 번 더 입력해 주세요', u.password);
  await P.clickLabel('전체 동의');
  await P.clickText('가입하기', 'last');
};
const signIn = async (u) => {
  await fill('example@email.com', u.email);
  await fill('비밀번호를 입력해 주세요', u.password);
  await P.clickText('로그인', 'last');
};
const library = () => P.evaluate(`Object.values(JSON.parse(localStorage.getItem('rf-library') || '{"state":{"entries":{}}}').state.entries).map(e => e.book.title)`);
const inApp = () =>
  P.waitUntil(
    `!['/login', '/signup', '/forgot-password'].includes(location.pathname) && !document.body.innerText.includes('비밀번호 찾기') && !document.body.innerText.includes('가입하기')`,
    10000,
  );
const signOut = async () => {
  await P.visit('/my', 4000);
  await P.clickText('로그아웃', 'last');
  return P.waitFor('비밀번호 찾기', 8000);
};

try {
  // 1. Gate: every protected route lands on the login screen.
  await P.visit('/', 6000);
  check(
    'gate: / shows login with round kakao / google buttons',
    (await P.waitFor('비밀번호 찾기', 10000)) &&
      (await P.evaluate(`!!document.querySelector('[aria-label="카카오로 시작하기"]') && !!document.querySelector('[aria-label="구글로 시작하기"]')`)) &&
      !(await P.bodyHas('카카오로 시작하기')),
  );
  // Tagline sits under the logo, the 로그인 heading above the card (both before the e-mail label).
  const order = await P.evaluate(`(() => { const t = document.body.innerText; return [t.indexOf('책을 읽을수록 나만의 숲이 자라요'), t.indexOf('로그인'), t.indexOf('이메일')]; })()`);
  check('login: tagline → heading → form order', order[0] >= 0 && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
  await P.shot('01-login');
  await P.visit('/library', 4000);
  check('gate: /library shows login', await P.waitFor('아이디(이메일) 저장', 8000));
  check('bundle uses the mock Supabase', !(await P.evaluate(`performance.getEntriesByType('resource').some(r => r.name.includes('supabase.co'))`)));

  // 2. Inline validation + server errors.
  await P.clickText('로그인', 'last');
  check('login: empty → inline errors', (await P.waitFor('이메일을 입력해 주세요', 3000)) && (await P.bodyHas('비밀번호를 입력해 주세요')));
  await fill('example@email.com', 'not-an-email');
  await fill('비밀번호를 입력해 주세요', 'whatever1');
  await P.clickText('로그인', 'last');
  check('login: bad email format', await P.waitFor('이메일 형식이 올바르지 않아요', 3000));
  await signIn({ email: 'nobody@forest.kr', password: 'wrong1234' });
  check('login: wrong credentials message', await P.waitFor('이메일 또는 비밀번호가 맞지 않아요', 6000));
  await P.clickLabel('카카오로 시작하기');
  check('kakao (provider off) → friendly error', await P.waitFor('카카오 로그인은 준비 중이에요', 6000));
  await P.shot('02-login-errors');

  // 3. Password visibility toggle.
  const typeBefore = await P.evaluate(`[...document.querySelectorAll('input')].find(i => i.placeholder === '비밀번호를 입력해 주세요').type`);
  await P.clickLabel('비밀번호 보기');
  const typeAfter = await P.evaluate(`[...document.querySelectorAll('input')].find(i => i.placeholder === '비밀번호를 입력해 주세요').type`);
  check('password show/hide toggle', typeBefore === 'password' && typeAfter === 'text', `${typeBefore}→${typeAfter}`);

  // 4. Forgot password.
  await P.clickText('비밀번호 찾기', 'last');
  await sleep(1500);
  await fill('example@email.com', A.email);
  await P.clickText('재설정 메일 보내기', 'last');
  check('forgot password → mail sent state', await P.waitFor('메일을 확인해 주세요', 6000));
  check('forgot password: 1-hour expiry + resend countdown', (await P.bodyHas('1시간 동안')) && (await P.waitFor('초 후에 다시 보낼 수 있어요', 3000)));
  await P.shot('02b-forgot-sent');
  // A reload forgets the on-screen timer; the server's per-address guard answers 429 → countdown message.
  await P.visit(`/forgot-password?email=${encodeURIComponent(A.email)}`, 4000);
  await P.clickText('재설정 메일 보내기', 'last');
  check('forgot password: server 60s guard → "1분에 한 번" + countdown', (await P.waitFor('1분에 한 번만', 6000)) && (await P.bodyHas('초 후에 다시 보낼 수 있어요')));
  await P.shot('02c-forgot-limit');

  // 5. Sign-up validation.
  const firstErrors = P.errors.filter((e) => !e.startsWith('[dialog]'));
  P.close();
  P = await openBrowser('auth2', { base: BASE, out: OUT, ignore });
  P.errors.push(...firstErrors);
  await P.visit('/signup', 4000);
  await P.clickText('가입하기', 'last');
  check(
    'signup: empty → inline errors',
    (await P.waitFor('이메일을 입력해 주세요', 3000)) && (await P.bodyHas('닉네임을 입력해 주세요')) && (await P.bodyHas('서비스 이용약관에 동의해 주세요')),
  );
  await fill('example@email.com', 'bad@');
  await fill('숲에서 불릴 이름 (2~16자)', '숲');
  await fill('영문 + 숫자 8자 이상', 'abcdefgh');
  await fill('비밀번호를 한 번 더 입력해 주세요', 'abcdefgX');
  await sleep(300);
  check(
    'signup: field rule errors',
    (await P.bodyHas('이메일 형식이 올바르지 않아요')) &&
      (await P.bodyHas('닉네임은 2~16자로 입력해 주세요')) &&
      (await P.bodyHas('영문과 숫자를 함께 넣어주세요')) &&
      (await P.bodyHas('비밀번호가 일치하지 않아요')),
  );
  await P.clickText('보기', 'first');
  check('signup: terms draft viewer', await P.waitFor('서비스 이용약관 (초안)', 3000));
  await P.shot('03-terms');
  await P.clickText('✕', 'last');
  await sleep(800);
  check('signup: terms viewer closes', !(await P.bodyHas('제1조 (목적)')));
  await P.fullShot('04-signup-errors');

  // 6. Existing anonymous session + local records → sign-up carries the records over.
  const anon = await (await fetch(`${SB}/auth/v1/signup`, { method: 'POST', body: '{}' })).json();
  const now = Date.now();
  const entry = { id: 'anon1', book: { id: 'kr_9788936434120', source: 'kakao', title: '익명때읽던책', authors: ['작가'], isbn13: '9788936434120', pageCount: 200 }, status: 'reading', createdAt: now, updatedAt: now, progressUnit: 'page', currentPage: 20 };
  // Device A's guest data also has forest decor, settings and a forest name / avatar (all must follow the account).
  const seed = {
    'sb-localhost-auth-token': anon,
    'rf-library': { state: { entries: { anon1: entry }, logs: [] }, version: 2 },
    'rf-forest': { state: { localForestId: 'local-e2e', publishedSlug: null, weather: 'snow', waterings: {}, critters: ['butterfly', 'ladybug'], gardenExtra: 2 }, version: 2 },
    'rf-settings': { state: { language: null, soundEnabled: false, blurUnownedQuotes: true, reviewVisibility: 'private' }, version: 1 },
    'rf-profile': { state: { nickname: '새싹 독서가', forestName: '도토리의 숲', avatar: 'bun', authMode: 'guest', uid: null, email: null, photoURL: null, dataOwner: null }, version: 1 },
  };
  await P.evaluate(`(() => { const s = ${JSON.stringify(seed)}; for (const k in s) localStorage.setItem(k, JSON.stringify(s[k])); return true; })()`);
  await P.visit('/', 6000);
  check('anonymous session → still gated, no carry-over notice', (await P.waitFor('비밀번호 찾기', 8000)) && !(await P.bodyHas('익명으로 쓰던 기록이 있어요')));
  await signUp(A);
  check('signup → main tabs', await inApp());
  await sleep(2500);
  check('anonymous records carried into the new account', (await library()).includes('익명때읽던책'), JSON.stringify(await library()));
  await P.visit('/my', 5000);
  check('my: email account label, no login card', (await P.waitFor(`이메일 계정 · ${A.email}`, 6000)) && !(await P.bodyHas('로그인하고 기록 지키기')) && !(await P.bodyHas('익명 계정')));
  check('my: signup nickname applied', await P.bodyHas(A.nickname));
  await P.shot('06-my');

  // 7. Logout → login; remember email; 자동 로그인 off.
  check('logout → login screen', await signOut());
  await P.clickLabel('아이디(이메일) 저장');
  await P.clickLabel('자동 로그인');
  await signIn(A);
  check('login → main tabs', await inApp());
  await P.visit('/', 5000);
  check('자동 로그인 off: same tab reload stays signed in', !(await P.bodyHas('비밀번호 찾기')));
  await P.evaluate(`sessionStorage.clear(); true`);
  await P.visit('/', 6000);
  check('자동 로그인 off: new session → login screen', await P.waitFor('비밀번호 찾기', 8000));
  const prefilled = await P.evaluate(`[...document.querySelectorAll('input')].find(i => i.placeholder === 'example@email.com')?.value`);
  check('아이디 저장: email prefilled', prefilled === A.email, prefilled);

  // 8. Account switch: A's local copy must not leak into B; A's records come back from the server.
  await signUp(B);
  check('signup B → main tabs', await inApp());
  await sleep(2500);
  check('account switch: A records not in B', !(await library()).includes('익명때읽던책'), JSON.stringify(await library()));
  check('logout B', await signOut());
  await P.clickLabel('자동 로그인');
  await signIn(A);
  await inApp();
  const back = await P.waitUntil(`Object.values(JSON.parse(localStorage.getItem('rf-library') || '{"state":{"entries":{}}}').state.entries).some(e => e.book.title === '익명때읽던책')`, 10000);
  check('re-login A → records pulled back from server', back);
  check('re-login A → forest decor back after B reset it', await P.waitUntil(`JSON.parse(localStorage.getItem('rf-forest')).state.weather === 'snow'`, 8000));

  // 9. "Device A" publishes its forest and makes a gallery card (straight through the API with A's token).
  const sessionA = await P.evaluate(SESSION_JS);
  const rest = (path, init = {}) =>
    fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { authorization: `Bearer ${sessionA.access_token}`, apikey: 'x', 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const forestRes = await rest('forests?select=share_slug', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify({ owner_id: sessionA.user.id, nickname: A.nickname, is_public: true }) });
  const slug = (await forestRes.json())[0]?.share_slug;
  const cardId = crypto.randomUUID();
  await rest('quote_cards', {
    method: 'POST',
    body: JSON.stringify({ id: cardId, book_title: '익명때읽던책', quote: '숲은 천천히 자란다', image_path: `${sessionA.user.id}/c.png`, blur_path: `${sessionA.user.id}/b.jpg`, progress_percent: 10 }),
  });
  const firstErrors2 = P.errors.filter((e) => !e.startsWith('[dialog]'));
  P.close();

  // 10. "Device B": a fresh browser profile signs in to A → everything synced comes down.
  P = await openBrowser('auth-deviceB', { base: BASE, out: OUT, ignore });
  P.errors.push(...firstErrors2);
  await P.visit('/login', 5000);
  await signIn(A);
  check('device B: login → main tabs', await inApp());
  const stateOf = (key) => `JSON.parse(localStorage.getItem('${key}') || '{"state":{}}').state`;
  check('device B: library + reading logs', await P.waitUntil(`Object.values(${stateOf('rf-library')}.entries || {}).some(e => e.book.title === '익명때읽던책' && e.currentPage === 20) && ${stateOf('rf-library')}.logs.length > 0`, 10000));
  check('device B: forest decor (weather · critters · land)', await P.waitUntil(`(() => { const f = ${stateOf('rf-forest')}; return f.weather === 'snow' && f.critters.join() === 'butterfly,ladybug' && f.gardenExtra === 2; })()`, 8000));
  check('device B: share slug of the published forest', !!slug && (await P.waitUntil(`${stateOf('rf-forest')}.publishedSlug === ${JSON.stringify(slug)}`, 8000)));
  check('device B: settings (sound · blur · review visibility)', await P.waitUntil(`(() => { const s = ${stateOf('rf-settings')}; return s.soundEnabled === false && s.blurUnownedQuotes === true && s.reviewVisibility === 'private'; })()`, 8000));
  check('device B: profile nickname · forest name · avatar', await P.waitUntil(`(() => { const p = ${stateOf('rf-profile')}; return p.nickname === ${JSON.stringify(A.nickname)} && p.forestName === '도토리의 숲' && p.avatar === 'bun'; })()`, 8000));
  check('device B: gallery card counted in 만든 카드', await P.waitUntil(`(${stateOf('rf-cards')}.made || []).some(c => c.galleryId === '${cardId}')`, 8000));
  await P.visit('/', 5000);
  check('device B: forest name shown on the home forest', await P.waitFor('도토리의 숲', 6000));
  await P.shot('07-deviceB-forest');

  // 11. A deletes the book on "device A" → device B drops it on its next sync instead of uploading it again.
  await rest('user_books?id=eq.anon1', { method: 'DELETE' });
  await P.visit('/library', 6000);
  check('device B: book deleted on device A disappears', await P.waitUntil(`!Object.values(${stateOf('rf-library')}.entries || {}).some(e => e.id === 'anon1')`, 8000));
  const remoteRows = await (await rest('user_books?select=id')).json();
  check('device B: deleted book not re-uploaded', Array.isArray(remoteRows) && !remoteRows.some((r) => r.id === 'anon1'), JSON.stringify(remoteRows));

  // 12. Duplicate sign-up with A's address → "이미 가입된 이메일" + links; confirmation link → login + notice.
  check('device B: logout', await signOut());
  await signUp(A);
  check('duplicate sign-up → 이미 가입된 이메일', await P.waitFor('이미 가입된 이메일이에요', 6000));
  check('duplicate sign-up → 로그인하기 / 비밀번호 찾기 links', (await P.bodyHas('로그인하기')) && (await P.bodyHas('비밀번호 찾기')));
  await P.shot('08-duplicate-signup');
  await P.clickText('로그인하기', 'last');
  check('duplicate sign-up → login prefilled', await P.waitUntil(`[...document.querySelectorAll('input')].some(i => i.placeholder === 'example@email.com' && i.value === ${JSON.stringify(A.email)})`, 5000));
  await P.visit('/auth/confirmed', 6000);
  check('confirmation link → login screen with 인증 완료 notice', (await P.waitFor('이메일 인증이 완료되었어요', 8000)) && (await P.bodyHas('비밀번호 찾기')));
  await P.shot('09-confirmed');
  await P.visit('/auth/confirmed?error=access_denied&error_code=otp_expired', 6000);
  check('expired confirmation link → explains + login', await P.waitFor('인증 링크가 만료됐거나', 8000));

  report.errors = P.errors.filter((e) => !e.startsWith('[dialog]'));
  report.failed = P.failed;
  check('zero console errors', report.errors.length === 0, JSON.stringify(report.errors).slice(0, 800));
} catch (err) {
  console.error(err);
  report.crash = String(err?.stack ?? err);
  report.errors = P.errors;
  await P.shot('crash').catch(() => {});
} finally {
  writeFileSync(`${OUT}\\report.json`, JSON.stringify(report, null, 2));
  const fails = Object.entries(report.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`\n${Object.keys(report.checks).length - fails.length}/${Object.keys(report.checks).length} PASS${fails.length ? ' — FAIL: ' + fails.join(' | ') : ''}`);
  P.close();
}
