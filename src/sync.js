/* =====================================================================
   sync.js : team database on Google Drive through an Apps Script Web App
   - local IndexedDB stays the working copy (works offline)
   - changes are pushed with the revision they were based on
   - if someone else saved first, a 3-way merge runs (base / mine / theirs)
   ===================================================================== */
const LOCAL_SETTINGS = ['theme', 'density', 'pageSize'];
const jclone = o => o == null ? o : JSON.parse(JSON.stringify(o));
const jeq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const safeId = id => String(id || '').replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 120);

function syncable(st) {
  const settings = Object.assign({}, st.settings); for (const k of LOCAL_SETTINGS) delete settings[k];
  return { v: st.v, created: st.created, settings, batches: st.batches, snapshots: st.snapshots, design: st.design, poMeta: st.poMeta, fileSigs: st.fileSigs, edits: st.edits, audit: st.audit };
}
/* 3-way merge of keyed maps. pick(l, r) decides when both sides changed the same key. */
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
  out.edits = {}; for (const k of ['req', 'sto', 'mat']) out.edits[k] = mergeMap((base.edits || {})[k], (L.edits || {})[k], (R.edits || {})[k], newer);
  for (const k of ['batches', 'snapshots', 'design']) out[k] = mergeArr(base[k], L[k], R[k], newer);
  out.fileSigs = Object.assign({}, R.fileSigs, L.fileSigs);
  out.poMeta = !jeq(base.poMeta, L.poMeta) ? L.poMeta : R.poMeta;
  const seen = new Set();
  out.audit = [...(L.audit || []), ...(R.audit || [])].filter(a => { const k = a.ts + '|' + a.action + '|' + a.detail; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 800);
  out.v = R.v || L.v; out.created = R.created || L.created;
  return out;
}
function adoptState(st) {
  const ui = S.ui; const local = {}; for (const k of LOCAL_SETTINGS) local[k] = S.settings[k];
  S = Object.assign(blankState(), jclone(st));
  S.settings = Object.assign(defaultSettings(), st.settings || {}, local);
  S.edits = Object.assign({ req: {}, sto: {}, mat: {} }, S.edits || {});
  S.ui = ui;
}

const Sync = {
  rev: -1, base: null, dirty: false, busy: false, timer: null, status: 'off', msg: '', last: null, unsentSnaps: new Set(), poUnsent: false, needRender: false,
  cfg() { try { return JSON.parse(localStorage.getItem('atnm_cloud') || '{}'); } catch (e) { return {}; } },
  saveCfg(c) { try { localStorage.setItem('atnm_cloud', JSON.stringify(c)); } catch (e) { } },
  on() { const c = this.cfg(); return !!(c.url && c.key && c.enabled !== false); },
  who() { return (this.cfg().name || '').trim() || (ADMIN ? 'admin' : 'user'); },
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
    const c = $('#syncChip'); if (!c) return;
    const txt = { off: 'Local only', ok: 'Synced', pending: 'Unsaved changes', saving: 'Saving...', pulling: 'Updating...', error: 'Offline - will retry' }[s] || s;
    c.className = 'sync-chip sc-' + s; c.querySelector('span').textContent = txt;
    c.title = (msg ? msg + '\n' : '') + (this.last ? 'Last sync ' + this.last.toLocaleTimeString() : '') + (this.on() ? '\nClick to sync now' : '\nSet up the team database in Settings & Admin');
  },
  async loadMeta() {
    const m = await idb.get('cloudMeta'); if (m) { this.rev = m.rev; this.base = m.base; this.unsentSnaps = new Set(m.unsentSnaps || []); this.poUnsent = !!m.poUnsent; this.dirty = !!m.dirty; }
  },
  async saveMeta() { await idb.set('cloudMeta', { rev: this.rev, base: this.base, unsentSnaps: [...this.unsentSnaps], poUnsent: this.poUnsent, dirty: this.dirty }); },
  markDirty() {
    if (!this.on()) return;
    if (this.base && jeq(syncable(S), this.base)) return;
    this.dirty = true; this.setStatus('pending'); this.saveMeta();
    clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 2000);
  },
  queueSnap(id) { if (!this.on()) return; this.unsentSnaps.add(id); this.saveMeta(); },
  queuePo() { if (!this.on()) return; this.poUnsent = true; this.saveMeta(); },
  async deleteSnap(id) { this.unsentSnaps.delete(id); if (this.on()) try { await this.call('delSnap', { id: safeId(id) }); } catch (e) { console.warn(e); } },
  async uploadPending() {
    for (const id of [...this.unsentSnaps]) {
      if (!S.snapshots.some(s => s.id === id)) { this.unsentSnaps.delete(id); continue; }
      this.setStatus('saving', 'Uploading SAP report...');
      await this.call('putSnap', { id: safeId(id), lines: SNAP[id] || [] }); this.unsentSnaps.delete(id); await this.saveMeta();
    }
    if (this.poUnsent && PO) { await this.call('putPo', { po: PO }); this.poUnsent = false; await this.saveMeta(); }
  },
  async push() {
    if (!this.on()) return;
    if (this.busy) { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1500); return; }
    this.busy = true;
    try {
      await this.uploadPending();
      let mine = syncable(S);
      if (this.base && jeq(mine, this.base) && this.rev >= 0) { this.dirty = false; this.setStatus('ok'); return; }
      this.setStatus('saving');
      let res = await this.call('push', { baseRev: this.rev, state: mine, by: this.who() });
      for (let i = 0; res.conflict && i < 3; i++) {
        const merged = mergeStates(this.base, mine, res.state || {});
        adoptState(merged); await this.afterRemote(); mine = syncable(S);
        res = await this.call('push', { baseRev: res.rev, state: mine, by: this.who() });
        if (!res.conflict) { toast('Your changes were merged with changes saved by another user', 'info', 5000); this.refreshView(); }
      }
      if (res.conflict) throw new Error('Could not merge, will retry');
      this.rev = res.rev; this.base = jclone(mine); this.dirty = false; this.last = new Date();
      await this.saveMeta(); this.setStatus('ok');
    } catch (e) {
      console.warn('sync push', e); this.setStatus('error', e.message);
      clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 30000);
    } finally { this.busy = false; }
  },
  async pull(opts = {}) {
    if (!this.on() || this.busy) return false;
    this.busy = true; let changed = false;
    try {
      if (opts.verbose) this.setStatus('pulling');
      const res = await this.call('pull', { haveRev: this.rev });
      if (!res.same) {
        if (res.state) {
          const st = this.dirty ? mergeStates(this.base, syncable(S), res.state) : res.state;
          adoptState(st); this.base = jclone(res.state); changed = true;
        }
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
    await idb.set('state', jclone(S));
    for (const sp of S.snapshots) if (!SNAP[sp.id] || !SNAP[sp.id].length) {
      const local = await idb.get('snap:' + sp.id);
      if (local && local.length) { SNAP[sp.id] = local; continue; }
      try { const r = await this.call('getSnap', { id: safeId(sp.id) }); if (r.lines) { SNAP[sp.id] = r.lines; await idb.set('snap:' + sp.id, r.lines); } } catch (e) { console.warn(e); }
    }
    for (const id of Object.keys(SNAP)) if (!S.snapshots.some(s => s.id === id)) { delete SNAP[id]; idb.del('snap:' + id); }
    if (S.poMeta && (!PO || PO.imported !== S.poMeta.imported) && !this.poUnsent) { try { const r = await this.call('getPo'); if (r.po) { PO = r.po; await idb.set('po', PO); } } catch (e) { } }
    if (!S.poMeta && PO && !this.poUnsent) { PO = null; idb.del('po'); }
    rebuild();
  },
  refreshView() { if (!$('#modal').hidden || !$('#drawer').hidden) { this.needRender = true; return; } render(); },
  async connect() {
    const info = await this.call('info');
    const have = new Set(info.snaps || []);
    for (const sp of S.snapshots) if ((SNAP[sp.id] || []).length && !have.has(safeId(sp.id))) this.unsentSnaps.add(sp.id);
    if (PO && S.poMeta && !info.hasPo) this.poUnsent = true;
    this.rev = -1; this.base = null; this.dirty = S.batches.length + S.snapshots.length + S.design.length > 0 || Object.keys(S.edits.req).length > 0;
    await this.saveMeta();
    this.busy = false; await this.pull({ verbose: true, silentToast: true });
    if (this.dirty) await this.push();
    return info;
  },
  start() {
    if (!this.on()) { this.setStatus('off'); return; }
    this.setStatus(this.dirty ? 'pending' : 'ok');
    this.pull({ silentToast: true });
    setInterval(() => { if (document.visibilityState === 'visible') this.pull(); if (this.needRender && $('#modal').hidden && $('#drawer').hidden) { this.needRender = false; render(); } }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.pull(); });
    window.addEventListener('online', () => this.dirty ? this.push() : this.pull());
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
};
