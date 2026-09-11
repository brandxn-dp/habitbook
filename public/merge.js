/*
 * Merges two copies of a Habitbook state. Shared by the browser app and the sync server.
 *
 * - Days merge field by field using per-field edit times in `_ts`, so ticking a habit on
 *   your phone and importing weight from Apple Health on the same day never clobber each other.
 * - Months and journal entries keep whichever copy was edited last (`_t`). Deleted journal
 *   entries stay as `{ id, deleted: true }` tombstones so the deletion syncs too.
 * - Settings merge per key (`settings._ts`); pen colours merge as one list (`catT`).
 * Data saved before sync existed has no timestamps; it loses to any timestamped edit.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HabitbookMerge = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const has = (v) => v !== undefined && v !== null && v !== '' && v !== false;
  const stamp = (o, k) => (isObj(o) && isObj(o._ts) && o._ts[k]) || 0;

  function dayFields(d) {
    const out = new Set(['moment', 'weight', 'sleep', 'score', 'bed', 'wake']);
    if (isObj(d.done)) for (const id of Object.keys(d.done)) out.add(`done.${id}`);
    if (isObj(d._ts)) for (const f of Object.keys(d._ts)) out.add(f);
    return out;
  }

  const getField = (d, f) => (f.startsWith('done.') ? (isObj(d.done) && d.done[f.slice(5)] ? true : undefined) : d[f]);

  function mergeDay(a, b) {
    if (!isObj(a)) return isObj(b) ? b : undefined;
    if (!isObj(b)) return a;
    const out = { done: {} };
    const ts = {};
    for (const f of new Set([...dayFields(a), ...dayFields(b)])) {
      const ta = stamp(a, f);
      const tb = stamp(b, f);
      const va = getField(a, f);
      const vb = getField(b, f);
      // Newest edit wins. On a tie (usually untimestamped data) keep whichever side has a value.
      const v = tb > ta ? vb : ta > tb ? va : has(vb) ? vb : va;
      if (has(v)) {
        if (f.startsWith('done.')) out.done[f.slice(5)] = true;
        else out[f] = v;
      }
      const t = Math.max(ta, tb);
      if (t) ts[f] = t;
    }
    if (Object.keys(ts).length) out._ts = ts;
    return out;
  }

  const newest = (x, y) => (!isObj(x) ? y : !isObj(y) ? x : (y._t || 0) >= (x._t || 0) ? y : x);

  function mergeMap(a, b, pick) {
    const A = isObj(a) ? a : {};
    const B = isObj(b) ? b : {};
    const out = {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const v = pick(A[k], B[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  function mergeSettings(a, b) {
    const A = isObj(a) ? a : {};
    const B = isObj(b) ? b : {};
    const out = {};
    const ts = {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (k === '_ts') continue;
      const ta = stamp(A, k);
      const tb = stamp(B, k);
      out[k] = tb > ta ? B[k] : ta > tb ? A[k] : k in B ? B[k] : A[k];
      if (Math.max(ta, tb)) ts[k] = Math.max(ta, tb);
    }
    out._ts = ts;
    return out;
  }

  function mergeJournal(a, b) {
    const byId = new Map();
    for (const e of Array.isArray(a) ? a : []) if (isObj(e) && e.id) byId.set(e.id, e);
    for (const e of Array.isArray(b) ? b : []) if (isObj(e) && e.id) byId.set(e.id, newest(byId.get(e.id), e));
    return [...byId.values()];
  }

  // `b` wins ties, so pass the incoming copy second.
  function mergeStates(a, b) {
    const A = isObj(a) ? a : {};
    const B = isObj(b) ? b : {};
    const ca = A.catT || 0;
    const cb = B.catT || 0;
    const categories = cb >= ca ? B.categories || A.categories : A.categories || B.categories;
    const out = {
      version: Math.max(A.version || 0, B.version || 0, 2),
      settings: mergeSettings(A.settings, B.settings),
      months: mergeMap(A.months, B.months, newest),
      days: mergeMap(A.days, B.days, mergeDay),
      journal: mergeJournal(A.journal, B.journal),
    };
    if (categories) out.categories = categories;
    if (ca || cb) out.catT = Math.max(ca, cb);
    return out;
  }

  return { mergeStates };
}));
