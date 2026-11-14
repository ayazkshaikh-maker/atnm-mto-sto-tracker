/* =====================================================================
   sync.js : team database on Google Drive through the Apps Script Web App
   - IndexedDB is the working copy (offline-first)
   - push carries the revision it was based on; on conflict a 3-way merge runs
   - large datasets (STO reports, STOCK files, PO file) travel as separate blobs
   ===================================================================== */
const LOCAL_SETTINGS = ['theme', 'density', 'navPinned'];
const jclone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const jeq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safeId = id => String(id || '').replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 120);

function syncable(st) {
  const settings = Object.assign({}, st.settings); for (const k of LOCAL_SETTINGS) delete settings[k];
  return { v: st.v, created: st.created, settings, mto: st.mto, snapshots: st.snapshots, poMeta: st.poMeta, template: st.template, fileSigs: st.fileSigs, edits: st.edits, audit: st.audit };
}
function mergeMap(B, L, R, pick) {
  B = B || {}; L = L || {}; R = R || {}; const out = {};
  for (const k of new Set([...Object.keys(B), ...Object.keys(L), ...Object.keys(R)])) {
    const b = B[k], l = L[k], r = R[k]; const lc = !jeq(b, l), rc = !jeq(b, r); let v;
    if (!lc) v = r; else if (!rc) v = l; else if (l !== undefined && r !== undefined) v = pick(l, r); else v = l !== undefined ? l : r;
    if (v !== undefined) out[k] = v;
  }
  return out;
}
function mergeArr(B, L, R, pick) {
  const m = a => { const o = {}; for (const x of a || []) o[x.id] = x; return o; };
  const res = mergeMap(m(B), m(L), m(R), pick); const order = [...(R || []), ...(L || [])].map(x => x.id);
  return uniq(order).filter(id => res[id]).map(id => res[id]);
}
const newer = (l, r) => (l.at || l.modified || 0) >= (r.at || r.modified || 0) ? l : r;
function mergeStates(base, L, R) {
  base = base || {}; R = R || {}; L = L || {};
  const out = Object.assign({}, R);
  out.settings = mergeMap(base.settings, L.settings, R.settings, l => l);
  out.edits = {}; for (const k of ['row', 'mat']) out.edits[k] = mergeMap((base.edits || {})[k], (L.edits || {})[k], (R.edits || {})[k], newer);
  for (const k of ['mto', 'snapshots']) out[k] = mergeArr(base[k], L[k], R[k], newer);
  out.fileSigs = Object.assign({}, R.fileSigs, L.fileSigs);
  out.poMeta = !jeq(base.poMeta, L.poMeta) ? L.poMeta : R.poMeta;
  out.template = !jeq(base.template, L.template) ? L.template : R.template;
  const seen = new Set();
  out.audit = [...(L.audit || []), ...(R.audit || [])].filter(a => { const k = a.ts + '|' + a.action + '|' + a.detail; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 800);
  out.v = 2; out.created = R.created || L.created;
  return out;
}
/* bring any stored state (v1 or v2) to the v2 shape */
function migrateState(st) {
  st = Object.assign(blankState(), jclone(st) || {});
  st.settings = Object.assign(defaultSettings(), st.settings || {});
  st.edits = st.edits || {}; st.edits = { row: st.edits.row || {}, mat: st.edits.mat || {} };
  st.mto = st.mto || [];
  st.snapshots = (st.snapshots || []).map(s => Object.assign({ kind: 'sto' }, s));
  st.v = 2;
  return st;
}
function adoptState(st) {
  const ui = S.ui; const local = {}; for (const k of LOCAL_SETTINGS) local[k] = S.settings[k];
  S = migrateState(st); Object.assign(S.settings, local); S.ui = ui;
}

const Sync = {
  rev: -1, base: null, dirty: false, busy: false, timer: null, status: 'off', msg: '', last: null, unsentSnaps: new Set(), poUnsent: false, needRender: false, started: false,
  cfg() { try { return JSON.parse(localStorage.getItem('atnm_cloud') || '{}'); } catch (e) { return {}; } },
  saveCfg(c) { try { localStorage.setItem('atnm_cloud', JSON.stringify(c)); } catch (e) { } },
  on() { const c = this.cfg(); return !!(c.url && c.key && c.enabled !== false); },
  who() { return (this.cfg().name || '').trim() || (ADMIN ? 'admin' : 'user'); },
  label() { return { off: 'Local only', ok: 'Synced' + (this.last ? ' ' + this.last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''), pending: 'Unsaved changes', saving: 'Saving…', pulling: 'Updating…', error: 'Offline · will retry' }[this.status] || this.status; },
  async call(action, payload) {
    const c = this.cfg();
    const r = await fetch(c.url, { method: 'POST', body: JSON.stringify(Object.assign({ key: c.key, action }, payload || {})), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text(); let j;
    try { j = JSON.parse(txt); } catch (e) { throw new Error(/<html/i.test(txt) ? 'The Web App returned a page, not data. Check the URL ends with /exec and access is "Anyone".' : 'Bad response'); }
    if (j.error) throw new Error(j.error);
    return j;
  },
  setStatus(s, msg) {
    this.status = s; this.msg = msg || '';
    const t = $('#syncTxt'), d = $('#syncDot'); if (t) t.textContent = this.label(); if (d) d.className = 'dot sc-' + s;
    const b = t && t.closest('button'); if (b) b.title = (msg ? msg + '\n' : '') + (this.on() ? 'Team database · click to sync now' : 'Set up the team database in Settings');
  },
  async loadMeta() { const m = await idb.get('cloudMeta'); if (m) { this.rev = m.rev; this.base = m.base; this.unsentSnaps = new Set(m.unsentSnaps || []); this.poUnsent = !!m.poUnsent; this.dirty = !!m.dirty; } },
  async saveMeta() { await idb.set('cloudMeta', { rev: this.rev, base: this.base, unsentSnaps: [...this.unsentSnaps], poUnsent: this.poUnsent, dirty: this.dirty }); },
  markDirty() {
    if (!this.on()) return;
    if (this.base && jeq(syncable(S), this.base)) return;
    this.dirty = true; this.setStatus('pending'); this.saveMeta();
    clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1500);
  },
  queueSnap(id) { if (!this.on()) return; this.unsentSnaps.add(id); this.saveMeta(); },
  queuePo() { if (!this.on()) return; this.poUnsent = true; this.saveMeta(); },
  async deleteSnap(id) { this.unsentSnaps.delete(id); if (this.on()) try { await this.call('delSnap', { id: safeId(id) }); } catch (e) { console.warn(e); } },
  async uploadPending() {
    for (const id of [...this.unsentSnaps]) {
      if (!S.snapshots.some(s => s.id === id)) { this.unsentSnaps.delete(id); continue; }
      this.setStatus('saving', 'Uploading dataset…');
      await this.call('putSnap', { id: safeId(id), lines: SNAP[id] || [] }); this.unsentSnaps.delete(id); await this.saveMeta();
    }
    if (this.poUnsent && PO) { this.setStatus('saving', 'Uploading PO file…'); await this.call('putPo', { po: PO }); this.poUnsent = false; await this.saveMeta(); }
  },
  async push() {
    if (!this.on()) return;
    if (this.busy) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1200); return; }
    this.busy = true;
    try {
      await this.uploadPending();
      let mine = syncable(S);
      if (this.base && jeq(mine, this.base) && this.rev >= 0) { this.dirty = false; this.setStatus('ok'); return; }
      this.setStatus('saving');
      let res = await this.call('push', { baseRev: this.rev, state: mine, by: this.who() });
      for (let i = 0; res.conflict && i < 3; i++) {
        adoptState(mergeStates(this.base, mine, res.state || {})); await this.afterRemote(); mine = syncable(S);
        res = await this.call('push', { baseRev: res.rev, state: mine, by: this.who() });
        if (!res.conflict) { toast('Your changes were merged with changes saved by another user', 'info', 5000); this.refreshView(); }
      }
      if (res.conflict) throw new Error('Could not merge, will retry');
      this.rev = res.rev; this.base = jclone(mine); this.dirty = false; this.last = new Date();
      await this.saveMeta(); this.setStatus('ok');
    } catch (e) { console.warn('sync push', e); this.setStatus('error', e.message); clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 30000); }
    finally { this.busy = false; }
  },
  async pull(opts = {}) {
    if (!this.on() || this.busy) return false;
    this.busy = true; let changed = false;
    try {
      if (opts.verbose) this.setStatus('pulling');
      const res = await this.call('pull', { haveRev: this.rev });
      if (!res.same) {
        if (res.state) { const st = this.dirty ? mergeStates(this.base, syncable(S), migrateState(res.state)) : res.state; adoptState(st); this.base = jclone(syncable(migrateState(res.state))); changed = true; }
        this.rev = res.rev; await this.afterRemote(); await this.saveMeta();
        if (changed && res.by && !opts.silentToast) toast(`Updated with changes from ${res.by}`, 'info');
      }
      this.last = new Date(); this.setStatus(this.dirty ? 'pending' : 'ok');
    } catch (e) { console.warn('sync pull', e); this.setStatus('error', e.message); }
    finally { this.busy = false; }
    if (this.dirty) this.push();
    if (changed) this.refreshView();
    return changed;
  },
  async afterRemote() {
    await idb.set('state', S);
    for (const sp of S.snapshots) if (!SNAP[sp.id] || !SNAP[sp.id].length) {
      const local = await idb.get('snap:' + sp.id);
      if (local && local.length) { SNAP[sp.id] = local; continue; }
      try { this.setStatus('pulling', 'Downloading ' + (sp.kind || 'sto') + ' data…'); const r = await this.call('getSnap', { id: safeId(sp.id) }); if (r.lines) { SNAP[sp.id] = r.lines; await idb.set('snap:' + sp.id, r.lines); } } catch (e) { console.warn(e); }
    }
    for (const id of Object.keys(SNAP)) if (!S.snapshots.some(s => s.id === id)) { delete SNAP[id]; idb.del('snap:' + id); }
    if (S.poMeta && (!PO || PO.imported !== S.poMeta.imported) && !this.poUnsent) { try { const r = await this.call('getPo'); if (r.po) { PO = normalizePO(r.po); await idb.set('po', PO); } } catch (e) { } }
    if (!S.poMeta && PO && !this.poUnsent) { PO = null; idb.del('po'); }
    rebuild();
  },
  refreshView() { if (!$('#modal').hidden || !$('#drawer').hidden) { this.needRender = true; return; } render(); },
  async connect() {
    const info = await this.call('info');
    const have = new Set(info.snaps || []);
    for (const sp of S.snapshots) if ((SNAP[sp.id] || []).length && !have.has(safeId(sp.id))) this.unsentSnaps.add(sp.id);
    if (PO && S.poMeta && !info.hasPo) this.poUnsent = true;
    this.rev = -1; this.base = null; this.dirty = S.mto.length + S.snapshots.length > 0 || Object.keys(S.edits.row).length > 0;
    await this.saveMeta();
    this.busy = false; await this.pull({ verbose: true, silentToast: true });
    if (this.dirty) await this.push();
    return info;
  },
  start() {
    if (!this.on()) { this.setStatus('off'); return; }
    this.started = true; this.setStatus(this.dirty ? 'pending' : 'ok');
    this.pull({ silentToast: true });
    setInterval(() => { if (document.visibilityState === 'visible') this.pull(); if (this.needRender && $('#modal').hidden && $('#drawer').hidden) { this.needRender = false; render(); } }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.pull(); });
    window.addEventListener('online', () => this.dirty ? this.push() : this.pull());
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
};
/* PO data from v1 ({map}) or v2 ({rows}) */
function normalizePO(po) {
  if (!po) return null;
  if (po.rows) return po;
  if (po.map) return { file: po.file, imported: po.imported, rows: Object.entries(po.map).map(([k, v]) => { const [p, l] = k.split('|'); return { po: p, line: l, cla: (v.cla || '').toUpperCase(), desc: v.desc, loc: v.loc, date: v.date, sheet: v.sheet, wells: uniq([...String(v.desc).matchAll(/(?:ID[-\s]?|_|\.|\b)(\d{3,6})\b/gi)].map(m => normWell(m[1]))).filter(w => w.length >= 3) }; }) };
  return null;
}
