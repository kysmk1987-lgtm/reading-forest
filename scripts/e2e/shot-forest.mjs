// Clean "transplant in progress" screenshot: a tree lifted, empty tiles highlighted.
import { openBrowser, sleep } from './cdp.mjs';
const BASE = process.argv[2] ?? 'http://localhost:8130';
const P = await openBrowser('F', { base: BASE, out: `${process.env.TEMP}\\rf-e2e\\s6-local` });
const now = Date.now();
const e = (id, t, sp, status = 'read') => ({ id, book: { id: 'b' + id, source: 'kakao', title: t, authors: ['x'] }, status, createdAt: now - id.charCodeAt(0) * 1e5, updatedAt: now, treeSpecies: sp, ...(status === 'reading' ? { progressUnit: 'percent', currentPercent: 70 } : {}) });
const entries = Object.fromEntries([e('a', '소년이 온다', 'ginkgo'), e('b', '모순', 'birch'), e('c', '흰', 'palm'), e('d', '급류', 'magnolia', 'reading'), e('f', '아몬드', 'cherry'), e('g', '파과', 'maple')].map((x) => [x.id, x]));
await P.visit('/', 2000);
await P.evaluate(`localStorage.setItem('rf-library', JSON.stringify({ state: { entries: ${JSON.stringify(entries)}, logs: [] }, version: 1 }));
  localStorage.setItem('rf-entitlements', JSON.stringify({ state: { isPremium: true }, version: 0 }));`);
await P.visit('/', 4500);
await P.clickText('🪴 옮겨 심기');
await P.clickText('➕ 땅 넓히기');
await sleep(3500);
const r = await P.evaluate(`(() => { const b = document.querySelector('[aria-label="흰"]').getBoundingClientRect(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; })()`);
await P.clickAt(r);
await sleep(600);
await P.shot('forest-transplant-3');
P.close();
