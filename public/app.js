'use strict';

/* ================= constants ================= */

const STORE_KEY = 'habitbook.v1';
const APP_VERSION = '1.1';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ROW_H = 26;
const CHART_W = 132;
const SLEEP_MIN_H = 4;
const SLEEP_MAX_H = 10;
const LB = 0.45359237;

// iOS system colours; each maps to a `.t-<key>` tone class in styles.css.
const PALETTE = {
  ink: 'Black', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', mint: 'Mint', teal: 'Teal',
  cyan: 'Cyan', blue: 'Blue', indigo: 'Indigo', purple: 'Purple', pink: 'Pink', brown: 'Brown', gray: 'Grey',
};

// The three pens from the notebook. Users can rename, recolour, add and remove these.
const DEFAULT_CATEGORIES = [
  { id: 'core', name: 'Non-negotiables', color: 'ink', meaning: 'Every day, no excuses — the ones you don’t skip.' },
  { id: 'build', name: 'Working towards', color: 'blue', meaning: 'Strive for every day, but if you don’t get it, that’s okay.' },
  { id: 'sleep', name: 'Affects sleep', color: 'red', meaning: 'Things that might affect your sleep or night routine.', sleepFactor: true },
];

const DEFAULT_SETTINGS = {
  theme: 'system',
  weightUnit: 'kg',
  weekStart: 'mon',
  dateFormat: 'dmy',
  sleepGoal: 8,
  morningReview: true,
  showMotto: true,
  autoTickJournal: true,
};

const DEFAULT_HABITS = [
  { id: 'cold', name: 'Cold exposure', kind: 'core' },
  { id: 'exercise', name: 'Exercise', kind: 'core' },
  { id: 'journal', name: 'Journal', kind: 'core' },
  { id: 'alone', name: 'Alone time', kind: 'build' },
  { id: 'socials', name: 'Socials on waking', kind: 'build', avoid: true },
  { id: 'stretch', name: 'Stretching', kind: 'build' },
  { id: 'read', name: 'Read 5+ pages', kind: 'build' },
  { id: 'stranger', name: 'Speak to a stranger', kind: 'build' },
  { id: 'coffee', name: 'Coffee', kind: 'sleep' },
  { id: 'sauna', name: 'Sauna', kind: 'sleep' },
  { id: 'meditation', name: 'Meditation', kind: 'sleep' },
];

const I = {
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5L6.5 7l-5 5.5"/></svg>',
  face: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 19.5c-.5-6.5 5-10.5 12-10.5 6.5 0 11.5 3 12 9"/><path d="M9.5 20.5c9-2 20-2.4 30-.5 2.5.5 2.5 2.4 0 2.6"/><path d="M13.5 22v7.5c0 7 4.8 12 10.5 12s10.5-5 10.5-12V22"/><circle cx="19.5" cy="27" r="1.3" fill="currentColor"/><circle cx="28.5" cy="27" r="1.3" fill="currentColor"/><path d="M17.5 34.5c2.3-2.2 4.4-2.4 6.5-1 2.1-1.4 4.2-1.2 6.5 1"/><path d="M24 29v2.5"/></svg>',
};

/* ================= date + format helpers ================= */

const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dayKey(new Date());
const monthKeyOf = (k) => k.slice(0, 7);
const parseDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k, n) => {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
const addMonths = (mk, n) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const daysIn = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const monthName = (mk) => {
  const [y, m] = mk.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const monthOnly = (mk) => MONTHS[Number(mk.slice(5, 7)) - 1];
const dayKeysOf = (mk) => Array.from({ length: daysIn(mk) }, (_, i) => `${mk}-${pad(i + 1)}`);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmtSleep = (min) => {
  const r = Math.round(min);
  return `${Math.floor(r / 60)}h ${pad(r % 60)}m`;
};
const fmtDelta = (min) => `${min >= 0 ? '+' : '−'}${fmtSleep(Math.abs(min)).replace(/^0h /, '')}`;
const fmtHours = (h) => `${Math.floor(h)}h${h % 1 ? ' 30m' : ''}`;
const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/* ================= state ================= */

const blankState = () => ({
  version: 2,
  settings: { ...DEFAULT_SETTINGS },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  months: {},
  days: {},
  journal: [],
});

// Fills in anything missing so older saves and imported backups keep working.
function normalize(s) {
  const out = { ...blankState(), ...s };
  out.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  if (!Array.isArray(out.categories) || !out.categories.length) out.categories = blankState().categories;
  if (!Array.isArray(out.journal)) out.journal = [];
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.months === 'object' && typeof s.days === 'object') return normalize(s);
    }
  } catch (e) { /* storage unavailable: start fresh */ }
  return blankState();
}

let state = load();
const S = () => state.settings;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Couldn’t save — storage is full or blocked');
  }
}

const catOf = (h) => state.categories.find((c) => c.id === h.kind) || state.categories[0];
const tone = (c) => `t-${PALETTE[c.color] ? c.color : 'ink'}`;
const habitsIn = (m, c) => m.habits.filter((h) => catOf(h) === c);

// A month that hasn't been set up yet borrows the previous month's habits and motto,
// the way you'd copy last month's columns onto a fresh spread.
function templateFor(mk) {
  const keys = Object.keys(state.months).sort();
  const prior = keys.filter((k) => k < mk).pop() || keys[0];
  const src = prior ? state.months[prior] : null;
  return {
    motto: src ? src.motto : 'Stay present',
    habits: (src ? src.habits : DEFAULT_HABITS).map((h) => ({ ...h })),
    goals: ['', '', ''],
    nextMonth: '',
  };
}
const getMonth = (mk) => state.months[mk] || templateFor(mk);
function ensureMonth(mk) {
  if (!state.months[mk]) state.months[mk] = templateFor(mk);
  const m = state.months[mk];
  if (!Array.isArray(m.goals)) m.goals = ['', '', ''];
  return m;
}
const getDay = (k) => state.days[k] || { done: {} };
function ensureDay(k) {
  ensureMonth(monthKeyOf(k));
  if (!state.days[k]) state.days[k] = { done: {} };
  if (!state.days[k].done) state.days[k].done = {};
  return state.days[k];
}
const isDone = (k, id) => !!(state.days[k] && state.days[k].done && state.days[k].done[id]);
function hasData(d) {
  if (!d) return false;
  return !!((d.moment && d.moment.trim()) || d.weight != null || d.sleep != null || d.score != null ||
    Object.values(d.done || {}).some(Boolean));
}

/* ================= units + formats ================= */

const unitW = () => S().weightUnit;
const kgToUnit = (kg) => (unitW() === 'lb' ? kg / LB : kg);
const fmtWeight = (kg) => (kg == null ? '' : kgToUnit(kg).toFixed(1));
function fmtStampDate(d) {
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(2);
  if (S().dateFormat === 'mdy') return `${mm}.${dd}.${yy}`;
  if (S().dateFormat === 'ymd') return `${d.getFullYear()}-${mm}-${dd}`;
  return `${dd}.${mm}.${yy}`;
}

function applyTheme() {
  const t = S().theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#000000' : '#F2F2F7'));
}

/* ================= derived data ================= */

// An avoid-habit counts as a success on a day you tracked and didn't tick it.
function isSuccess(h, k) {
  const done = isDone(k, h.id);
  return h.avoid ? hasData(state.days[k]) && !done : done;
}

// Per colour: scored colours count wins, sleep-factor colours just count what was logged.
function progress(k, m) {
  return state.categories.map((c) => {
    const hs = habitsIn(m, c);
    const ok = c.sleepFactor ? hs.filter((h) => isDone(k, h.id)).length : hs.filter((h) => isSuccess(h, k)).length;
    return { c, ok, n: hs.length };
  }).filter((p) => p.n);
}

function dayRatio(k) {
  const m = getMonth(monthKeyOf(k));
  const hs = m.habits.filter((h) => !catOf(h).sleepFactor);
  if (!hs.length || !hasData(state.days[k])) return 0;
  return hs.filter((h) => isSuccess(h, k)).length / hs.length;
}

function streak(id, k) {
  let cur = isDone(k, id) ? k : addDays(k, -1);
  let n = 0;
  while (isDone(cur, id) && n < 1000) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

/* ================= ui state ================= */

const ui = { tab: 'today', day: todayKey(), month: monthKeyOf(todayKey()), seg: 'spread' };
let lastToday = todayKey();
const view = document.getElementById('view');

/* ================= shared pieces ================= */

function navbar(title, left = '', right = '') {
  return `<header class="navbar"><div class="nav-inner">
    <div class="nav-side">${left}</div>
    <div class="nav-title">${esc(title)}</div>
    <div class="nav-side right">${right}</div>
  </div></header>`;
}

const glassBtn = (action, icon, label) =>
  `<button class="glass-btn" data-action="${action}" aria-label="${esc(label)}">${icon}</button>`;

const catHeader = (c) => `<div class="section-header"><span class="kdot"></span>${esc(c.name)}</div>`;

function mottoCard(m, mk, editable) {
  const text = editable
    ? `<input class="bubble-input" data-scope="month" data-month="${mk}" data-field="motto" value="${esc(m.motto)}" maxlength="28" placeholder="Stay present" aria-label="Monthly motto">`
    : esc(m.motto);
  return `<div class="section"><div class="list motto">
    <div class="motto-cap">${monthOnly(mk)}’s motto</div>
    <div class="motto-art"><div class="bubble">${text}</div><span class="doodle">${I.face}</span></div>
  </div></div>`;
}

function rings(list) {
  const R = [41, 28, 15];
  const arcs = list.slice(0, 3).map((p, i) => {
    const r = R[i];
    const c = 2 * Math.PI * r;
    const f = p.n ? p.ok / p.n : 0;
    const fill = f > 0
      ? `<circle class="ring" cx="50" cy="50" r="${r}" stroke-dasharray="${(c * Math.min(f, 1)).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 50 50)"/>`
      : '';
    return `<g class="${tone(p.c)}"><circle class="ring track" cx="50" cy="50" r="${r}"/>${fill}</g>`;
  }).join('');
  return `<svg class="rings" viewBox="0 0 100 100" aria-hidden="true">${arcs}</svg>`;
}

function goalsSection(mk, m, header = 'What are my goals?') {
  const goals = m.goals || ['', '', ''];
  return `<div class="section"><div class="section-header">${esc(header)}</div><div class="list goals">
    ${[0, 1, 2].map((i) => `<label class="row"><span class="gnum">${i + 1}.</span>
      <input class="text" data-scope="month" data-month="${mk}" data-field="goal" data-index="${i}" value="${esc(goals[i] || '')}" placeholder="${['Be a little more present', 'Be a little more mindful', 'Keep it realistic'][i]}" enterkeyhint="done"></label>`).join('')}
  </div><div class="section-footer">Three goals for ${monthOnly(mk)}. Keep them realistic.</div></div>`;
}

/* ================= Today ================= */

function weekStrip(k) {
  const tk = todayKey();
  const sundayFirst = S().weekStart === 'sun';
  const dow = sundayFirst ? parseDay(k).getDay() : (parseDay(k).getDay() + 6) % 7;
  const letters = sundayFirst ? 'SMTWTFS' : 'MTWTFSS';
  const start = addDays(k, -dow);
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const kk = addDays(start, i);
    const cls = [kk === k && 'sel', kk === tk && 'today', kk > tk && 'future'].filter(Boolean).join(' ');
    return `<button class="wday ${cls}" data-action="openDay" data-day="${kk}" aria-label="${esc(parseDay(kk).toDateString())}">
      <span class="wl">${letters[i]}</span><span class="wn">${parseDay(kk).getDate()}</span>
      <span class="wp" style="--p:${dayRatio(kk).toFixed(3)}"></span></button>`;
  }).join('')}</div>`;
}

function habitRow(h, k, locked) {
  const c = catOf(h);
  const on = isDone(k, h.id);
  let sub = '';
  if (h.avoid) sub = on ? '<span class="slip">Slipped</span>' : 'Avoid';
  else if (!c.sleepFactor) {
    const s = streak(h.id, k);
    if (s >= 2) sub = `<span class="streak">${s}-day streak</span>`;
  }
  return `<button class="row habit-row ${tone(c)}" data-action="toggle" data-day="${k}" data-habit="${h.id}" aria-pressed="${on}" ${locked ? 'disabled' : ''}>
    <span class="row-main"><span class="row-title">${esc(h.name)}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
    <span class="check ${on ? 'on' : ''}">${I.x}</span>
  </button>`;
}

function viewToday() {
  const k = ui.day;
  const tk = todayKey();
  const mk = monthKeyOf(k);
  const m = getMonth(mk);
  const d = getDay(k);
  const date = parseDay(k);
  const future = k > tk;
  const yesterday = addDays(tk, -1);

  const relative = k === tk ? 'Today' : k === yesterday ? 'Yesterday' : k === addDays(tk, 1) ? 'Tomorrow' : '';
  const title = relative || date.toLocaleDateString(undefined, { weekday: 'long' });
  const sub = date.toLocaleDateString(undefined, {
    weekday: relative ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });

  const left = glassBtn('prevDay', I.chevL, 'Previous day');
  const right = `${k !== tk ? '<button class="glass-btn pill" data-action="goToday">Today</button>' : ''}${glassBtn('nextDay', I.chevR, 'Next day')}`;

  const prog = progress(k, m);
  const scored = prog.filter((p) => !p.c.sleepFactor);

  // His routine: weigh in today, then revisit yesterday's moment, habits and sleep.
  const y = state.days[yesterday];
  const needsReview = S().morningReview && k === tk && (!y || !(y.moment && y.moment.trim()) || y.sleep == null);
  const review = needsReview ? `<div class="section"><div class="list">
      <button class="row" data-action="openDay" data-day="${yesterday}">
        <span class="row-main"><span class="row-title">Revisit yesterday</span>
        <span class="row-sub">Add yesterday’s memorable moment, habits and last night’s sleep.</span></span>${I.chev}
      </button></div></div>` : '';

  const summary = prog.length ? `<div class="section"><div class="list summary">
      ${scored.length ? rings(scored) : ''}
      <dl>${prog.map((p) => `<div class="${tone(p.c)}"><dt><span class="kdot"></span>${esc(p.c.name)}</dt>
        <dd>${p.ok}<small>${p.c.sleepFactor ? ' logged' : `/${p.n}`}</small></dd></div>`).join('')}</dl>
    </div></div>` : '';

  const habitSections = state.categories.map((c) => {
    const hs = habitsIn(m, c);
    if (!hs.length) return '';
    return `<div class="section ${tone(c)}">${catHeader(c)}
      <div class="list">${hs.map((h) => habitRow(h, k, future)).join('')}</div>
    </div>`;
  }).join('');

  const sleepH = d.sleep != null ? Math.floor(d.sleep / 60) : '';
  const sleepM = d.sleep != null ? pad(d.sleep % 60) : '';
  const dayAttrs = `data-scope="day" data-day="${k}"`;

  return navbar(date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), left, right) +
    `<h1 class="large-title">${esc(title)}</h1><p class="large-sub">${esc(sub)}</p>` +
    weekStrip(k) +
    review +
    summary +
    (S().showMotto && m.motto ? mottoCard(m, mk, false) : '') +
    `<div class="section"><div class="section-header">Memorable moment</div>
      <div class="list"><label class="row">
        <input class="text" ${dayAttrs} data-field="moment" maxlength="90" enterkeyhint="done"
          placeholder="One line — something that stuck out" value="${esc(d.moment || '')}" ${future ? 'disabled' : ''}>
      </label></div>
      <div class="section-footer">${future ? 'You can fill this in once the day has happened.' : 'Something you did, liked or didn’t like. A single line is enough.'}</div>
    </div>` +
    habitSections +
    `<div class="section"><div class="section-header">Body &amp; sleep</div><div class="list">
      <label class="row"><span class="row-main"><span class="row-title">Weight</span></span>
        <input class="field" ${dayAttrs} data-field="weight" inputmode="decimal" placeholder="—" value="${fmtWeight(d.weight)}" aria-label="Weight in ${unitW()}"><span class="unit">${unitW()}</span></label>
      <div class="row" data-sleep><span class="row-main"><span class="row-title">Sleep</span><span class="row-sub">That night · goal ${fmtHours(S().sleepGoal)}</span></span>
        <input class="field sm" ${dayAttrs} data-field="sleepH" inputmode="numeric" maxlength="2" placeholder="–" value="${sleepH}" aria-label="Sleep hours"><span class="unit">h</span>
        <input class="field sm" ${dayAttrs} data-field="sleepM" inputmode="numeric" maxlength="2" placeholder="–" value="${sleepM}" aria-label="Sleep minutes"><span class="unit">m</span></div>
      <label class="row"><span class="row-main"><span class="row-title">Sleep score</span></span>
        <input class="field" ${dayAttrs} data-field="score" inputmode="numeric" maxlength="3" placeholder="—" value="${d.score ?? ''}" aria-label="Sleep score"></label>
    </div><div class="section-footer">Weigh in each morning. Sleep goes on the day it followed — log last night’s from your watch on yesterday’s page.</div></div>`;
}

/* ================= Month ================= */

const chartX = (h) => 10 + ((clamp(h, SLEEP_MIN_H, SLEEP_MAX_H) - SLEEP_MIN_H) / (SLEEP_MAX_H - SLEEP_MIN_H)) * (CHART_W - 20);

function sleepChart(mk) {
  const keys = dayKeysOf(mk);
  const H = keys.length * ROW_H;
  let grid = '';
  for (let h = SLEEP_MIN_H; h <= SLEEP_MAX_H; h++) grid += `<line class="gl" x1="${chartX(h)}" x2="${chartX(h)}" y1="0" y2="${H}"/>`;
  grid += `<line class="gl target" x1="${chartX(S().sleepGoal)}" x2="${chartX(S().sleepGoal)}" y1="0" y2="${H}"/>`;
  const pts = [];
  keys.forEach((k, i) => {
    const s = state.days[k] && state.days[k].sleep;
    if (s != null) pts.push([chartX(s / 60), i * ROW_H + ROW_H / 2]);
  });
  const line = pts.length > 1 ? `<polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}"/>` : '';
  const dots = pts.map(([cx, cy]) => `<circle cx="${cx.toFixed(1)}" cy="${cy}" r="2.6"/>`).join('');
  return `<svg class="sleep-chart" width="${CHART_W}" height="${H}" viewBox="0 0 ${CHART_W} ${H}" aria-label="Sleep hours by day">${grid}${line}${dots}</svg>`;
}

function trackerTable(mk) {
  const m = getMonth(mk);
  const keys = dayKeysOf(mk);
  const tk = todayKey();
  const groups = state.categories.map((c) => habitsIn(m, c)).filter((g) => g.length);

  let head = `<th class="c-day sticky"></th><th class="c-weight t-ink"><span class="vlabel">Weight (${unitW()})</span></th>`;
  for (const g of groups) {
    head += '<th class="gap"></th>';
    for (const h of g) head += `<th class="${tone(catOf(h))}" title="${esc(h.name)}"><span class="vlabel">${h.avoid ? '⊘ ' : ''}${esc(h.name)}</span></th>`;
  }
  head += `<th class="gap"></th><th class="c-chart"><div class="chart-head">
      <div class="chart-title">Sleep<small>hours</small></div>
      ${[4, 6, 8, 10].map((h) => `<span class="tick" style="left:${chartX(h)}px">${h}</span>`).join('')}
    </div></th>
    <th class="c-score t-red"><span class="vlabel">Sleep score</span></th>`;

  const body = keys.map((k, i) => {
    const d = getDay(k);
    const future = k > tk;
    let cells = `<td class="c-day sticky"><button data-action="openDay" data-day="${k}" aria-label="Open day ${i + 1}">${i + 1}</button></td>
      <td class="c-weight">${fmtWeight(d.weight)}</td>`;
    for (const g of groups) {
      cells += '<td class="gap"></td>';
      for (const h of g) {
        const on = !!(d.done && d.done[h.id]);
        cells += `<td><button class="cell ${tone(catOf(h))}" data-action="toggle" data-day="${k}" data-habit="${h.id}" aria-label="${esc(h.name)}, day ${i + 1}" aria-pressed="${on}" ${future ? 'disabled' : ''}>${on ? I.x : ''}</button></td>`;
      }
    }
    cells += '<td class="gap"></td>';
    if (i === 0) cells += `<td class="c-chart" rowspan="${keys.length}">${sleepChart(mk)}</td>`;
    cells += `<td class="c-score">${d.score ?? ''}</td>`;
    return `<tr class="${future ? 'future' : ''} ${k === tk ? 'is-today' : ''}">${cells}</tr>`;
  }).join('');

  return `<table class="tracker"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function spread(mk) {
  const m = getMonth(mk);
  const tk = todayKey();
  const moments = dayKeysOf(mk).map((k, i) => {
    const d = getDay(k);
    const txt = d.moment && d.moment.trim();
    const cls = [k === tk && 'today', k > tk && 'future'].filter(Boolean).join(' ');
    const wd = parseDay(k).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
    return `<button class="row ${cls}" data-action="openDay" data-day="${k}">
      <span class="num">${i + 1}</span><span class="txt ${txt ? '' : 'empty'}">${txt ? esc(txt) : '—'}</span><span class="wd">${wd}</span>
    </button>`;
  }).join('');

  return (S().showMotto ? mottoCard(m, mk, true) : '') +
    `<div class="section"><div class="section-header">Habit tracker</div>
      <div class="tracker-card"><div class="tracker-scroll">${trackerTable(mk)}</div></div>
      <div class="legend">
        ${state.categories.map((c) => `<span class="${tone(c)}"><span class="kdot"></span>${esc(c.name)}</span>`).join('')}
        <span>⊘ Avoid</span>
      </div>
      <div class="section-footer">Tap a square to tick it off. Tap a day number to open that day.</div>
    </div>` +
    `<div class="section"><div class="section-header">Memorable moments</div><div class="list moments">${moments}</div></div>` +
    goalsSection(mk, m) +
    `<div class="section"><div class="section-header">Next month</div>
      <div class="list"><textarea class="textarea short" data-scope="month" data-month="${mk}" data-field="nextMonth"
        placeholder="Habits to add or change — e.g. alone time, social media on waking">${esc(m.nextMonth || '')}</textarea></div>
      <div class="section-footer">A note to yourself for when you set up ${monthOnly(addMonths(mk, 1))}.</div>
    </div>`;
}

function insights(mk) {
  const m = getMonth(mk);
  const tk = todayKey();
  const keys = dayKeysOf(mk).filter((k) => k <= tk);
  const tracked = keys.filter((k) => hasData(state.days[k]));
  const T = tracked.length;

  if (!T) {
    return `<div class="section"><div class="list empty">
      <span class="doodle">${I.face}</span>
      <h3>Nothing tracked yet</h3>
      <p>Tick off habits and log your sleep from Today, and ${monthOnly(mk)}’s insights will show up here.</p>
    </div></div>`;
  }

  const nights = tracked.map((k) => state.days[k]).filter((d) => d.sleep != null);
  const scores = tracked.map((k) => state.days[k].score).filter((s) => s != null);
  const weights = keys.map((k) => state.days[k] && state.days[k].weight).filter((w) => w != null).map(kgToUnit);
  const avgSleep = avg(nights.map((d) => d.sleep));
  const avgScore = avg(scores);
  const wChange = weights.length > 1 ? weights[weights.length - 1] - weights[0] : null;
  const u = unitW();

  const tiles = `<div class="tiles">
    <div class="tile t-ink"><div class="t">Days tracked</div><div class="v">${T}<small>/${keys.length}</small></div><div class="s">${Math.round((T / keys.length) * 100)}% of ${monthOnly(mk)} so far</div></div>
    <div class="tile t-red"><div class="t">Avg sleep</div><div class="v">${avgSleep != null ? fmtSleep(avgSleep) : '—'}</div><div class="s">Goal ${fmtHours(S().sleepGoal)} · ${nights.length} night${nights.length === 1 ? '' : 's'}</div></div>
    <div class="tile t-red"><div class="t">Avg sleep score</div><div class="v">${avgScore != null ? Math.round(avgScore) : '—'}</div><div class="s">${scores.length ? `Best ${Math.max(...scores)}` : 'No scores yet'}</div></div>
    <div class="tile t-blue"><div class="t">Weight</div><div class="v">${weights.length ? weights[weights.length - 1].toFixed(1) : '—'}<small>${weights.length ? u : ''}</small></div>
      <div class="s">${wChange != null ? `${wChange > 0 ? '+' : wChange < 0 ? '−' : '±'}${Math.abs(wChange).toFixed(1)} ${u} this month` : 'Log a few weigh-ins'}</div></div>
  </div>`;

  const habitStats = state.categories.map((c) => {
    const hs = habitsIn(m, c);
    if (!hs.length) return '';
    const rows = hs.map((h) => {
      const done = tracked.filter((k) => isDone(k, h.id)).length;
      const good = h.avoid ? T - done : done;
      const label = h.avoid ? `avoided ${good} of ${T}` : `${done} of ${T}`;
      return `<div class="row stat"><div class="stat-top"><span class="row-title">${esc(h.name)}</span><span class="detail">${label}</span></div>
        <div class="bar"><i style="width:${((good / T) * 100).toFixed(1)}%"></i></div></div>`;
    }).join('');
    return `<div class="section ${tone(c)}">${catHeader(c)}<div class="list">${rows}</div></div>`;
  }).join('');

  // Sleep is logged on the day it followed, so compare each sleep-factor habit with the same row.
  const factorHabits = m.habits.filter((h) => catOf(h).sleepFactor);
  const factors = factorHabits.length ? `<div class="section t-red"><div class="section-header"><span class="kdot"></span>Sleep factors</div><div class="list">
    ${factorHabits.map((h) => {
      const withS = [];
      const without = [];
      for (const k of tracked) {
        const s = state.days[k].sleep;
        if (s == null) continue;
        (isDone(k, h.id) ? withS : without).push(s);
      }
      if (!withS.length || !without.length) {
        return `<div class="row stat"><div class="stat-top"><span class="row-title">${esc(h.name)}</span><span class="detail">Need more nights</span></div></div>`;
      }
      const a = avg(withS);
      const b = avg(without);
      const diff = a - b;
      const cls = Math.abs(diff) < 10 ? '' : diff > 0 ? 'good' : 'bad';
      return `<div class="row stat"><div class="stat-top"><span class="row-title">${esc(h.name)}</span><span class="delta ${cls}">${fmtDelta(diff)}</span></div>
        <div class="factor"><span>With <b>${fmtSleep(a)}</b></span><span>Without <b>${fmtSleep(b)}</b></span></div></div>`;
    }).join('')}
  </div><div class="section-footer">Average sleep on days you did each thing versus days you didn’t.</div></div>` : '';

  const sleepVals = nights.map((d) => d.sleep / 60);
  const sleepTrend = sleepVals.length > 1 ? `<div class="section t-red"><div class="section-header">Sleep trend</div>
    <div class="list spark-card">${sparkline(sleepVals)}<div class="spark-meta"><span>Low ${fmtSleep(Math.min(...sleepVals) * 60)}</span><span>High ${fmtSleep(Math.max(...sleepVals) * 60)}</span></div></div></div>` : '';
  const weightTrend = weights.length > 1 ? `<div class="section t-blue"><div class="section-header">Weight trend</div>
    <div class="list spark-card">${sparkline(weights)}<div class="spark-meta"><span>Start ${weights[0].toFixed(1)} ${u}</span><span>Latest ${weights[weights.length - 1].toFixed(1)} ${u}</span></div></div></div>` : '';

  return tiles + habitStats + factors + sleepTrend + weightTrend;
}

function sparkline(vals) {
  const w = 300;
  const h = 56;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const span = mx - mn || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 5 - ((v - mn) / span) * (h - 10)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function viewMonth() {
  const mk = ui.month;
  const thisMonth = monthKeyOf(todayKey());
  const tracked = dayKeysOf(mk).filter((k) => hasData(state.days[k])).length;
  const left = glassBtn('prevMonth', I.chevL, 'Previous month');
  const right = `${mk !== thisMonth ? '<button class="glass-btn pill" data-action="thisMonth">This Month</button>' : ''}${glassBtn('nextMonth', I.chevR, 'Next month')}`;
  return navbar(monthName(mk), left, right) +
    `<h1 class="large-title">${esc(monthName(mk))}</h1>
     <p class="large-sub">${tracked ? `${tracked} day${tracked === 1 ? '' : 's'} tracked` : 'A fresh spread'}</p>
     <div class="seg" role="tablist">
       <button class="${ui.seg === 'spread' ? 'on' : ''}" data-action="seg" data-seg="spread" role="tab">Spread</button>
       <button class="${ui.seg === 'insights' ? 'on' : ''}" data-action="seg" data-seg="insights" role="tab">Insights</button>
     </div>` +
    (ui.seg === 'insights' ? insights(mk) : spread(mk));
}

/* ================= Journal ================= */

function viewJournal() {
  const mk = monthKeyOf(todayKey());
  const m = getMonth(mk);
  const entries = [...state.journal].sort((a, b) => b.ts.localeCompare(a.ts));
  let list = '';
  let group = '';
  for (const e of entries) {
    const d = new Date(e.ts);
    const g = monthName(dayKey(d).slice(0, 7));
    if (g !== group) {
      if (group) list += '</div>';
      list += `<div class="section"><div class="section-header">${esc(g)}</div>`;
      group = g;
    }
    const grat = (e.grateful || []).filter(Boolean);
    list += `<button class="entry" data-action="editEntry" data-id="${e.id}">
      <div class="entry-meta"><span>${fmtStampDate(d)}</span><span>${fmtTime(d)}</span></div>
      ${e.text ? `<div class="entry-text">${esc(e.text)}</div>` : ''}
      ${grat.length ? `<div class="entry-grat">${grat.map((t) => `<div><span>Grateful for</span> ${esc(t)}</div>`).join('')}</div>` : ''}
    </button>`;
  }
  if (group) list += '</div>';

  const empty = `<div class="section"><div class="list empty">
    <span class="doodle">${I.face}</span>
    <h3>Keep a daily journal</h3>
    <p>About half a page. Reflect on your day and how you’re feeling, then write down three things you’re grateful for.</p>
  </div></div>`;

  return navbar('Journal', '', glassBtn('newEntry', I.plus, 'New entry')) +
    '<h1 class="large-title">Journal</h1><p class="large-sub">Reflect, then be grateful for three things</p>' +
    goalsSection(mk, m, `${monthOnly(mk)} — what are my goals?`) +
    (entries.length ? list : empty);
}

/* ================= Habits ================= */

function viewHabits() {
  const mk = ui.month;
  const m = getMonth(mk);
  const sections = state.categories.map((c) => {
    const hs = habitsIn(m, c);
    return `<div class="section ${tone(c)}">${catHeader(c)}
      <div class="list">
        ${hs.map((h) => `<button class="row" data-action="editHabit" data-id="${h.id}">
          <span class="row-main"><span class="row-title">${esc(h.name)}</span></span>
          ${h.avoid ? '<span class="tag">Avoid</span>' : ''}${I.chev}</button>`).join('')}
        <button class="row blue" data-action="addHabit" data-kind="${c.id}">Add Habit</button>
      </div>
      ${c.meaning ? `<div class="section-footer">${esc(c.meaning)}</div>` : ''}
    </div>`;
  }).join('');

  return navbar('Habits') +
    '<h1 class="large-title">Habits</h1><p class="large-sub">Set up your spread for the month</p>' +
    `<div class="month-switch">${glassBtn('prevMonth', I.chevL, 'Previous month')}<span class="label">${esc(monthName(mk))}</span>${glassBtn('nextMonth', I.chevR, 'Next month')}</div>` +
    `<div class="section"><div class="list">
      <label class="row"><span class="row-main"><span class="row-title">Monthly motto</span></span>
        <input class="text" style="text-align:right;color:var(--label-2)" data-scope="month" data-month="${mk}" data-field="motto" maxlength="28" value="${esc(m.motto)}" placeholder="Stay present"></label>
      <button class="row" data-action="tab" data-tab="settings">
        <span class="row-main"><span class="row-title">Colours &amp; Meanings</span>
        <span class="row-sub">${state.categories.map((c) => esc(c.name)).join(' · ')}</span></span>${I.chev}</button>
    </div></div>` +
    sections +
    `<p class="about">Changes here apply to ${esc(monthName(mk))}. A new month starts with a copy of the one before it.</p>`;
}

/* ================= Settings ================= */

function segRow(label, key, options) {
  return `<div class="row"><span class="row-main"><span class="row-title">${label}</span></span>
    <div class="seg inline">${options.map(([v, l]) => `<button class="${S()[key] === v ? 'on' : ''}" data-action="set" data-key="${key}" data-value="${v}">${l}</button>`).join('')}</div></div>`;
}

function switchRow(label, key, sub) {
  return `<label class="row"><span class="row-main"><span class="row-title">${label}</span><span class="row-sub">${sub}</span></span>
    <span class="switch"><input type="checkbox" data-setting="${key}" ${S()[key] ? 'checked' : ''}><span></span></span></label>`;
}

function viewSettings() {
  const theme = S().theme;
  const current = getMonth(monthKeyOf(todayKey()));
  const themeRows = [['system', 'Automatic', 'Match this device'], ['light', 'Light', ''], ['dark', 'Dark', '']].map(([v, l, sub]) =>
    `<button class="row" data-action="set" data-key="theme" data-value="${v}">
      <span class="row-main"><span class="row-title">${l}</span>${sub ? `<span class="row-sub">${sub}</span>` : ''}</span>
      <span class="tick" ${theme === v ? '' : 'hidden'}>${I.check}</span></button>`).join('');
  const catRows = state.categories.map((c) => {
    const n = habitsIn(current, c).length;
    return `<button class="row ${tone(c)}" data-action="editCat" data-id="${c.id}">
      <span class="swatch-dot"></span>
      <span class="row-main"><span class="row-title">${esc(c.name)}</span><span class="row-sub">${esc(c.meaning || PALETTE[c.color])}</span></span>
      ${c.sleepFactor ? '<span class="tag">Sleep</span>' : ''}<span class="detail">${n}</span>${I.chev}</button>`;
  }).join('');

  return navbar('Settings') +
    '<h1 class="large-title">Settings</h1><p class="large-sub">Make the book your own</p>' +
    `<div class="section"><div class="section-header">Appearance</div><div class="list">${themeRows}</div></div>` +
    `<div class="section"><div class="section-header">Pen colours</div><div class="list">
      ${catRows}
      <button class="row blue" data-action="addCat">Add Colour</button>
    </div><div class="section-footer">Give each colour its own meaning, like the pens in the notebook. Colours marked Sleep are logged rather than scored, and compared with your sleep in Insights.</div></div>` +
    `<div class="section"><div class="section-header">Units &amp; formats</div><div class="list">
      ${segRow('Weight', 'weightUnit', [['kg', 'kg'], ['lb', 'lb']])}
      ${segRow('Week starts', 'weekStart', [['mon', 'Mon'], ['sun', 'Sun']])}
      ${segRow('Dates', 'dateFormat', [['dmy', 'DD.MM'], ['mdy', 'MM.DD'], ['ymd', 'ISO']])}
    </div><div class="section-footer">Weight is stored in kilograms and converted for display, so you can switch at any time.</div></div>` +
    `<div class="section"><div class="section-header">Sleep</div><div class="list">
      <div class="row"><span class="row-main"><span class="row-title">Sleep goal</span></span>
        <span class="detail">${fmtHours(S().sleepGoal)}</span>
        <span class="stepper"><button data-action="sleepGoal" data-delta="-0.5" aria-label="Less sleep">−</button><button data-action="sleepGoal" data-delta="0.5" aria-label="More sleep">+</button></span></div>
    </div><div class="section-footer">Shown as a dashed line on the sleep chart.</div></div>` +
    `<div class="section"><div class="section-header">Daily routine</div><div class="list">
      ${switchRow('Revisit yesterday', 'morningReview', 'Prompt each morning to finish yesterday’s page')}
      ${switchRow('Monthly motto', 'showMotto', 'Show the motto bubble on Today and Month')}
      ${switchRow('Auto-tick Journal', 'autoTickJournal', 'Writing an entry ticks off a habit named Journal')}
    </div></div>` +
    `<div class="section"><div class="section-header">Data</div><div class="list">
      <button class="row blue" data-action="export">Export Backup</button>
      <button class="row blue" data-action="import">Import Backup</button>
      <button class="row danger" data-action="erase">Erase All Data</button>
    </div><div class="section-footer">Everything is stored on this device only. Export a backup to move it to another device.</div></div>` +
    `<p class="about">Habitbook ${APP_VERSION} · Inspired by the Sanctuary habit tracker</p>`;
}

/* ================= sheets ================= */

function openSheet({ title, subtitle = '', body, onDone, onMount }) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="grabber"></div>
      <div class="sheet-nav">
        <button class="glass-btn pill" style="color:var(--label)" data-sheet="cancel">Cancel</button>
        <div class="sheet-title">${esc(title)}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div>
        <button class="glass-btn pill primary" data-sheet="done">Done</button>
      </div>
      <div class="sheet-body">${body}</div>
    </div>`;
  const sheet = root.querySelector('.sheet');
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));

  const close = () => {
    root.classList.remove('open');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 400);
  };
  root.onclick = (e) => {
    if (e.target.classList.contains('sheet-backdrop')) return close();
    const b = e.target.closest('[data-sheet]');
    if (!b) return;
    if (b.dataset.sheet === 'cancel') close();
    else if (onDone(sheet) !== false) close();
  };
  if (onMount) onMount(sheet, close);
}

const sheetSwitch = (label, key, on) => `<label class="row"><span class="row-main"><span class="row-title">${label}</span></span>
  <span class="switch"><input type="checkbox" data-k="${key}" ${on ? 'checked' : ''}><span></span></span></label>`;

function entrySheet(id) {
  const existing = id ? state.journal.find((j) => j.id === id) : null;
  const ts = existing ? new Date(existing.ts) : new Date();
  const g = (existing && existing.grateful) || ['', '', ''];
  const body = `
    <div class="section"><div class="list">
      <textarea class="textarea" data-k="text" placeholder="Where are you at? Reflect on your day, your feelings, the big things happening in your life.">${esc(existing ? existing.text : '')}</textarea>
    </div></div>
    <div class="section"><div class="section-header">Gratitude</div><div class="list">
      ${[0, 1, 2].map((i) => `<label class="row"><span class="prefix">Grateful for</span>
        <input class="text" data-k="g${i}" value="${esc(g[i] || '')}" placeholder="${['community', 'the hard things', 'the times that pass'][i]}"></label>`).join('')}
    </div><div class="section-footer">You can be grateful for anything — even the times that suck, because they pass.</div></div>
    ${existing ? '<div class="section"><div class="list"><button class="row danger" data-s="delete">Delete Entry</button></div></div>' : ''}`;

  openSheet({
    title: existing ? 'Journal Entry' : 'New Entry',
    subtitle: `${fmtStampDate(ts)} · ${fmtTime(ts)}`,
    body,
    onDone: (sh) => {
      const text = sh.querySelector('[data-k=text]').value.trim();
      const grateful = [0, 1, 2].map((i) => sh.querySelector(`[data-k=g${i}]`).value.trim());
      if (!text && !grateful.some(Boolean)) return true;
      if (existing) {
        existing.text = text;
        existing.grateful = grateful;
      } else {
        state.journal.push({ id: uid(), ts: ts.toISOString(), text, grateful });
        if (S().autoTickJournal) autoTickJournal(dayKey(ts));
      }
      save();
      render(true);
      return true;
    },
    onMount: (sh, close) => {
      const del = sh.querySelector('[data-s=delete]');
      if (del) del.addEventListener('click', () => {
        if (!confirm('Delete this journal entry?')) return;
        state.journal = state.journal.filter((j) => j.id !== id);
        save();
        close();
        render(true);
      });
    },
  });
}

// Writing an entry is the "Journal" habit, so tick it off for that day.
function autoTickJournal(k) {
  const h = getMonth(monthKeyOf(k)).habits.find((x) => /journal/i.test(x.name) && !x.avoid);
  if (!h || isDone(k, h.id)) return;
  ensureDay(k).done[h.id] = true;
  toast(`Ticked off “${h.name}”`);
}

function habitSheet(mk, id, kind) {
  const cur = id ? getMonth(mk).habits.find((h) => h.id === id) : null;
  let sel = cur ? catOf(cur).id : kind || state.categories[0].id;
  const body = `
    <div class="section"><div class="list"><label class="row">
      <input class="text" data-k="name" maxlength="24" placeholder="Habit name" value="${esc(cur ? cur.name : '')}">
    </label></div><div class="section-footer">Short names fit best on the tracker.</div></div>
    <div class="section"><div class="section-header">Colour</div><div class="list">
      ${state.categories.map((c) => `<button class="row ${tone(c)}" data-s="kind" data-kind="${c.id}">
        <span class="swatch-dot"></span>
        <span class="row-main"><span class="row-title">${esc(c.name)}</span>${c.meaning ? `<span class="row-sub">${esc(c.meaning)}</span>` : ''}</span>
        <span class="tick" ${sel === c.id ? '' : 'hidden'}>${I.check}</span></button>`).join('')}
    </div></div>
    <div class="section"><div class="list">${sheetSwitch('Avoid this habit', 'avoid', cur && cur.avoid)}</div>
      <div class="section-footer">Not every habit is a good habit. Turn this on for things you’re trying not to do, like socials on waking — a ✕ then means you slipped.</div></div>
    ${cur ? `<div class="section"><div class="list">
        <button class="row blue" data-s="up">Move Up</button>
        <button class="row blue" data-s="down">Move Down</button>
      </div></div>
      <div class="section"><div class="list"><button class="row danger" data-s="delete">Delete Habit</button></div>
      <div class="section-footer">Removes it from ${esc(monthName(mk))}. Past ticks are kept.</div></div>` : ''}`;

  openSheet({
    title: cur ? 'Edit Habit' : 'New Habit',
    subtitle: monthName(mk),
    body,
    onDone: (sh) => {
      const input = sh.querySelector('[data-k=name]');
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return false;
      }
      const avoid = sh.querySelector('[data-k=avoid]').checked;
      const m = ensureMonth(mk);
      if (cur) Object.assign(m.habits.find((h) => h.id === id), { name, kind: sel, avoid });
      else m.habits.push({ id: uid(), name, kind: sel, avoid });
      save();
      render(true);
      return true;
    },
    onMount: (sh, close) => {
      sh.addEventListener('click', (e) => {
        const b = e.target.closest('[data-s]');
        if (!b) return;
        const act = b.dataset.s;
        if (act === 'kind') {
          sel = b.dataset.kind;
          sh.querySelectorAll('[data-s=kind]').forEach((r) => { r.querySelector('.tick').hidden = r.dataset.kind !== sel; });
        } else if (act === 'up' || act === 'down') {
          moveHabit(mk, id, act === 'up' ? -1 : 1);
        } else if (act === 'delete') {
          if (!confirm(`Delete “${cur.name}” from ${monthName(mk)}?`)) return;
          const m = ensureMonth(mk);
          m.habits = m.habits.filter((h) => h.id !== id);
          save();
          close();
          render(true);
        }
      });
      if (!cur) setTimeout(() => sh.querySelector('[data-k=name]').focus(), 420);
    },
  });
}

function moveHabit(mk, id, dir) {
  const hs = ensureMonth(mk).habits;
  const i = hs.findIndex((h) => h.id === id);
  if (i < 0) return;
  let j = i + dir;
  while (j >= 0 && j < hs.length && catOf(hs[j]) !== catOf(hs[i])) j += dir;
  if (j < 0 || j >= hs.length) return;
  [hs[i], hs[j]] = [hs[j], hs[i]];
  save();
  render(true);
}

function categorySheet(id) {
  const cur = id ? state.categories.find((c) => c.id === id) : null;
  const used = new Set(state.categories.map((c) => c.color));
  let color = cur ? cur.color : Object.keys(PALETTE).find((p) => !used.has(p)) || 'blue';
  const body = `
    <div class="section"><div class="list">
      <label class="row"><input class="text" data-k="name" maxlength="22" placeholder="Name, e.g. Non-negotiables" value="${esc(cur ? cur.name : '')}"></label>
      <label class="row"><input class="text" data-k="meaning" maxlength="90" placeholder="What does this colour mean to you?" value="${esc(cur ? cur.meaning || '' : '')}"></label>
    </div></div>
    <div class="section"><div class="section-header">Colour</div><div class="list swatches">
      ${Object.entries(PALETTE).map(([k, n]) => `<button class="swatch t-${k} ${k === color ? 'sel' : ''}" data-s="color" data-color="${k}" aria-label="${n}">${I.check}</button>`).join('')}
    </div></div>
    <div class="section"><div class="list">${sheetSwitch('Compare with sleep', 'sleep', cur && cur.sleepFactor)}</div>
      <div class="section-footer">Habits in this colour are logged rather than scored as wins or misses, and Insights compares them with how you slept.</div></div>
    ${cur ? `<div class="section"><div class="list">
        <button class="row blue" data-s="up">Move Up</button>
        <button class="row blue" data-s="down">Move Down</button>
      </div></div>
      <div class="section"><div class="list"><button class="row danger" data-s="delete">Delete Colour</button></div>
      <div class="section-footer">Its habits move to another colour. Nothing you’ve tracked is lost.</div></div>` : ''}`;

  openSheet({
    title: cur ? 'Edit Colour' : 'New Colour',
    body,
    onDone: (sh) => {
      const input = sh.querySelector('[data-k=name]');
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return false;
      }
      const fields = { name, meaning: sh.querySelector('[data-k=meaning]').value.trim(), color, sleepFactor: sh.querySelector('[data-k=sleep]').checked };
      if (cur) Object.assign(cur, fields);
      else state.categories.push({ id: uid(), ...fields });
      save();
      render(true);
      return true;
    },
    onMount: (sh, close) => {
      sh.addEventListener('click', (e) => {
        const b = e.target.closest('[data-s]');
        if (!b) return;
        const act = b.dataset.s;
        if (act === 'color') {
          color = b.dataset.color;
          sh.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.color === color));
        } else if (act === 'up' || act === 'down') {
          const cs = state.categories;
          const i = cs.findIndex((c) => c.id === id);
          const j = i + (act === 'up' ? -1 : 1);
          if (i < 0 || j < 0 || j >= cs.length) return;
          [cs[i], cs[j]] = [cs[j], cs[i]];
          save();
          render(true);
        } else if (act === 'delete') {
          if (state.categories.length < 2) return toast('You need at least one colour');
          const fallback = state.categories.find((c) => c.id !== id);
          if (!confirm(`Delete “${cur.name}”? Its habits move to “${fallback.name}”.`)) return;
          for (const m of Object.values(state.months)) m.habits.forEach((h) => { if (h.kind === id) h.kind = fallback.id; });
          state.categories = state.categories.filter((c) => c.id !== id);
          save();
          close();
          render(true);
        }
      });
      if (!cur) setTimeout(() => sh.querySelector('[data-k=name]').focus(), 420);
    },
  });
}

/* ================= data ================= */

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habitbook-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data.months !== 'object' || typeof data.days !== 'object') throw new Error('bad file');
      if (!confirm('Replace everything on this device with this backup?')) return;
      state = normalize(data);
      save();
      applyTheme();
      render();
      toast('Backup imported');
    } catch (err) {
      toast('That file isn’t a Habitbook backup');
    }
  };
  reader.readAsText(file);
});

/* ================= events ================= */

function toggle(k, id) {
  if (k > todayKey()) return;
  const d = ensureDay(k);
  if (d.done[id]) delete d.done[id];
  else d.done[id] = true;
  save();
  if (navigator.vibrate) navigator.vibrate(8);
  render(true);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  switch (a) {
    case 'tab':
      if (ui.tab === el.dataset.tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
      ui.tab = el.dataset.tab;
      render();
      window.scrollTo(0, 0);
      break;
    case 'prevDay':
    case 'nextDay':
      ui.day = addDays(ui.day, a === 'prevDay' ? -1 : 1);
      ui.month = monthKeyOf(ui.day);
      render(true);
      break;
    case 'goToday':
      ui.day = todayKey();
      ui.month = monthKeyOf(ui.day);
      render(true);
      break;
    case 'openDay':
      ui.day = el.dataset.day;
      ui.month = monthKeyOf(ui.day);
      if (ui.tab !== 'today') {
        ui.tab = 'today';
        render();
        window.scrollTo(0, 0);
      } else render(true);
      break;
    case 'toggle':
      toggle(el.dataset.day, el.dataset.habit);
      break;
    case 'prevMonth':
    case 'nextMonth':
      ui.month = addMonths(ui.month, a === 'prevMonth' ? -1 : 1);
      render(true);
      break;
    case 'thisMonth':
      ui.month = monthKeyOf(todayKey());
      render(true);
      break;
    case 'seg':
      ui.seg = el.dataset.seg;
      render(true);
      break;
    case 'set':
      state.settings[el.dataset.key] = el.dataset.value;
      save();
      if (el.dataset.key === 'theme') applyTheme();
      render(true);
      break;
    case 'sleepGoal':
      state.settings.sleepGoal = clamp(Math.round((S().sleepGoal + Number(el.dataset.delta)) * 2) / 2, 5, 10);
      save();
      render(true);
      break;
    case 'newEntry':
      entrySheet();
      break;
    case 'editEntry':
      entrySheet(el.dataset.id);
      break;
    case 'addHabit':
      habitSheet(ui.month, null, el.dataset.kind);
      break;
    case 'editHabit':
      habitSheet(ui.month, el.dataset.id);
      break;
    case 'addCat':
      categorySheet();
      break;
    case 'editCat':
      categorySheet(el.dataset.id);
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      document.getElementById('import-file').click();
      break;
    case 'erase':
      if (confirm('Erase all habits, days, journal entries and settings on this device? This can’t be undone.')) {
        state = blankState();
        save();
        applyTheme();
        render();
        toast('All data erased');
      }
      break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  const f = t.dataset.field;
  if (!f) return;
  if (t.dataset.scope === 'day') {
    const d = ensureDay(t.dataset.day);
    if (f === 'moment') {
      d.moment = t.value;
    } else if (f === 'weight') {
      const v = parseFloat(t.value.replace(',', '.'));
      if (Number.isFinite(v)) d.weight = Math.round((unitW() === 'lb' ? v * LB : v) * 1000) / 1000;
      else delete d.weight;
    } else if (f === 'score') {
      const v = parseInt(t.value, 10);
      if (Number.isFinite(v)) d.score = clamp(v, 0, 100);
      else delete d.score;
    } else if (f === 'sleepH' || f === 'sleepM') {
      const row = t.closest('[data-sleep]');
      const h = row.querySelector('[data-field=sleepH]').value.trim();
      const m = row.querySelector('[data-field=sleepM]').value.trim();
      if (h === '' && m === '') delete d.sleep;
      else d.sleep = Math.min(24, parseInt(h, 10) || 0) * 60 + Math.min(59, parseInt(m, 10) || 0);
    }
  } else if (t.dataset.scope === 'month') {
    const m = ensureMonth(t.dataset.month);
    if (f === 'goal') m.goals[Number(t.dataset.index)] = t.value;
    else m[f] = t.value;
  }
  save();
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.setting) {
    state.settings[t.dataset.setting] = t.checked;
    save();
  } else if (t.dataset.scope === 'day' && ui.tab === 'today') {
    // Numbers typed on Today feed the rings, week strip and "revisit" prompt.
    render(true);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('input.text, input.field, .bubble-input')) e.target.blur();
});

function onScroll() {
  const nb = document.querySelector('.navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 30);
}
window.addEventListener('scroll', onScroll, { passive: true });

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// Roll over to the new day if the app was left open overnight.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const tk = todayKey();
  if (tk !== lastToday) {
    if (ui.day === lastToday) {
      ui.day = tk;
      ui.month = monthKeyOf(tk);
    }
    lastToday = tk;
    render(true);
  }
});

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ================= render ================= */

const VIEWS = { today: viewToday, month: viewMonth, journal: viewJournal, habits: viewHabits, settings: viewSettings };

function render(keepScroll) {
  const y = window.scrollY;
  view.innerHTML = VIEWS[ui.tab]();
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === ui.tab;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  });
  if (keepScroll) window.scrollTo(0, y);
  onScroll();
}

applyTheme();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
