'use strict';

// Habitbook server: serves the PWA and a small JSON API for accounts, sync and
// Apple Health imports. No dependencies; data lives in JSON files under DATA_DIR.

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { promisify } = require('node:util');
const { mergeStates } = require('../public/merge.js');

const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 80;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const ALLOW_SIGNUPS = /^(1|true|yes|on)$/i.test(process.env.ALLOW_SIGNUPS || '');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STATE_DIR = path.join(DATA_DIR, 'states');
const MAX_BODY = 8 * 1024 * 1024;
const SESSION_TTL = 180 * 24 * 3600 * 1000;
const LB = 0.45359237;
const STONE = 6.35029318;

fs.mkdirSync(STATE_DIR, { recursive: true });

/* ---------------- persistence ---------------- */

let db = { users: [], sessions: [] };
try {
  db = { users: [], sessions: [], ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

// All writes go through one queue and land atomically (write temp file, then rename).
let writes = Promise.resolve();
function writeJson(file, data) {
  const body = JSON.stringify(data);
  writes = writes
    .then(async () => {
      const tmp = `${file}.tmp`;
      await fsp.writeFile(tmp, body);
      await fsp.rename(tmp, file);
    })
    .catch((e) => console.error('Write failed:', file, e));
  return writes;
}
const saveDb = () => writeJson(DB_FILE, db);

const newId = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const stateFile = (id) => path.join(STATE_DIR, `${id}.json`);
const blankRecord = () => ({ epoch: newId(), state: { version: 2, months: {}, days: {}, journal: [] } });

// Each user's book: { epoch, state }. The epoch changes when the book is erased, which tells
// other devices to replace their copy instead of merging it back in.
const records = new Map();
async function getRecord(userId) {
  if (records.has(userId)) return records.get(userId);
  let rec;
  try {
    rec = JSON.parse(await fsp.readFile(stateFile(userId), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    rec = blankRecord();
  }
  records.set(userId, rec);
  return rec;
}
function saveRecord(userId, rec) {
  records.set(userId, rec);
  return writeJson(stateFile(userId), rec);
}

/* ---------------- auth ---------------- */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await scrypt(password, salt, 64);
  return { salt, hash: key.toString('hex') };
}

async function checkPassword(user, password) {
  const key = await scrypt(password, user.salt, 64);
  const want = Buffer.from(user.hash, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

const publicUser = (u) => ({ id: u.id, username: u.username, admin: !!u.admin, hasApiKey: !!u.apiKeyHash });
const normName = (s) => String(s || '').trim().toLowerCase();

function validate(username, password) {
  if (!/^[a-z0-9._-]{2,32}$/.test(username)) return 'Usernames are 2–32 characters: letters, numbers, dots, dashes or underscores.';
  if (typeof password !== 'string' || password.length < 8) return 'Passwords need at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  return null;
}

function createSession(user) {
  const token = newId(32);
  const now = Date.now();
  db.sessions.push({ hash: sha256(token), userId: user.id, created: now, seen: now });
  return token;
}

// Session tokens authenticate the app. `hb_` API keys only authenticate Apple Health imports.
function authenticate(req, { allowApiKey = false } = {}) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  if (!m) return null;
  const hash = sha256(m[1]);
  if (m[1].startsWith('hb_')) {
    return allowApiKey ? db.users.find((u) => u.apiKeyHash === hash) || null : null;
  }
  const session = db.sessions.find((s) => s.hash === hash);
  if (!session) return null;
  const now = Date.now();
  if (now - session.seen > SESSION_TTL) {
    db.sessions = db.sessions.filter((s) => s !== session);
    saveDb();
    return null;
  }
  if (now - session.seen > 24 * 3600 * 1000) {
    session.seen = now;
    saveDb();
  }
  req.sessionHash = hash;
  return db.users.find((u) => u.id === session.userId) || null;
}

// Lock a username for 15 minutes after 10 failed sign-ins.
const failures = new Map();
function isLocked(name) {
  const f = failures.get(name);
  return !!f && f.count >= 10 && Date.now() < f.until;
}
function recordFailure(name) {
  const now = Date.now();
  const f = failures.get(name) || { count: 0, until: 0 };
  if (now > f.until) f.count = 0;
  f.count += 1;
  f.until = now + 15 * 60 * 1000;
  failures.set(name, f);
}

/* ---------------- Apple Health import ---------------- */

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function toDay(v, fallback) {
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return dayKey(d);
  }
  return fallback;
}

// Accepts minutes, hours, seconds, or text such as "7h 2m", "7 hr 2 min" or "7:02".
function sleepMinutes(b) {
  if (b.sleepMinutes != null) return toNumber(b.sleepMinutes);
  if (b.sleepHours != null) {
    const h = toNumber(b.sleepHours);
    return h == null ? null : h * 60;
  }
  if (b.sleepSeconds != null) {
    const s = toNumber(b.sleepSeconds);
    return s == null ? null : s / 60;
  }
  if (typeof b.sleep === 'number') return b.sleep < 24 ? b.sleep * 60 : b.sleep;
  if (typeof b.sleep === 'string') {
    const clock = b.sleep.match(/^\s*(\d{1,2}):(\d{2})/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const h = b.sleep.match(/(\d+(?:[.,]\d+)?)\s*h/i);
    const m = b.sleep.match(/(\d+)\s*m/i);
    if (h || m) return (h ? Number(h[1].replace(',', '.')) * 60 : 0) + (m ? Number(m[1]) : 0);
  }
  return null;
}

async function applyHealth(user, b) {
  const date = toDay(b.date, dayKey(new Date()));
  const prev = new Date(`${date}T12:00:00`);
  prev.setDate(prev.getDate() - 1);
  // Like the notebook: weight goes on today's page, sleep on the day it followed.
  const sleepDate = toDay(b.sleepDate, dayKey(prev));

  const rec = await getRecord(user.id);
  const st = rec.state;
  if (!st.days || typeof st.days !== 'object') st.days = {};
  const now = Date.now();
  const applied = {};
  const set = (k, field, value) => {
    const d = st.days[k] || (st.days[k] = { done: {} });
    d[field] = value;
    d._ts = { ...(d._ts || {}), [field]: now };
  };

  const w = toNumber(b.weight);
  if (w != null && w > 0) {
    const unit = `${b.weightUnit || b.unit || ''} ${typeof b.weight === 'string' ? b.weight : ''}`.toLowerCase();
    const kg = /lb|pound/.test(unit) ? w * LB : /\bst\b|stone/.test(unit) ? w * STONE : w;
    set(date, 'weight', Math.round(kg * 1000) / 1000);
    applied.weight = { date, kg: Math.round(kg * 10) / 10 };
  }
  const mins = sleepMinutes(b);
  if (mins != null && mins > 0 && mins < 24 * 60) {
    set(sleepDate, 'sleep', Math.round(mins));
    applied.sleep = { date: sleepDate, minutes: Math.round(mins) };
  }
  const score = toNumber(b.sleepScore ?? b.score);
  if (score != null && score >= 0 && score <= 100) {
    set(sleepDate, 'score', Math.round(score));
    applied.score = { date: sleepDate, score: Math.round(score) };
  }
  if (!Object.keys(applied).length) {
    throw new HttpError(400, 'Nothing to save. Send weight, sleepMinutes (or sleepHours) and/or sleepScore.');
  }
  await saveRecord(user.id, rec);
  return applied;
}

/* ---------------- API ---------------- */

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'That request is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch (e) {
    throw new HttpError(400, 'The request body isn’t valid JSON.');
  }
}

async function createUser(username, password, admin) {
  const err = validate(username, password);
  if (err) throw new HttpError(400, err);
  if (db.users.some((u) => u.username === username)) throw new HttpError(409, 'That username is taken.');
  const secret = await hashPassword(password);
  // Re-check after the (slow) hash in case of a simultaneous request.
  if (db.users.some((u) => u.username === username)) throw new HttpError(409, 'That username is taken.');
  const user = { id: newId(), username, admin: !!admin, created: Date.now(), ...secret };
  db.users.push(user);
  return user;
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  const method = req.method;
  const signedIn = (opts) => {
    const u = authenticate(req, opts);
    if (!u) throw new HttpError(401, 'Please sign in again.');
    return u;
  };
  const admin = () => {
    const u = signedIn();
    if (!u.admin) throw new HttpError(403, 'Only an admin can do that.');
    return u;
  };

  if (p === '/api/health' && method === 'GET') return sendJson(res, 200, { ok: true });

  if (p === '/api/status' && method === 'GET') {
    return sendJson(res, 200, { sync: true, hasUsers: db.users.length > 0, signups: ALLOW_SIGNUPS || db.users.length === 0 });
  }

  if (p === '/api/register' && method === 'POST') {
    const first = db.users.length === 0;
    if (!first && !ALLOW_SIGNUPS) throw new HttpError(403, 'Sign-ups are turned off. Ask your admin to create an account for you.');
    const b = await readJson(req);
    const user = await createUser(normName(b.username), b.password, db.users.length === 0);
    const token = createSession(user);
    await saveDb();
    return sendJson(res, 201, { token, user: publicUser(user) });
  }

  if (p === '/api/login' && method === 'POST') {
    const b = await readJson(req);
    const username = normName(b.username);
    if (isLocked(username)) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
    const user = db.users.find((u) => u.username === username);
    const ok = user ? await checkPassword(user, String(b.password || '')) : (await hashPassword('timing'), false);
    if (!ok) {
      recordFailure(username);
      throw new HttpError(401, 'Wrong username or password.');
    }
    failures.delete(username);
    const token = createSession(user);
    await saveDb();
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  if (p === '/api/logout' && method === 'POST') {
    if (authenticate(req)) {
      db.sessions = db.sessions.filter((s) => s.hash !== req.sessionHash);
      await saveDb();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/me' && method === 'GET') return sendJson(res, 200, { user: publicUser(signedIn()) });

  if (p === '/api/password' && method === 'POST') {
    const u = signedIn();
    const b = await readJson(req);
    if (!(await checkPassword(u, String(b.current || '')))) throw new HttpError(400, 'Your current password is wrong.');
    const err = validate(u.username, b.next);
    if (err) throw new HttpError(400, err);
    Object.assign(u, await hashPassword(b.next));
    db.sessions = db.sessions.filter((s) => s.userId !== u.id || s.hash === req.sessionHash);
    await saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/sync' && method === 'POST') {
    const u = signedIn();
    const b = await readJson(req);
    if (!b.state || typeof b.state !== 'object') throw new HttpError(400, 'Missing state.');
    const rec = await getRecord(u.id);
    if (b.epoch && b.epoch !== rec.epoch) return sendJson(res, 200, { reset: true, epoch: rec.epoch, state: rec.state });
    rec.state = mergeStates(rec.state, b.state);
    await saveRecord(u.id, rec);
    return sendJson(res, 200, { epoch: rec.epoch, state: rec.state });
  }

  if (p === '/api/reset' && method === 'POST') {
    const u = signedIn();
    const rec = blankRecord();
    await saveRecord(u.id, rec);
    return sendJson(res, 200, { epoch: rec.epoch });
  }

  if (p === '/api/apikey' && method === 'POST') {
    const u = signedIn();
    const key = `hb_${newId(24)}`;
    u.apiKeyHash = sha256(key);
    await saveDb();
    return sendJson(res, 200, { key });
  }

  if (p === '/api/apikey' && method === 'DELETE') {
    const u = signedIn();
    delete u.apiKeyHash;
    await saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/health-data' && method === 'POST') {
    const u = signedIn({ allowApiKey: true });
    const applied = await applyHealth(u, await readJson(req));
    return sendJson(res, 200, { ok: true, applied });
  }

  if (p === '/api/users' && method === 'GET') {
    admin();
    return sendJson(res, 200, { users: db.users.map(publicUser) });
  }

  if (p === '/api/users' && method === 'POST') {
    admin();
    const b = await readJson(req);
    const user = await createUser(normName(b.username), b.password, !!b.admin);
    await saveDb();
    return sendJson(res, 201, { user: publicUser(user) });
  }

  const um = /^\/api\/users\/([\w-]+)(\/password)?$/.exec(p);
  if (um) {
    const me = admin();
    const target = db.users.find((u) => u.id === um[1]);
    if (!target) throw new HttpError(404, 'That user doesn’t exist.');
    if (um[2] && method === 'POST') {
      const b = await readJson(req);
      const err = validate(target.username, b.password);
      if (err) throw new HttpError(400, err);
      Object.assign(target, await hashPassword(b.password));
      db.sessions = db.sessions.filter((s) => s.userId !== target.id || s.hash === req.sessionHash);
      await saveDb();
      return sendJson(res, 200, { ok: true });
    }
    if (!um[2] && method === 'DELETE') {
      if (target.id === me.id) throw new HttpError(400, 'You can’t delete your own account.');
      db.users = db.users.filter((u) => u !== target);
      db.sessions = db.sessions.filter((s) => s.userId !== target.id);
      records.delete(target.id);
      await saveDb();
      await fsp.rm(stateFile(target.id), { force: true });
      return sendJson(res, 200, { ok: true });
    }
  }

  throw new HttpError(404, 'Not found.');
}

/* ---------------- static files ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const REVALIDATE = new Set(['.html', '.js', '.css', '.webmanifest']);
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;

async function serveStatic(req, res, url) {
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch (e) {
    rel = '/';
  }
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.resolve(PUBLIC_DIR, `.${rel}`);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(404, 'Not found.');
  let stat = await fsp.stat(file).catch(() => null);
  if (!stat || !stat.isFile()) {
    if (path.extname(rel)) throw new HttpError(404, 'Not found.');
    file = path.join(PUBLIC_DIR, 'index.html');
    stat = await fsp.stat(file);
  }
  const ext = path.extname(file);
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': type,
    ETag: etag,
    'Cache-Control': REVALIDATE.has(ext) ? 'no-cache' : 'public, max-age=604800',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    Vary: 'Accept-Encoding',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  let body = await fsp.readFile(file);
  if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
    return await serveStatic(req, res, url);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) return res.end();
    return sendJson(res, status, { error: status === 500 ? 'Something went wrong on the server.' : e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Habitbook listening on port ${PORT} — data in ${DATA_DIR}, sign-ups ${ALLOW_SIGNUPS ? 'on' : 'off (admin adds users)'}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close();
    writes.finally(() => process.exit(0));
  });
}
