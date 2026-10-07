// Login gate E2E against the mock Supabase: gate redirect, inline validation, sign-up, logout, remember email,
// 자동 로그인 off, password reset mail, anonymous data carry-over and account switching.
// Usage: node e2e-auth.mjs http://localhost:8105 http://localhost:54329
import { writeFileSync } from 'node:fs';
import { openBrowser, sleep } from './cdp.mjs';

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
// The wrong-password attempt is deliberate: its 400 is expected.
const ignore = [/auth\/v1\/token\?grant_type=password/];
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
  check('gate: / shows login', (await P.waitFor('비밀번호 찾기', 10000)) && (await P.bodyHas('카카오로 시작하기')) && (await P.bodyHas('구글로 시작하기')));
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
  await P.clickText('카카오로 시작하기', 'last');
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
  await P.evaluate(`localStorage.setItem('sb-localhost-auth-token', ${JSON.stringify(JSON.stringify(anon))}); localStorage.setItem('rf-library', ${JSON.stringify(JSON.stringify({ state: { entries: { anon1: entry }, logs: [] }, version: 2 }))}); true`);
  await P.visit('/', 6000);
  check('anonymous session → still gated, carry-over notice', (await P.waitFor('익명으로 쓰던 기록이 있어요', 8000)) && (await P.bodyHas('비밀번호 찾기')));
  await P.shot('05-anonymous-notice');
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
