// Local Supabase stand-in for e2e: PGlite running the real migrations (RLS enforced via roles) behind a
// small subset of GoTrue / PostgREST / Storage / Realtime. Usage: node mock-sb.mjs [port]
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../package.json', import.meta.url));
const WS = require('ws');
const WebSocketServer = WS.WebSocketServer ?? WS.Server;

const PORT = Number(process.argv[2] ?? 54321);
const repo = new URL('../../supabase/migrations/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}', is_anonymous boolean default true);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
`);
for (const f of ['0001_init.sql', '0002_focus_minutes.sql', '0003_gallery.sql', '0004_garden_reviews.sql', '0005_profile_forest_avatar.sql', '0006_garden_unlimited.sql']) {
  await db.exec(readFileSync(repo + f, 'utf8'));
  console.log('applied', f);
}

const log = [];
const note = (s) => { log.push(`${new Date().toISOString().slice(11, 19)} ${s}`); };
process.on('SIGINT', () => process.exit(0));
mkdirSync(`${process.env.TEMP}\\rf-e2e`, { recursive: true });
setInterval(() => writeFileSync(`${process.env.TEMP}\\rf-e2e\\mock-sb.log`, log.join('\n')), 2000).unref();

// ---------- auth ----------
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(claims)}.c2ln`;
const sessions = new Map(); // refresh → uid
// Email accounts (auto-confirmed unless MOCK_CONFIRM_EMAIL=1, then password login answers email_not_confirmed).
const emailUsers = new Map(); // email → { id, password, meta, confirmed }
const emailById = (uid) => [...emailUsers.entries()].find(([, u]) => u.id === uid);
function decode(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); } catch { return null; }
}
function userJson(uid) {
  const found = emailById(uid);
  const now = new Date().toISOString();
  if (found) {
    const [email, u] = found;
    return { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: false, email, phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta, identities: [{ id: uid, provider: 'email' }], created_at: now, updated_at: now };
  }
  return { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: true, email: '', phone: '', app_metadata: { provider: 'anonymous', providers: ['anonymous'] }, user_metadata: {}, identities: [], created_at: now, updated_at: now };
}
function session(uid) {
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomUUID();
  sessions.set(refresh, uid);
  const user = userJson(uid);
  return { access_token: jwt({ sub: uid, role: 'authenticated', aud: 'authenticated', is_anonymous: user.is_anonymous, exp: now + 3600, iat: now, session_id: refresh }), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user };
}

// ---------- SQL helpers ----------
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw httpErr(400, 'PGRST100', `bad identifier ${s}`); return `"${s}"`; };
function httpErr(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
let queue = Promise.resolve();
function asUser(uid, fn) {
  const run = queue.then(() =>
    db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
      await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
      return fn(tx);
    }),
  );
  queue = run.catch(() => {});
  return run;
}
function pgStatus(e) {
  if (e.status) return e.status;
  const c = e.code ?? '';
  if (c === '23505') return 409;
  if (c === '42501') return 403;
  if (c === '42883' || c === '42P01') return 404;
  return 400;
}

function whereClause(params, args) {
  const parts = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const col = ident(k);
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/s.exec(v);
    if (!m) throw httpErr(400, 'PGRST100', `bad filter ${k}=${v}`);
    const [, not, op, raw] = m;
    let sql;
    if (op === 'is') sql = `${col} is ${raw === 'null' ? 'null' : raw === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      args.push(raw.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')));
      sql = `${col}::text = any($${args.length}::text[])`;
    } else if (op === 'eq' || op === 'neq') {
      args.push(raw);
      sql = `${col}::text ${op === 'eq' ? '=' : '<>'} $${args.length}`;
    } else {
      args.push(raw);
      const sym = { gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      sql = `${col} ${sym} $${args.length}`;
    }
    parts.push(not ? `not (${sql})` : sql);
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}
function selectList(sel) {
  if (!sel || sel === '*') return '*';
  return sel.split(',').map((c) => ident(c.trim().split(':')[0])).join(', ');
}
function orderClause(order) {
  if (!order) return '';
  return ' order by ' + order.split(',').map((o) => {
    const [c, ...mods] = o.split('.');
    return `${ident(c)} ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''}`;
  }).join(', ');
}

async function rest(req, url, uid, body) {
  const path = url.pathname.replace(/^\/rest\/v1\//, '');
  const prefer = req.headers.prefer ?? '';
  const wantObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const params = url.searchParams;
  if (path.startsWith('rpc/')) {
    const fn = path.slice(4);
    ident(fn);
    const argsObj = body ? JSON.parse(body) : {};
    return asUser(uid, async (tx) => {
      const info = (await tx.query(`select proretset, prorettype::regtype::text as rt from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [fn])).rows[0];
      if (!info) throw Object.assign(httpErr(404, 'PGRST202', `Could not find the function public.${fn}`), {});
      const keys = Object.keys(argsObj);
      const args = keys.map((k) => (argsObj[k] !== null && typeof argsObj[k] === 'object' ? JSON.stringify(argsObj[k]) : argsObj[k]));
      const call = `public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')})`;
      if (info.proretset) {
        const r = await tx.query(`select coalesce(json_agg(x), '[]'::json) as j from (select * from ${call}) x`, args);
        return { status: 200, json: r.rows[0].j };
      }
      const r = await tx.query(`select to_json(${call}) as j`, args);
      return { status: 200, json: r.rows[0].j };
    });
  }
  const table = ident(path);
  return asUser(uid, async (tx) => {
    const args = [];
    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = whereClause(params, args);
      let sql = `select ${selectList(params.get('select'))} from public.${table}${where}${orderClause(params.get('order'))}`;
      if (params.get('limit')) sql += ` limit ${Number(params.get('limit'))}`;
      if (params.get('offset')) sql += ` offset ${Number(params.get('offset'))}`;
      const r = await tx.query(`select coalesce(json_agg(x), '[]'::json) as j from (${sql}) x`, args);
      const rows = r.rows[0].j;
      if (wantObject) {
        if (rows.length !== 1) throw httpErr(406, 'PGRST116', `JSON object requested, multiple (or no) rows returned`);
        return { status: 200, json: rows[0] };
      }
      return { status: 200, json: rows, range: `0-${Math.max(0, rows.length - 1)}/${rows.length}` };
    }
    const returning = prefer.includes('return=representation');
    if (req.method === 'POST') {
      const data = JSON.parse(body);
      const rows = Array.isArray(data) ? data : [data];
      if (!rows.length) return { status: 201, json: [] };
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      cols.forEach(ident);
      args.push(JSON.stringify(rows));
      let sql = `insert into public.${table} (${cols.map(ident).join(', ')}) select ${cols.map(ident).join(', ')} from json_populate_recordset(null::public.${table}, $1)`;
      const merge = prefer.includes('resolution=merge-duplicates');
      const ignore = prefer.includes('resolution=ignore-duplicates');
      if (merge || ignore) {
        let conflict = params.get('on_conflict');
        if (!conflict) {
          const pk = await tx.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = 'public.${path}'::regclass and i.indisprimary`);
          conflict = pk.rows.map((r) => r.attname).join(',');
        }
        const ccols = conflict.split(',').map((c) => ident(c.trim()));
        const upd = cols.filter((c) => !conflict.split(',').includes(c));
        sql += ignore || !upd.length ? ` on conflict (${ccols.join(', ')}) do nothing` : ` on conflict (${ccols.join(', ')}) do update set ${upd.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`;
      }
      if (returning) {
        const r = await tx.query(`with ins as (${sql} returning *) select coalesce(json_agg(ins), '[]'::json) as j from ins`, args);
        return { status: 201, json: wantObject ? r.rows[0].j[0] : r.rows[0].j };
      }
      await tx.query(sql, args);
      return { status: 201, json: null };
    }
    if (req.method === 'PATCH') {
      const data = JSON.parse(body);
      const cols = Object.keys(data);
      args.push(JSON.stringify(data));
      const where = whereClause(params, args);
      const sql = `update public.${table} t set ${cols.map((c) => `${ident(c)} = r.${ident(c)}`).join(', ')} from json_populate_record(null::public.${table}, $1) r${where.replace(' where ', ' where ').replace(/"([a-z_0-9]+)"(::text| [<>=])/g, 't."$1"$2')}`;
      if (returning) {
        const r = await tx.query(`with u as (${sql} returning t.*) select coalesce(json_agg(u), '[]'::json) as j from u`, args);
        return { status: 200, json: r.rows[0].j };
      }
      await tx.query(sql, args);
      return { status: 204, json: null };
    }
    if (req.method === 'DELETE') {
      const where = whereClause(params, args);
      await tx.query(`delete from public.${table}${where}`, args);
      return { status: 204, json: null };
    }
    throw httpErr(405, 'PGRST000', 'method');
  });
}

// ---------- storage ----------
const files = new Map(); // `${bucket}/${name}` → { bytes, type }
const signed = new Map(); // token → key
async function storage(req, url, uid, raw) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\//, ''));
  let m;
  if ((m = /^object\/sign\/([^/]+)\/(.+)$/.exec(p)) && req.method === 'POST') {
    const [, bucket, name] = m;
    const ok = await asUser(uid, (tx) => tx.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]));
    if (!ok.rows.length) throw httpErr(400, 'not_found', 'Object not found');
    const token = randomUUID();
    signed.set(token, `${bucket}/${name}`);
    note(`sign ${bucket}/${name} by ${uid?.slice(0, 8)}`);
    return { status: 200, json: { signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${token}` } };
  }
  if ((m = /^object\/sign\/([^/]+)\/(.+)$/.exec(p)) && req.method === 'GET') {
    const key = signed.get(url.searchParams.get('token'));
    if (!key || key !== `${m[1]}/${m[2]}` || !files.has(key)) throw httpErr(400, 'InvalidSignature', 'bad token');
    return { status: 200, file: files.get(key) };
  }
  if ((m = /^object\/public\/([^/]+)\/(.+)$/.exec(p))) {
    const b = (await db.query(`select public from storage.buckets where id = $1`, [m[1]])).rows[0];
    const key = `${m[1]}/${m[2]}`;
    if (!b?.public || !files.has(key)) throw httpErr(400, 'not_found', 'Object not found');
    return { status: 200, file: files.get(key) };
  }
  if ((m = /^object\/([^/]+)$/.exec(p)) && req.method === 'DELETE') {
    const { prefixes } = JSON.parse(raw.toString());
    const r = await asUser(uid, (tx) => tx.query(`delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name`, [m[1], prefixes]));
    r.rows.forEach((row) => files.delete(`${m[1]}/${row.name}`));
    return { status: 200, json: r.rows.map((row) => ({ name: row.name })) };
  }
  if ((m = /^object\/([^/]+)\/(.+)$/.exec(p)) && (req.method === 'POST' || req.method === 'PUT')) {
    const [, bucket, name] = m;
    const b = (await db.query(`select * from storage.buckets where id = $1`, [bucket])).rows[0];
    if (!b) throw httpErr(400, 'Bucket not found', 'Bucket not found');
    let bytes = raw;
    let type = req.headers['content-type'] ?? 'application/octet-stream';
    if (type.startsWith('multipart/form-data')) {
      const form = await new Request('http://x', { method: 'POST', headers: { 'content-type': type }, body: raw }).formData();
      const file = [...form.values()].find((v) => typeof v !== 'string');
      bytes = Buffer.from(await file.arrayBuffer());
      type = file.type;
    }
    if (b.file_size_limit && bytes.length > Number(b.file_size_limit)) throw httpErr(413, 'Payload too large', 'too large');
    if (b.allowed_mime_types && !b.allowed_mime_types.includes(type)) throw httpErr(415, 'invalid_mime_type', `mime ${type}`);
    await asUser(uid, (tx) => tx.query(`insert into storage.objects (bucket_id, name, owner) values ($1, $2, auth.uid())`, [bucket, name]));
    files.set(`${bucket}/${name}`, { bytes, type });
    note(`upload ${bucket}/${name} ${bytes.length}B ${type}`);
    return { status: 200, json: { Key: `${bucket}/${name}`, Id: randomUUID() } };
  }
  throw httpErr(404, 'not_found', `storage route ${req.method} ${p}`);
}

// ---------- http ----------
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': 'content-range, x-total-count',
};
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const claims = decode(token);
  const uid = claims?.role === 'authenticated' ? claims.sub : null;
  try {
    let out;
    if (url.pathname.startsWith('/auth/v1/')) {
      const p = url.pathname.slice(9);
      const body = req.method === 'POST' ? JSON.parse(raw.toString() || '{}') : {};
      if (p === 'signup' && req.method === 'POST' && body.email) {
        const email = String(body.email).toLowerCase();
        if (emailUsers.has(email)) {
          out = { status: 422, json: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } };
        } else {
          const id = randomUUID();
          const confirmed = process.env.MOCK_CONFIRM_EMAIL !== '1';
          emailUsers.set(email, { id, password: body.password, meta: body.data ?? {}, confirmed });
          await db.query(`insert into auth.users (id, raw_user_meta_data, is_anonymous) values ($1, $2, false)`, [id, JSON.stringify(body.data ?? {})]);
          note(`signup email ${email} ${id} confirmed=${confirmed}`);
          out = { status: 200, json: confirmed ? session(id) : userJson(id) };
        }
      } else if (p === 'signup' && req.method === 'POST') {
        const id = randomUUID();
        await db.query(`insert into auth.users (id) values ($1)`, [id]);
        note(`signup ${id}`);
        out = { status: 200, json: session(id) };
      } else if (p === 'token' && url.searchParams.get('grant_type') === 'password') {
        const u = emailUsers.get(String(body.email ?? '').toLowerCase());
        if (!u || u.password !== body.password) out = { status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
        else if (!u.confirmed) out = { status: 400, json: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' } };
        else out = { status: 200, json: session(u.id) };
      } else if (p === 'settings') {
        out = { status: 200, json: { external: { email: true, anonymous_users: true, kakao: false, google: false }, disable_signup: false, mailer_autoconfirm: process.env.MOCK_CONFIRM_EMAIL !== '1' } };
      } else if (p === 'recover' || p === 'resend') {
        note(`${p} ${body.email}`);
        out = { status: 200, json: {} };
      } else if (p === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
        const { refresh_token } = JSON.parse(raw.toString() || '{}');
        const id = sessions.get(refresh_token);
        out = id ? { status: 200, json: session(id) } : { status: 400, json: { error: 'invalid_grant', error_description: 'Invalid Refresh Token', code: 'refresh_token_not_found' } };
      } else if (p === 'user') {
        out = uid ? { status: 200, json: session(uid).user } : { status: 401, json: { code: 401, msg: 'no user' } };
      } else if (p === 'logout') {
        out = { status: 204, json: null };
      } else {
        out = { status: 404, json: { msg: `auth route ${p}` } };
      }
    } else if (url.pathname.startsWith('/rest/v1/')) {
      out = await rest(req, url, uid, raw.toString());
      note(`${req.method} ${url.pathname}${url.search.slice(0, 80)} → ${out.status} as ${uid?.slice(0, 8) ?? 'anon'}`);
    } else if (url.pathname.startsWith('/storage/v1/')) {
      out = await storage(req, url, uid, raw);
    } else {
      out = { status: 404, json: { msg: 'unknown' } };
    }
    if (out.file) {
      res.writeHead(200, { ...cors, 'content-type': out.file.type, 'cache-control': 'no-store' });
      res.end(out.file.bytes);
      return;
    }
    const headers = { ...cors, 'content-type': 'application/json' };
    if (out.range) headers['content-range'] = out.range;
    res.writeHead(out.status, headers);
    res.end(out.json === null || out.status === 204 ? '' : JSON.stringify(out.json));
  } catch (e) {
    const status = pgStatus(e);
    note(`ERR ${req.method} ${url.pathname} ${status} ${e.code} ${e.message}`);
    res.writeHead(status, { ...cors, 'content-type': 'application/json' });
    res.end(JSON.stringify(url.pathname.startsWith('/storage') ? { statusCode: String(status), error: e.code ?? 'error', message: e.message } : { code: e.code ?? 'PGRST000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null }));
  }
});

// ---------- realtime (presence stub: acknowledges joins / heartbeats) ----------
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/realtime/v1/websocket')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      const arr = Array.isArray(msg) ? msg : [msg.join_ref ?? null, msg.ref, msg.topic, msg.event, msg.payload];
      const [joinRef, ref, topic, event] = arr;
      const reply = (payload) => ws.send(JSON.stringify(Array.isArray(msg) ? [joinRef, ref, topic, 'phx_reply', payload] : { topic, event: 'phx_reply', payload, ref, join_ref: joinRef }));
      if (event === 'phx_join') {
        reply({ status: 'ok', response: { postgres_changes: [] } });
        const ps = Array.isArray(msg) ? [joinRef, null, topic, 'presence_state', {}] : { topic, event: 'presence_state', payload: {}, ref: null, join_ref: joinRef };
        ws.send(JSON.stringify(ps));
      } else reply({ status: 'ok', response: {} });
    });
  });
});

server.listen(PORT, () => console.log(`mock supabase on http://localhost:${PORT}`));
