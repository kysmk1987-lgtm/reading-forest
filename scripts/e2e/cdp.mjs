// Shared headless Edge helpers (one browser = one independent user).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AUDIO_PROBE = `(() => {
  window.__audio = { contexts: [], starts: 0, media: [] };
  const AC = window.AudioContext;
  if (AC) window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__audio.contexts.push(this); } };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { window.__audio.starts++; return start.apply(this, a); };
  const mplay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { window.__audio.media.push((this.currentSrc || this.src).split('/').pop().split('.')[0]); return mplay.apply(this, a); };
})();`;

export async function openBrowser(name, { base, out, ignore = [] }) {
  mkdirSync(out, { recursive: true });
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = `${process.env.TEMP}\\rf-e2e\\prof-${name}-${Date.now()}`;
  // The "save password?" prompt silently blocks input after a page with a typed password unloads.
  mkdirSync(`${profile}\\Default`, { recursive: true });
  writeFileSync(`${profile}\\Default\\Preferences`, JSON.stringify({ credentials_enable_service: false, profile: { password_manager_enabled: false } }));
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--disable-features=PasswordManagerOnboarding,PasswordLeakDetection', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 60 && !targets.some((t) => t.type === 'page'); i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch {}
    await sleep(250);
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errors = []; const failed = []; const downloads = []; const listeners = [];
  const on = (method, cb) => listeners.push({ method, cb });
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); listeners.filter((l) => l.method === m.method).forEach((l) => l.cb(m.params)); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const skip = (s) => ignore.some((re) => re.test(s));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    const push = (s) => { if (!skip(s)) errors.push(s); };
    if (m.method === 'Runtime.exceptionThrown') push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 400));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') push(`[log] ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
    if (m.method === 'Network.loadingFailed' && !m.params.canceled && !skip(m.params.errorText)) failed.push(m.params.errorText);
    if (m.method === 'Page.javascriptDialogOpening') { errors.push('[dialog] ' + m.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
    if (m.method === 'Browser.downloadWillBegin') downloads.push(m.params.suggestedFilename);
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(`[${name}] eval failed: ${r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text}`);
    return r.result?.result?.value;
  };
  const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}\\${file}.png`, Buffer.from(r.result.data, 'base64')); };
  const fullShot = async (file) => {
    const h = await evaluate(`Math.max(...[...document.querySelectorAll('div')].map(d => d.scrollHeight))`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: Math.min(2400, Math.max(844, h + 120)), deviceScaleFactor: 2, mobile: true });
    await sleep(800); await shot(file);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
  };
  const visit = async (path, wait = 3500) => { await send('Page.navigate', { url: base + path }); await sleep(wait); };
  const clickAt = async ({ x, y }) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(600); };
  const rectOf = (js) => evaluate(`(() => { const el = ${js}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  const leaf = (pred) => `[...document.querySelectorAll('div,span,a,button')].filter(e => e.offsetParent !== null && (${pred})(e.textContent.trim()) && ![...e.children].some(c => (${pred})(c.textContent.trim())))`;
  const click = async (pred, which, label) => { const r = await rectOf(`${leaf(pred)}.${which === 'first' ? 'shift' : 'pop'}()`); if (!r) throw new Error(`[${name}] not found: ${label}`); await clickAt(r); };
  const clickText = (text, which) => click(`t => t === ${JSON.stringify(text)}`, which, text);
  const clickStarts = (text, which = 'first') => click(`t => t.startsWith(${JSON.stringify(text)})`, which, text);
  const clickEnds = (text, which) => click(`t => t.endsWith(${JSON.stringify(text)})`, which, text);
  const clickLabel = async (label) => { const r = await rectOf(`document.querySelector('[aria-label=${JSON.stringify(label)}]')`); if (!r) throw new Error(`[${name}] no aria-label ${label}`); await clickAt(r); };
  const bodyHas = (text) => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
  const waitFor = async (text, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await bodyHas(text)) return true; await sleep(400); } return false; };
  const waitUntil = async (expr, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await evaluate(expr).catch(() => null); if (v) return v; await sleep(400); } return null; };
  const match = (re) => evaluate(`(document.body.innerText.match(${re}) || [''])[0]`);
  const typeInto = async (placeholder, text) => {
    const r = await rectOf(`[...document.querySelectorAll('input,textarea')].filter(i => i.placeholder === ${JSON.stringify(placeholder)} && i.offsetParent !== null).pop()`);
    if (!r) throw new Error(`[${name}] input not found: ${placeholder}`);
    await clickAt(r); await send('Input.insertText', { text }); await sleep(400);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out, eventsEnabled: true }).catch(() => {});
  await send('Page.addScriptToEvaluateOnNewDocument', { source: AUDIO_PROBE });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const close = () => { ws.close(); proc.kill(); };
  return { name, on, send, evaluate, shot, fullShot, visit, clickAt, rectOf, click, clickText, clickStarts, clickEnds, clickLabel, bodyHas, waitFor, waitUntil, match, typeInto, errors, failed, downloads, close };
}

/** Reads the Supabase session the app stored in localStorage. */
export const SESSION_JS = `(() => { const k = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k)); return k ? JSON.parse(localStorage.getItem(k)) : null; })()`;
