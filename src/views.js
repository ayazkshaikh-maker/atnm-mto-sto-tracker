/* =====================================================================
   views.js : shell, scope filter, all screens, drawers/editors
   ===================================================================== */
const VIEWS = [
  ['dashboard', 'Dashboard', 'dash'], ['recon', 'MTO Reconciliation', 'list'], ['pending', 'Pending Register', 'hourglass'],
  ['sto', 'SAP STO Register', 'db'], ['flags', 'Flags & Duplicates', 'flag'], ['wells', 'Well Inventory', 'pin'],
  ['materials', 'Material Master', 'box'], ['exports', 'Exports', 'download'], ['sources', 'Data Sources', 'folder'], ['settings', 'Settings & Admin', 'gear']
];
const V = {};
const inScope = r => (!S.ui.well || r.wellId === S.ui.well) && (!S.ui.dept || r.dept === S.ui.dept);
const scopeLabel = () => [S.ui.well ? 'Well ' + S.ui.well : 'All wells', S.ui.dept || 'all disciplines'].join(' · ');
function go(view, extra) { Object.assign(S.ui, { view }, extra || {}); persist(); render(); $('#view').scrollTop = 0; window.scrollTo(0, 0); document.body.classList.remove('nav-open'); }

/* ---------------- shell ---------------- */
function applyAppearance() {
  const st = S.settings; const html = document.documentElement;
  const dark = st.theme === 'dark' || (st.theme === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  html.dataset.theme = dark ? 'dark' : 'light'; html.dataset.density = st.density || 'comfortable';
  html.style.setProperty('--brand', st.accent || '#204393');
  document.title = st.title || DEFAULT_TITLE;
}
function renderShell() {
  const st = S.settings;
  $('#side').innerHTML = `
    <div class="brand">${st.showLogo && st.logo ? `<img src="${st.logo}" alt="Company logo">` : ''}<div><b>${esc(st.title)}</b><small>${esc(st.subtitle || '')}</small></div></div>
    <nav>${VIEWS.map(([k, l, i]) => `<button data-nav="${k}" class="${S.ui.view === k ? 'on' : ''}">${icon(i)}<span>${esc(l)}</span>${k === 'flags' && D && D.FL.length ? `<em>${fmtI(D.FL.filter(f => f.sev >= 2).length)}</em>` : ''}</button>`).join('')}</nav>
    <div class="side-foot">
      <div>${D && D.latest ? `SAP report <b>${fmtDate(D.latest.date)}</b>` : 'No SAP report loaded'}</div>
      <div>${S.batches.length} MTO request file(s) · ${D ? D.W.size : 0} wells</div>
      <div class="muted">v${VERSION} · ${STORAGE_OK ? 'saved in this browser' : 'storage unavailable'}</div>
    </div>`;
  const wells = D ? [...D.W.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : [];
  const tIcon = st.theme === 'dark' ? 'moon' : st.theme === 'light' ? 'sun' : 'auto';
  const scTxt = { off: 'Local only', ok: 'Synced', pending: 'Unsaved changes', saving: 'Saving...', pulling: 'Updating...', error: 'Offline - will retry' }[Sync.status] || '';
  $('#top').innerHTML = `
    <button class="icon-btn only-m" data-menu aria-label="Menu">${icon('menu')}</button>
    <h1>${esc((VIEWS.find(v => v[0] === S.ui.view) || VIEWS[0])[1])}</h1>
    <div class="scope">
      <label>Well <select data-scope="well"><option value="">All wells (${wells.length})</option>${wells.map(w => `<option value="${esc(w.id)}" ${S.ui.well === w.id ? 'selected' : ''}>${esc(w.id)}${w.name ? ' - ' + esc(w.name.slice(0, 40)) : ''}</option>`).join('')}</select></label>
      <label>Discipline <select data-scope="dept"><option value="">All</option>${DEPTS.map(d => `<option ${S.ui.dept === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    </div>
    <span class="grow"></span>
    <button class="btn sm" data-import>${icon('upload')}<span>Import files</span></button>
    <button id="syncChip" class="sync-chip sc-${Sync.status}" data-sync>${icon('cloud')}<span>${scTxt}</span></button>
    <button class="icon-btn" data-theme-cycle title="Theme: ${st.theme} (click to change)" aria-label="Change theme">${icon(tIcon)}</button>
    <button class="btn sm ${isAdmin() ? 'admin-on' : ''}" data-admin title="${hasPin() ? (ADMIN ? 'Admin unlocked - click to lock' : 'Viewer mode - click to unlock admin') : 'No admin PIN set - everyone can edit'}">${icon(isAdmin() ? 'unlock' : 'lock')}<span>${hasPin() ? (ADMIN ? 'Admin' : 'Viewer') : 'Open'}</span></button>`;
}
function render() {
  applyAppearance(); renderShell();
  const el = $('#view'); el.innerHTML = '';
  const fn = V[S.ui.view] || V.dashboard;
  if (!S.batches.length && !S.snapshots.length && !['sources', 'settings'].includes(S.ui.view)) return V.welcome(el);
  fn(el);
}
document.addEventListener('click', e => {
  const t = e.target;
  const nav = t.closest('[data-nav]'); if (nav) return go(nav.dataset.nav);
  if (t.closest('[data-menu]')) return document.body.classList.toggle('nav-open');
  if (t.closest('[data-import]')) return pickFiles(false);
  if (t.closest('[data-import-folder]')) return pickFiles(true);
  if (t.closest('[data-theme-cycle]')) { const o = ['system', 'light', 'dark']; S.settings.theme = o[(o.indexOf(S.settings.theme) + 1) % 3]; persist(); render(); return toast('Theme: ' + S.settings.theme); }
  if (t.closest('[data-admin]')) return adminToggle();
  if (t.closest('[data-sync]')) { if (!Sync.on()) return go('settings'); Sync.setStatus('pulling'); return Sync.pull({ verbose: true }).then(() => Sync.dirty && Sync.push()); }
  const gw = t.closest('[data-gowell]'); if (gw) { e.preventDefault(); return go('wells', { wellOpen: gw.dataset.gowell }); }
  const gv = t.closest('[data-goview]'); if (gv) { e.preventDefault(); const ex = gv.dataset.extra ? JSON.parse(gv.dataset.extra) : null; if (ex && ex.grid) { const g = GRIDS[ex.grid] || (GRIDS[ex.grid] = { q: '', f: {}, sort: null, dir: 1, page: 0, sel: new Set(), quick: 0, size: 50 }); if (ex.quick != null) g.quick = ex.quick; if (ex.f) g.f = ex.f; delete ex.grid; delete ex.quick; delete ex.f; } return go(gv.dataset.goview, ex); }
});
document.addEventListener('change', e => { const s = e.target.closest('[data-scope]'); if (s) { S.ui[s.dataset.scope] = s.value; if (s.dataset.scope === 'well' && S.ui.view === 'wells') S.ui.wellOpen = s.value; persist(); render(); } });

/* ---------------- admin ---------------- */
function adminToggle() {
  if (!hasPin()) return openModal({ title: 'Admin access', body: `<p>No admin PIN is set, so anyone who opens this file can import, edit and delete data.</p><p>Set a PIN in <b>Settings & Admin</b> to lock editing. Viewers can still browse and export.</p>`, actions: [{ label: 'Close' }, { label: 'Set a PIN now', primary: true, onClick: () => { go('settings'); } }] });
  if (ADMIN) { ADMIN = false; try { sessionStorage.removeItem('atnm_admin'); } catch (e) { } render(); return toast('Admin locked. Viewer mode.'); }
  askPin(() => { render(); });
}
function askPin(then) {
  openModal({
    title: 'Unlock admin', body: `<label class="fld"><span>Admin PIN / password</span><input type="password" id="pinIn" autocomplete="current-password"></label><p class="muted small">Client-side lock for this file. It stops casual edits; it is not server security.</p>`,
    actions: [{ label: 'Cancel' }, { label: 'Unlock', primary: true, onClick: () => { const v = $('#pinIn').value; if (sha256('atnm|' + v) === S.settings.adminHash) { ADMIN = true; try { sessionStorage.setItem('atnm_admin', S.settings.adminHash); } catch (e) { } audit('Admin unlock', ''); persist(); toast('Admin unlocked', 'ok'); then && then(); return true; } toast('Wrong PIN', 'bad'); return false; } }],
    onMount: m => m.querySelector('#pinIn').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('[data-act="1"]').click(); })
  });
}
function needAdmin(then) { if (isAdmin()) { then && then(); return true; } askPin(() => { render(); then && then(); }); return false; }

/* ---------------- welcome ---------------- */
V.welcome = el => {
  el.innerHTML = `<section class="welcome card">
    ${S.settings.logo && S.settings.showLogo ? `<img src="${S.settings.logo}" alt="" class="w-logo">` : ''}
    <h2>${esc(S.settings.title)}</h2>
    <p>Load the Excel files parked in the VPS folder. The tracker detects each file type by its headers:</p>
    <ul class="ticks">
      <li><b>MTO / STO PO request</b> (e.g. <code>STO PO REQUEST NIMR_37856_19.10.26 - Request.xlsx</code>) - what site requested, per well and discipline.</li>
      <li><b>SAP STO report</b> (e.g. <code>STO-13-11-2026 - SAP Report recieved.XLSX</code>) - what was raised, approved, issued or is still pending.</li>
      <li>Optional: <b>engineering MTO</b> (design take-off per WBS) and <b>P.O with work orders</b> (Service PO to location lookup).</li>
    </ul>
    <div class="drop" data-drop>${icon('upload', 'big')}<b>Drop Excel files here</b><span>or</span>
      <div class="row-btns"><button class="btn primary" data-import-folder>${icon('folder')}Load VPS folder</button><button class="btn" data-import>${icon('file')}Choose files</button></div></div>
    <p class="muted small">Data stays in this browser (IndexedDB). Use <b>Settings & Admin → Backup</b> to save a .json copy to Google Drive or GitHub.</p></section>`;
  bindDrop(el);
};

/* ---------------- dashboard ---------------- */
V.dashboard = el => {
  const REC = D.REC.filter(inScope), STO = D.STO.filter(inScope), AG = D.AG.filter(inScope), FL = D.FL.filter(inScope);
  const bs = D.batchesSorted.filter(b => !S.ui.well || b.lines.some(l => l.wellId === S.ui.well));
  const batch = bs.find(b => b.id === S.ui.batch) || bs[bs.length - 1];
  const BR = batch ? REC.filter(r => r.batchId === batch.id) : [];
  const openSto = STO.filter(l => l.open), pendSto = STO.filter(l => l.group === 'pending');
  const cnt = (a, g) => a.filter(r => r.group === g).length;
  const grpParts = rows => [
    { label: 'Not raised / earlier STO', value: rows.filter(r => r.stage === 'NOT_RAISED' || r.stage === 'PRIOR_PENDING').length, color: GC.notraised },
    { label: 'Pending PE approval', value: rows.filter(r => r.group === 'pending' && r.stage !== 'NOT_RAISED' && r.stage !== 'PRIOR_PENDING').length, color: GC.pending },
    { label: 'Approved, not issued', value: cnt(rows, 'approved'), color: GC.approved },
    { label: 'Issued / received', value: cnt(rows, 'issued'), color: GC.issued },
    { label: 'Cancelled', value: cnt(rows, 'cancelled'), color: GC.cancelled }];
  const already = BR.filter(r => r.flags.some(f => f.code === 'ALREADY_REQ'));
  const dbl = FL.filter(f => ['SAP_DOUBLE', 'SAME_DAY', 'DUP_OPEN', 'OVER_RAISED', 'DUP_IN_MTO'].includes(f.code));
  const balRows = AG.filter(a => a.balance > EPS);
  const uomQty = rows => { const m = {}; for (const r of rows) { const u = r.uom || '-'; m[u] = (m[u] || 0) + r.q; } return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([u, q]) => `<span class="uq">${fmt(q)} <small>${esc(u)}</small></span>`).join(''); };
  const kpi = (label, value, sub, tone, link) => `<div class="kpi ${tone || ''} ${link ? 'click' : ''}" ${link || ''}><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const ln = (view, extra) => `data-goview="${view}" ${extra ? `data-extra='${JSON.stringify(extra)}'` : ''}`;

  /* aging buckets of pending SAP lines */
  const ag = [[0, 7, '0-7 d'], [8, 14, '8-14 d'], [15, 30, '15-30 d'], [31, 60, '31-60 d'], [61, 1e9, '60+ d']].map(([a, b, l], i) => ({ label: l, value: pendSto.filter(x => x.age != null && x.age >= a && x.age <= b).length, color: ['var(--s-received)', 'var(--s-delivery)', 'var(--s-pending)', 'var(--s-prior)', 'var(--s-notraised)'][i] }));
  /* stage donut */
  const stCount = {}; for (const l of STO) stCount[l.stage] = (stCount[l.stage] || 0) + 1;
  const dParts = Object.keys(STAGES).filter(k => stCount[k]).map(k => ({ label: STAGES[k].short, value: stCount[k], color: stageColor(k) }));
  /* top wells */
  const wOpen = {}; for (const l of openSto) wOpen[l.wellId] = (wOpen[l.wellId] || 0) + 1;
  const topW = Object.entries(wOpen).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, v]) => ({ label: w, sub: ((D.W.get(w) || {}).name || '').slice(0, 34), value: v, attr: `data-gowell="${esc(w)}"`, color: 'var(--primary)' }));
  /* discipline */
  const depRows = DEPTS.map(d => { const r = AG.filter(a => a.dept === d); return { d, n: r.length, done: r.filter(a => a.balance <= EPS).length, nr: r.filter(a => a.notRaised > EPS).length, pe: r.filter(a => a.balance > EPS && a.notRaised <= EPS && a.pendingPE > EPS).length, ap: r.filter(a => a.balance > EPS && a.notRaised <= EPS && a.pendingPE <= EPS).length }; }).filter(x => x.n);
  /* requesters */
  const rq = {}; for (const l of openSto) rq[l.reqBy || '-'] = (rq[l.reqBy || '-'] || 0) + 1;
  const rqItems = Object.entries(rq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: k, value: v, color: 'var(--accent)' }));

  el.innerHTML = `
  <div class="asof">${icon('info')} Scope: <b>${esc(scopeLabel())}</b> · SAP report <b>${D.latest ? fmtDate(D.latest.date) : 'not loaded'}</b>${D.movement ? ` · since ${fmtDate(D.movement.from)}: <b>${fmtI(D.movement.closed)}</b> lines closed, <b>${fmtI(D.movement.added)}</b> new, <b>${fmtI(D.movement.changed)}</b> status changes` : ''}</div>
  <div class="kpis">
    ${kpi('Open SAP STO lines', fmtI(openSto.length), `${fmtI(pendSto.length)} pending PE · ${fmtI(openSto.length - pendSto.length)} approved`, '', ln('sto', { grid: 'sto', quick: 1 }))}
    ${kpi('MTO lines tracked', fmtI(REC.length), `${S.batches.length} request file(s)`, '', ln('recon'))}
    ${kpi('Outstanding materials', fmtI(balRows.length), `of ${fmtI(AG.length)} well x material lines`, 'warn', ln('pending'))}
    ${kpi('Not raised in SAP', fmtI(AG.filter(a => a.notRaised > EPS).length), 'need a new STO', 'bad', ln('pending', { grid: 'pending', quick: 1 }))}
    ${kpi('Double entries', fmtI(uniq(dbl.map(f => f.wellId + '|' + f.material)).length), 'materials raised / listed twice', 'bad', ln('flags'))}
    ${kpi('Already requested', fmtI(uniq(FL.filter(f => f.code === 'ALREADY_REQ').map(f => f.wellId + '|' + f.material)).length), 're-requested while earlier STO open', 'warn', ln('flags'))}
    ${kpi('Wells', fmtI(uniq(AG.map(a => a.wellId)).length), `${fmtI(uniq(openSto.map(l => l.wellId)).length)} with open STOs`, '', ln('wells', { wellOpen: '' }))}
  </div>
  <div class="cards c2">
    <section class="card">
      <div class="card-h"><h2>Last MTO request</h2>${bs.length ? `<select data-dbatch aria-label="Choose MTO request">${bs.slice().reverse().map(b => `<option value="${esc(b.id)}" ${batch && b.id === batch.id ? 'selected' : ''}>${fmtDate(b.date)} · ${esc(uniq(b.lines.map(l => l.wellId)).join(', '))} · ${b.lines.length} lines</option>`).join('')}</select>` : ''}</div>
      ${batch ? `<p class="muted small">${esc(batch.file)}</p>
      ${stackBar(grpParts(BR), { height: 18 })}
      <table class="mini"><thead><tr><th>Discipline</th><th class="num">Lines</th><th class="num">Not raised</th><th class="num">Pending PE</th><th class="num">Approved</th><th class="num">Issued</th><th class="num">Open qty</th></tr></thead><tbody>
      ${uniq(BR.map(r => r.dept)).sort().map(d => { const r = BR.filter(x => x.dept === d); return `<tr><td>${deptDot(d)}</td><td class="num">${r.length}</td><td class="num">${r.filter(x => x.stage === 'NOT_RAISED' || x.stage === 'PRIOR_PENDING').length}</td><td class="num">${r.filter(x => x.stage === 'PENDING_PE' || x.stage === 'ON_HOLD').length}</td><td class="num">${cnt(r, 'approved')}</td><td class="num">${cnt(r, 'issued')}</td><td class="num">${uomQty(r.map(x => ({ uom: x.uom, q: x.open })))}</td></tr>`; }).join('')}
      </tbody></table>
      <div class="callouts">
        ${already.length ? `<div class="callout warn">${icon('flag')}<div><b>${already.length} line(s) already requested</b> - still open in an earlier STO, re-requested in this MTO.</div></div>` : ''}
        ${BR.filter(r => r.flags.some(f => f.code === 'SAP_DOUBLE')).length ? `<div class="callout bad">${icon('flag')}<div><b>${BR.filter(r => r.flags.some(f => f.code === 'SAP_DOUBLE')).length} line(s) double-entered in SAP</b> for this MTO (raised in more than one STO or above the requested qty).</div></div>` : ''}
        ${BR.filter(r => r.flags.some(f => f.code === 'DUP_IN_MTO')).length ? `<div class="callout warn">${icon('flag')}<div><b>${BR.filter(r => r.flags.some(f => f.code === 'DUP_IN_MTO')).length} line(s) repeat a material</b> inside the same MTO.</div></div>` : ''}
      </div>
      <div class="row-btns"><button class="btn primary sm" data-dexport="${esc(batch.id)}">${icon('download')}Export pending of this MTO (MTO format)</button><button class="btn sm" ${ln('recon', { batch: batch.id })}>Open reconciliation</button></div>`
      : '<p class="muted">No MTO request loaded yet.</p>'}
    </section>
    <section class="card"><div class="card-h"><h2>Insights</h2></div><ul class="insights">${insights(REC, STO, AG, FL, batch, BR).map(i => `<li class="${i.tone}">${i.html}</li>`).join('') || '<li>No issues found in the current scope.</li>'}</ul></section>
  </div>
  <div class="cards c3">
    <section class="card"><div class="card-h"><h2>SAP STO lines by stage</h2></div>${donut(dParts, { center: fmtI(STO.length), sub: 'STO lines' })}</section>
    <section class="card"><div class="card-h"><h2>Pending PE - ageing</h2><small>${fmtI(pendSto.length)} lines, as of ${fmtDate(D.asOf)}</small></div>${columnsChart(ag)}</section>
    <section class="card"><div class="card-h"><h2>Outstanding by discipline</h2><small>well x material lines</small></div>
      ${depRows.map(x => `<div class="dep-row"><div class="dep-h">${deptDot(x.d)}<small>${x.done}/${x.n} complete</small></div>${stackBar([{ label: 'Not raised', value: x.nr, color: GC.notraised }, { label: 'Pending PE', value: x.pe, color: GC.pending }, { label: 'Approved', value: x.ap, color: GC.approved }, { label: 'Complete', value: x.done, color: GC.issued }], { legend: false, height: 12 })}</div>`).join('') || '<p class="muted">No data.</p>'}
      <div class="legend">${[['Not raised', GC.notraised], ['Pending PE', GC.pending], ['Approved', GC.approved], ['Complete', GC.issued]].map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div></section>
  </div>
  <div class="cards c2">
    <section class="card"><div class="card-h"><h2>Wells with most open STO lines</h2><small>click a well</small></div>${barsH(topW)}</section>
    <section class="card"><div class="card-h"><h2>Open STO lines by requester</h2></div>${barsH(rqItems)}
      <h3 class="mt">Open quantity by unit</h3><div class="uqs">${uomQty(openSto.map(l => ({ uom: l.uom, q: l.qty })))}</div></section>
  </div>`;
  const sel = el.querySelector('[data-dbatch]'); if (sel) sel.onchange = () => { S.ui.batch = sel.value; persist(); render(); };
  const ex = el.querySelector('[data-dexport]'); if (ex) ex.onclick = () => openMtoExport({ rows: D.REC.filter(r => r.batchId === ex.dataset.dexport && inScope(r)), kind: 'rec', title: 'Pending of MTO ' + fmtDate(batch.date) });
};
function insights(REC, STO, AG, FL, batch, BR) {
  const out = []; const add = (tone, html) => out.push({ tone, html });
  if (batch) {
    const iss = BR.filter(r => r.group === 'issued').length, ap = BR.filter(r => r.group === 'approved').length, nr = BR.filter(r => r.stage === 'NOT_RAISED').length, pe = BR.filter(r => r.stage === 'PENDING_PE').length, pr = BR.filter(r => r.stage === 'PRIOR_PENDING').length;
    add('info', `MTO <b>${fmtDate(batch.date)}</b>: ${BR.length} lines - <b>${iss}</b> issued, <b>${ap}</b> approved, <b>${pe}</b> pending PE, <b>${nr}</b> not raised in SAP${pr ? `, <b>${pr}</b> waiting under an earlier STO` : ''}.`);
    const nrD = {}; BR.filter(r => r.stage === 'NOT_RAISED').forEach(r => nrD[r.dept] = (nrD[r.dept] || 0) + 1);
    const nrS = Object.entries(nrD).sort((a, b) => b[1] - a[1]); if (nrS.length) add('bad', `Not raised in SAP by discipline: ${nrS.map(([d, n]) => `${esc(d)} <b>${n}</b>`).join(', ')}. These need an STO or the PE's decision.`);
  }
  const ar = FL.filter(f => f.code === 'ALREADY_REQ'); if (ar.length) add('warn', `<b>${uniq(ar.map(f => f.wellId + '|' + f.material)).length}</b> material(s) were requested again while an earlier STO for the same well is still open. Do not count them as new demand.`);
  const dup = STO.filter(l => l.flags.some(f => f.code === 'SAME_DAY')); if (dup.length) { const q = {}; dup.forEach(l => q[l.uom] = (q[l.uom] || 0) + l.qty); add('bad', `<b>${uniq(dup.map(l => l.wellId + '|' + l.material)).length}</b> material(s) raised more than once on the same day (${uniq(dup.map(l => l.sto)).length} STOs). Ask the PE to cancel the duplicate STO lines.`); }
  const ov = AG.filter(a => a.flagMap.has('OVER_RAISED')); if (ov.length) add('bad', `<b>${ov.length}</b> well x material line(s) have more open qty in SAP than is still outstanding - likely duplicates.`);
  const aged = STO.filter(l => l.group === 'pending' && l.age > S.settings.agedDays); if (aged.length) { const o = aged.reduce((a, b) => (b.age > a.age ? b : a)); add('warn', `<b>${fmtI(aged.length)}</b> STO lines pending PE for more than ${S.settings.agedDays} days. Oldest: STO ${esc(o.sto)} (${o.age} days, well ${esc(o.wellId)}).`); }
  const open = STO.filter(l => l.open); if (open.length) { const w = {}; open.forEach(l => w[l.wellId] = (w[l.wellId] || 0) + 1); const t = Object.entries(w).sort((a, b) => b[1] - a[1])[0]; add('info', `Most open STO lines: well <a href="#" data-gowell="${esc(t[0])}">${esc(t[0])}</a> with <b>${fmtI(t[1])}</b> lines.`); }
  const ls = REC.filter(r => r.flags.some(f => f.code === 'LOW_STOCK') && r.group === 'pending'); if (ls.length) add('info', `<b>${ls.length}</b> pending MTO line(s) had SAP stock below the requested qty at request time - may need procurement.`);
  return out;
}

/* ---------------- MTO reconciliation ---------------- */
const recCols = () => [
  { k: 'batchDate', label: 'MTO date', val: r => r.batchDate, html: r => fmtDate(r.batchDate), filter: false, xw: 11 },
  { k: 'sr', label: 'Sr', val: r => r.sr, num: false, xw: 5 },
  { k: 'wellId', label: 'Well', val: r => r.wellId, filter: true, xw: 8 },
  { k: 'dept', label: 'Discipline', val: r => r.dept, filter: true, html: r => deptDot(r.dept), xw: 11 },
  { k: 'material', label: 'Material', val: r => r.material, cls: 'mono', xw: 12 },
  { k: 'desc', label: 'Description', val: r => r.desc, cls: 'wrap', w: '220px', xw: 40 },
  { k: 'uom', label: 'UoM', val: r => r.uom, xw: 6 },
  { k: 'reqQty', label: 'Requested', val: r => r.reqQty, num: true },
  { k: 'sapQty', label: 'SAP stock', val: r => r.sapQty, num: true, title: 'SAP stock quantity shown in the request file' },
  { k: 'raised', label: 'Raised (STO)', val: r => r.raised, num: true, title: 'Total raised in SAP for this MTO (all lines of this material)' },
  { k: 'issued', label: 'Issued', val: r => r.issued, num: true },
  { k: 'approved', label: 'Approved', val: r => r.approved, num: true },
  { k: 'pendingPE', label: 'Pending PE', val: r => r.pendingPE, num: true },
  { k: 'notRaised', label: 'Not raised', val: r => r.notRaised, num: true },
  { k: 'open', label: 'Open qty', val: r => r.open, num: true, html: r => `<b>${fmt(r.open)}</b>` },
  { k: 'stage', label: 'Status', val: r => STAGES[r.stage].short, filter: true, html: r => stageBadge(r.stage) + (r.manual ? '<span class="chip man" title="Manually set">M</span>' : ''), xw: 16 },
  { k: 'flags', label: 'Flags', val: r => r.flags.map(f => FLAGS[f.code].label).join('; '), html: r => flagChips(r.flags, 2), w: '160px', xw: 40 },
  { k: 'stoNos', label: 'STO(s)', val: r => r.stoNos.join(', '), cls: 'mono small', xw: 14 },
  { k: 'reason', label: 'Pending reason', val: r => r.group === 'issued' ? '' : r.reason, xw: 22 },
  { k: 'remarks', label: 'Remarks', val: r => r.remarks, cls: 'wrap', xw: 25 }
];
V.recon = el => {
  const bs = D.batchesSorted.filter(b => !S.ui.well || b.lines.some(l => l.wellId === S.ui.well));
  const cur = S.ui.batch === '__all' ? '__all' : (bs.find(b => b.id === S.ui.batch) || bs[bs.length - 1] || {}).id;
  const rows = D.REC.filter(r => inScope(r) && (cur === '__all' || r.batchId === cur));
  el.innerHTML = `<div class="bar"><label>MTO request <select data-rbatch><option value="__all" ${cur === '__all' ? 'selected' : ''}>All MTO requests (${bs.length})</option>${bs.slice().reverse().map(b => `<option value="${esc(b.id)}" ${b.id === cur ? 'selected' : ''}>${fmtDate(b.date)} · ${esc(b.file)}</option>`).join('')}</select></label>
    <span class="muted small">Each request line is matched to SAP STO lines of the same well and material raised on or after the MTO date (${S.settings.windowBefore}-day tolerance). Click a row for detail or to edit.</span></div>
    <div data-g></div>`;
  el.querySelector('[data-rbatch]').onchange = e => { S.ui.batch = e.target.value; persist(); render(); };
  mountGrid(el.querySelector('[data-g]'), 'recon', {
    rows, columns: recCols(), rowKey: r => r.id, noun: 'MTO lines', exportName: 'MTO Reconciliation', selectable: true, onRow: r => recDrawer(r.id),
    rowClass: r => r.flags.some(f => f.sev >= 3) ? 'hl-bad' : (r.flags.some(f => f.sev === 2) ? 'hl-warn' : ''),
    quick: [{ label: 'All' }, { label: 'Open', fn: r => r.open > EPS }, { label: 'Not raised', fn: r => r.stage === 'NOT_RAISED' || r.stage === 'PRIOR_PENDING' }, { label: 'Pending PE', fn: r => r.stage === 'PENDING_PE' }, { label: 'Approved', fn: r => r.group === 'approved' }, { label: 'Issued', fn: r => r.group === 'issued' }, { label: 'Flagged', fn: r => r.flags.some(f => f.sev >= 2) }],
    tools: `<button class="btn sm primary" data-rx>${icon('download')}MTO format</button><button class="btn sm" data-rxe>${icon('file')}Engineering MTO</button>`,
    bulk: [{ label: 'Set status...', admin: true, fn: sel => bulkStage(sel) }, { label: 'Set reason...', admin: true, fn: sel => bulkReason(sel) }, { label: 'Export selected (MTO format)', fn: sel => openMtoExport({ rows: sel, kind: 'rec', title: 'Selected MTO lines' }) }]
  });
  el.querySelector('[data-rx]').onclick = () => openMtoExport({ rows: GRIDS.recon.last, kind: 'rec', title: 'MTO reconciliation (filtered view)' });
  el.querySelector('[data-rxe]').onclick = () => openEngExport(GRIDS.recon.last.map(recToX));
};
function bulkStage(sel) {
  if (!needAdmin()) return;
  openModal({ title: `Set status for ${sel.length} line(s)`, body: `<label class="fld"><span>Status</span><select id="bs"><option value="">Automatic (from SAP)</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: () => { const v = $('#bs').value; for (const r of sel) { const e = S.edits.req[r.id] || (S.edits.req[r.id] = {}); if (v) e.stage = v; else delete e.stage; e.at = Date.now(); } audit('Bulk status', `${sel.length} MTO lines -> ${v || 'auto'}`); commit(); toast('Updated ' + sel.length + ' lines', 'ok'); } }] });
}
function bulkReason(sel) {
  if (!needAdmin()) return;
  openModal({ title: `Set pending reason for ${sel.length} line(s)`, body: `<label class="fld"><span>Reason</span><select id="br">${REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: () => { const v = $('#br').value; for (const r of sel) { const e = S.edits.req[r.id] || (S.edits.req[r.id] = {}); e.reason = v; e.at = Date.now(); } audit('Bulk reason', `${sel.length} lines -> ${v}`); commit(); } }] });
}
function commit() { rebuild(); persist(); render(); }

function recDrawer(id) {
  const r = D.REC.find(x => x.id === id); if (!r) return;
  const e = S.edits.req[id] || {}; const adm = isAdmin();
  const b = S.batches.find(x => x.id === r.batchId); const line = b.lines.find(l => l.id === id);
  const F = [['material', 'Material'], ['desc', 'Description'], ['uom', 'UoM'], ['reqQty', 'Request Qty'], ['sapQty', 'SAP QTY'], ['wellId', 'Well ID'], ['dept', 'Department'], ['constWBS', 'Construction WBS'], ['wellType', 'Well Type'], ['plant', 'Plant'], ['sloc', 'Sloc'], ['batch', 'Batch'], ['valType', 'Val.Type'], ['procWBS', 'Procurement WBS'], ['docHeader', 'Document header text'], ['ramzId', 'RAMZ ID'], ['servicePO', 'Service PO'], ['stoPO', 'STO PO NO'], ['postingStatus', 'POSTING STATUS'], ['col1', 'Column1']];
  const stoTable = (arr, empty) => arr.length ? `<table class="mini"><thead><tr><th>STO / item</th><th>Date</th><th class="num">Qty</th><th>SAP status</th><th>Stage</th></tr></thead><tbody>${arr.map(x => `<tr class="click" data-sto="${esc(x.key)}"><td class="mono">${esc(x.sto)}/${esc(x.item)}</td><td>${fmtDate(x.reqOn)}</td><td class="num">${fmt(x.qty)} ${esc(x.uom)}</td><td>${esc(x.status)}</td><td>${stageBadge(x.stage)}</td></tr>`).join('')}</tbody></table>` : `<p class="muted small">${empty}</p>`;
  openDrawer(`${r.material} - ${r.desc}`, `
    <div class="d-sum">${stageBadge(r.stage)} ${deptDot(r.dept)} <span class="muted">Well <a href="#" data-gowell="${esc(r.wellId)}">${esc(r.wellId)}</a> · MTO ${fmtDate(r.batchDate)} · Sr ${esc(r.sr)}</span></div>
    <div class="qgrid">${[['Requested', r.reqQty], ['Raised', r.raised], ['Issued', r.issued], ['Approved', r.approved], ['Pending PE', r.pendingPE], ['Not raised', r.notRaised], ['Open', r.open]].map(([l, v]) => `<div><small>${l}</small><b>${fmt(v)}</b></div>`).join('')}</div>
    ${r.flags.length ? `<div class="flaglist">${r.flags.map(f => `<div class="callout ${(FLAGS[f.code] || {}).tone}"><b>${esc(FLAGS[f.code].label)}</b><span>${esc(f.text)}</span></div>`).join('')}</div>` : ''}
    <h4>Tracking ${adm ? '' : '<span class="muted small">(admin only)</span>'}</h4>
    <div class="form2">
      <label class="fld"><span>Status override</span><select id="eStage" ${adm ? '' : 'disabled'}><option value="">Automatic - ${esc(STAGES[r.autoStage].label)}</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}" ${e.stage === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label class="fld"><span>Issued qty (manual)</span><input id="eIss" type="number" step="any" value="${e.issuedQty ?? ''}" placeholder="auto ${fmt(r.autoIssued)}" ${adm ? '' : 'disabled'}></label>
      <label class="fld"><span>Approved qty (manual)</span><input id="eApp" type="number" step="any" value="${e.approvedQty ?? ''}" placeholder="auto" ${adm ? '' : 'disabled'}></label>
      <label class="fld"><span>Pending reason</span><input id="eReason" list="reasons" value="${esc(e.reason || '')}" placeholder="${esc(r.reason)}" ${adm ? '' : 'disabled'}><datalist id="reasons">${REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</datalist></label>
      <label class="fld span2"><span>Remarks</span><textarea id="eRem" rows="2" ${adm ? '' : 'disabled'}>${esc(e.remarks || '')}</textarea></label>
    </div>
    <h4>SAP STO lines matched to this MTO</h4>${stoTable(r.A, 'No STO line found for this well and material in this MTO window.')}
    <h4>Earlier open STO lines (already requested)</h4>${stoTable(r.P, 'None.')}
    <details ${adm ? '' : ''}><summary>Request line data (as imported${adm ? ', editable' : ''})</summary>
      <div class="form2">${F.map(([k, l]) => `<label class="fld"><span>${l}</span><input data-lf="${k}" value="${esc(line[k] ?? '')}" ${adm ? '' : 'disabled'}></label>`).join('')}</div></details>
    ${adm ? `<div class="row-btns sticky-foot"><button class="btn primary" data-save>Save</button><button class="btn" data-reset>Reset to automatic</button><span class="grow"></span><button class="btn danger" data-del>${icon('trash')}Delete line</button></div>` : ''}`,
    d => {
      d.addEventListener('click', ev => { const s = ev.target.closest('[data-sto]'); if (s) stoDrawer(s.dataset.sto); });
      if (!adm) return;
      d.querySelector('[data-save]').onclick = () => {
        const ne = { stage: $('#eStage').value || undefined, issuedQty: $('#eIss').value === '' ? undefined : num($('#eIss').value), approvedQty: $('#eApp').value === '' ? undefined : num($('#eApp').value), reason: $('#eReason').value.trim() || undefined, remarks: $('#eRem').value.trim() || undefined };
        Object.keys(ne).forEach(k => ne[k] === undefined && delete ne[k]);
        if (Object.keys(ne).length) S.edits.req[id] = Object.assign(ne, { at: Date.now() }); else delete S.edits.req[id];
        let changed = [];
        $$('[data-lf]', d).forEach(inp => { const k = inp.dataset.lf; let v = inp.value.trim(); if (k === 'reqQty') v = num(v); else if (k === 'sapQty') v = v === '' ? null : num(v); else if (k === 'material') v = normMat(v); else if (k === 'wellId') v = normWell(v); else if (k === 'dept') v = normDept(v); if (String(line[k] ?? '') !== String(v ?? '')) { changed.push(k); line[k] = v; } });
        audit('Edit MTO line', `${r.wellId} ${r.material} Sr ${r.sr}${changed.length ? ' fields: ' + changed.join(',') : ''}`);
        closeDrawer(); commit(); toast('Saved', 'ok');
      };
      d.querySelector('[data-reset]').onclick = () => { delete S.edits.req[id]; audit('Reset MTO line', id); closeDrawer(); commit(); };
      d.querySelector('[data-del]').onclick = () => confirmBox('Delete MTO line', `Delete Sr ${esc(r.sr)} (${esc(r.material)}) from ${esc(b.file)}? This cannot be undone except by re-importing the file.`, 'Delete', () => { b.lines = b.lines.filter(l => l.id !== id); b.modified = Date.now(); delete S.edits.req[id]; audit('Delete MTO line', id); closeDrawer(); commit(); });
    });
}

/* ---------------- pending register ---------------- */
const agCols = (withWell = true) => [
  ...(withWell ? [{ k: 'wellId', label: 'Well', val: a => a.wellId, filter: true, html: a => `<a href="#" data-gowell="${esc(a.wellId)}">${esc(a.wellId)}</a>`, xw: 8 }] : []),
  { k: 'dept', label: 'Discipline', val: a => a.dept, filter: true, html: a => deptDot(a.dept), xw: 11 },
  { k: 'material', label: 'Material', val: a => a.material, cls: 'mono', xw: 12 },
  { k: 'desc', label: 'Description', val: a => a.desc, cls: 'wrap', w: '220px', xw: 40 },
  { k: 'uom', label: 'UoM', val: a => a.uom, xw: 6 },
  { k: 'design', label: 'Design MTO', val: a => a.design, num: true, title: 'Quantity in the engineering MTO, if loaded' },
  { k: 'required', label: 'Net required', val: a => a.required, num: true, title: 'MTO requested quantity; re-requests of still-open items are not added again (Settings)' },
  { k: 'raised', label: 'Raised in SAP', val: a => a.raised, num: true },
  { k: 'issuedEff', label: 'Issued', val: a => a.issuedEff, num: true },
  { k: 'approved', label: 'Approved', val: a => a.approved, num: true },
  { k: 'pendingPE', label: 'Pending PE', val: a => a.pendingPE, num: true },
  { k: 'notRaised', label: 'Not raised', val: a => a.notRaised, num: true, html: a => a.notRaised > EPS ? `<b class="t-bad">${fmt(a.notRaised)}</b>` : fmt(a.notRaised) },
  { k: 'balance', label: 'Balance', val: a => a.balance, num: true, html: a => `<b>${fmt(a.balance)}</b>` },
  { k: 'excess', label: 'Excess in SAP', val: a => a.excess, num: true, html: a => a.excess > EPS ? `<b class="t-bad">${fmt(a.excess)}</b>` : '' },
  { k: 'mtoCount', label: '# MTOs', val: a => a.mtoCount, num: true },
  { k: 'openStos', label: 'Open STOs', val: a => [...a.openStos].join(', '), cls: 'mono small', xw: 16 },
  { k: 'first', label: 'First requested', val: a => a.first, html: a => fmtDate(a.first) },
  { k: 'oldestAge', label: 'Oldest pending (d)', val: a => a.oldestAge, num: true },
  { k: 'status', label: 'Status', val: a => a.status, filter: true, html: a => `<span class="badge s-${statusTone(a.status)}">${esc(a.status)}</span>` },
  { k: 'flags', label: 'Flags', val: a => a.flags.map(f => FLAGS[f.code].label).join('; '), html: a => flagChips(a.flags, 2), w: '160px', xw: 40 }
];
V.pending = el => {
  const rows = D.AG.filter(a => inScope(a) && (a.balance > EPS || a.pendingPE + a.approved > EPS));
  el.innerHTML = `<div class="bar"><span class="muted small">One row per well and material. <b>Balance</b> = net required - issued. <b>Not raised</b> = balance not covered by any open STO. <b>Excess in SAP</b> = open STO qty above the balance (double entry).</span></div><div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'pending', {
    rows, columns: agCols(), rowKey: a => a.key, noun: 'pending items', exportName: 'Pending Register', selectable: true, onRow: a => agDrawer(a.key),
    rowClass: a => a.flags.some(f => f.sev >= 3) ? 'hl-bad' : '',
    quick: [{ label: 'All' }, { label: 'Not raised', fn: a => a.notRaised > EPS }, { label: 'Pending PE', fn: a => a.pendingPE > EPS }, { label: 'Approved', fn: a => a.approved > EPS }, { label: 'Excess / duplicate', fn: a => a.excess > EPS || a.flags.some(f => f.sev >= 3) }, { label: 'Already requested', fn: a => a.flagMap.has('ALREADY_REQ') }],
    tools: `<button class="btn sm primary" data-px>${icon('download')}MTO format</button><button class="btn sm" data-pxe>${icon('file')}Engineering MTO</button>`,
    bulk: [{ label: 'Export selected (MTO format)', fn: sel => openMtoExport({ rows: sel, kind: 'ag', title: 'Selected pending items' }) }]
  });
  el.querySelector('[data-px]').onclick = () => openMtoExport({ rows: GRIDS.pending.last, kind: 'ag', title: 'Pending register (filtered view)' });
  el.querySelector('[data-pxe]').onclick = () => openEngExport(GRIDS.pending.last.map(agToX));
};
function agDrawer(key) {
  const a = D.AGmap.get(key); if (!a) return;
  openDrawer(`${a.material} - ${a.desc}`, `
    <div class="d-sum"><span class="badge s-${statusTone(a.status)}">${esc(a.status)}</span> ${deptDot(a.dept)} <span class="muted">Well <a href="#" data-gowell="${esc(a.wellId)}">${esc(a.wellId)}</a> ${esc(a.wellName)}</span></div>
    <div class="qgrid">${[['Design', a.design], ['Net required', a.required], ['Raised', a.raised], ['Issued', a.issuedEff], ['Approved', a.approved], ['Pending PE', a.pendingPE], ['Not raised', a.notRaised], ['Balance', a.balance], ['Excess', a.excess]].map(([l, v]) => `<div><small>${l}</small><b>${v == null ? '-' : fmt(v)}</b></div>`).join('')}</div>
    ${a.flags.length ? `<div class="flaglist">${a.flags.map(f => `<div class="callout ${(FLAGS[f.code] || {}).tone}"><b>${esc(FLAGS[f.code].label)}</b><span>${esc(f.text)}</span></div>`).join('')}</div>` : ''}
    <h4>MTO request lines</h4>${a.recLines.length ? `<table class="mini"><thead><tr><th>MTO</th><th>Sr</th><th class="num">Req</th><th class="num">Open</th><th>Status</th></tr></thead><tbody>${a.recLines.map(r => `<tr class="click" data-rec="${esc(r.id)}"><td>${fmtDate(r.batchDate)}</td><td>${esc(r.sr)}</td><td class="num">${fmt(r.reqQty)}</td><td class="num">${fmt(r.open)}</td><td>${stageBadge(r.stage)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Not in any uploaded MTO request (SAP only).</p>'}
    <h4>SAP STO lines</h4>${a.stoLines.length ? `<table class="mini"><thead><tr><th>STO / item</th><th>Date</th><th class="num">Qty</th><th>Stage</th><th class="num">Age</th></tr></thead><tbody>${a.stoLines.map(x => `<tr class="click" data-sto="${esc(x.key)}"><td class="mono">${esc(x.sto)}/${esc(x.item)}</td><td>${fmtDate(x.reqOn)}</td><td class="num">${fmt(x.qty)}</td><td>${stageBadge(x.stage)}</td><td class="num">${x.age ?? ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No STO lines.</p>'}`,
    d => d.addEventListener('click', ev => { const s = ev.target.closest('[data-sto]'); if (s) return stoDrawer(s.dataset.sto); const r = ev.target.closest('[data-rec]'); if (r) recDrawer(r.dataset.rec); }));
}

/* ---------------- SAP STO register ---------------- */
V.sto = el => {
  const rows = D.STO.filter(inScope);
  el.innerHTML = `<div class="bar"><span class="muted small">All STO lines from the SAP report(s)${D.snaps.length > 1 ? `, merged across ${D.snaps.length} reports. Lines missing from the latest report are shown as <b>Closed</b>${S.settings.dropAsClosed ? '' : ' (switched off in Settings)'}` : ''}. Click a row to override status, well or add a note.</span></div><div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'sto', {
    rows, rowKey: l => l.key, noun: 'STO lines', exportName: 'SAP STO Register', selectable: true, onRow: l => stoDrawer(l.key),
    rowClass: l => l.flags.some(f => f.sev >= 3) ? 'hl-bad' : (l.flags.some(f => f.sev === 2) ? 'hl-warn' : ''),
    columns: [
      { k: 'sto', label: 'STO', val: l => l.sto, cls: 'mono', xw: 12 }, { k: 'item', label: 'Item', val: l => l.item, num: true },
      { k: 'reqOn', label: 'Requested on', val: l => l.reqOn, html: l => fmtDate(l.reqOn), xw: 11 }, { k: 'age', label: 'Age (d)', val: l => l.age, num: true },
      { k: 'wellId', label: 'Well', val: l => l.wellId, filter: true, html: l => `<a href="#" data-gowell="${esc(l.wellId)}">${esc(l.wellId)}</a>` },
      { k: 'wellName', label: 'Target WBS description', val: l => l.tgtWBSDesc, cls: 'wrap small', w: '160px', xw: 30 },
      { k: 'dept', label: 'Discipline', val: l => l.dept, filter: true, html: l => deptDot(l.dept) },
      { k: 'material', label: 'Material', val: l => l.material, cls: 'mono', xw: 12 }, { k: 'desc', label: 'Description', val: l => l.desc, cls: 'wrap', w: '200px', xw: 40 },
      { k: 'qty', label: 'Qty', val: l => l.qty, num: true }, { k: 'uom', label: 'UoM', val: l => l.uom },
      { k: 'recv', label: 'Received', val: l => l.recv, num: true },
      { k: 'status', label: 'SAP status', val: l => l.status, filter: true, xw: 24 },
      { k: 'stage', label: 'Stage', val: l => STAGES[l.stage].short, filter: true, html: l => stageBadge(l.stage) + (l.manual ? '<span class="chip man" title="Manually set">M</span>' : '') },
      { k: 'flags', label: 'Flags', val: l => l.flags.map(f => FLAGS[f.code].label).join('; '), html: l => flagChips(l.flags, 2), w: '150px', xw: 40 },
      { k: 'reqBy', label: 'Requested by', val: l => l.reqBy, filter: true }, { k: 'po', label: 'Service PO', val: l => l.po + (l.poItem ? '/' + l.poItem : ''), cls: 'mono small', xw: 14 },
      { k: 'batchNo', label: 'Batch', val: l => l.batchNo }, { k: 'remarks', label: 'Request remarks', val: l => l.remarks, cls: 'small', xw: 28 },
      { k: 'note', label: 'Note', val: l => l.note, cls: 'wrap', xw: 25 }
    ],
    quick: [{ label: 'All' }, { label: 'Open', fn: l => l.open }, { label: 'Pending PE', fn: l => l.group === 'pending' }, { label: 'Approved', fn: l => l.group === 'approved' }, { label: 'Issued / closed', fn: l => l.group === 'issued' }, { label: 'Duplicates', fn: l => l.flags.some(f => ['DUP_OPEN', 'SAME_DAY', 'DUP_IN_STO'].includes(f.code)) }, { label: `Aged > ${S.settings.agedDays} d`, fn: l => l.flags.some(f => f.code === 'AGED') }],
    tools: `<button class="btn sm primary" data-sx>${icon('download')}MTO format</button>`,
    bulk: [{ label: 'Set stage...', admin: true, fn: sel => bulkStoStage(sel) }, { label: 'Export selected (MTO format)', fn: sel => openMtoExport({ rows: sel, kind: 'sto', title: 'Selected STO lines' }) }]
  });
  el.querySelector('[data-sx]').onclick = () => openMtoExport({ rows: GRIDS.sto.last, kind: 'sto', title: 'SAP STO lines (filtered view)' });
};
function bulkStoStage(sel) {
  if (!needAdmin()) return;
  openModal({ title: `Override stage for ${sel.length} STO line(s)`, body: `<label class="fld"><span>Stage</span><select id="bs"><option value="">Automatic (from SAP)</option>${Object.entries(STAGES).filter(([k]) => !['NOT_RAISED', 'PRIOR_PENDING', 'ASSUMED_ISSUED'].includes(k)).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: () => { const v = $('#bs').value; for (const l of sel) { const e = S.edits.sto[l.key] || (S.edits.sto[l.key] = {}); if (v) e.stage = v; else delete e.stage; e.at = Date.now(); } audit('Bulk STO stage', `${sel.length} lines -> ${v || 'auto'}`); commit(); } }] });
}
function stoDrawer(key) {
  const l = D.STO.find(x => x.key === key); if (!l) return; const e = S.edits.sto[key] || {}; const adm = isAdmin();
  const po = PO && PO.map ? PO.map[l.po + '|' + String(num(l.poItem))] : null;
  const F = [['Request STO', l.sto], ['Item', l.item], ['STO type', l.type], ['SAP status', l.status], ['Material', l.material], ['Description', l.desc], ['Qty', fmt(l.qty) + ' ' + l.uom], ['Received / consumed / returned', `${fmt(l.recv)} / ${fmt(l.consumed)} / ${fmt(l.ret)}`], ['Source', `${l.srcPlant} ${l.srcSloc} ${l.srcWBS}`], ['Target', `${l.tgtPlant} ${l.tgtSloc} ${l.tgtWBS}`], ['Target WBS description', l.tgtWBSDesc], ['Batch', l.batchNo], ['Service PO', l.po + '/' + l.poItem], ['RAMZ ID', l.ramz], ['Request remarks', l.remarks], ['Requested by / on', `${l.reqBy} · ${fmtDate(l.reqOn)}`], ['TF doc / delivery / PGI / GR', [l.tfDoc, l.delivery, l.pgiDoc, l.grDoc].map(x => x || '-').join(' / ')], ['First / last seen in report', `${fmtDate(l.firstSeen)} / ${fmtDate(l.lastSeen)}`]];
  if (po) F.push(['PO work order', `${po.loc} · ${po.desc}`]);
  openDrawer(`STO ${l.sto} / ${l.item}`, `
    <div class="d-sum">${stageBadge(l.stage)} ${deptDot(l.dept)} <span class="muted">Well <a href="#" data-gowell="${esc(l.wellId)}">${esc(l.wellId)}</a> · age ${l.age ?? '-'} d</span></div>
    ${l.flags.length ? `<div class="flaglist">${l.flags.map(f => `<div class="callout ${(FLAGS[f.code] || {}).tone}"><b>${esc(FLAGS[f.code].label)}</b><span>${esc(f.text)}</span></div>`).join('')}</div>` : ''}
    <dl class="kv">${F.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <h4>Status history</h4><ul class="hist">${l.history.map(h => `<li>${fmtDate(h.date)} - ${esc(h.status)}</li>`).join('')}</ul>
    <h4>Overrides ${adm ? '' : '<span class="muted small">(admin only)</span>'}</h4>
    <div class="form2">
      <label class="fld"><span>Stage</span><select id="sStage" ${adm ? '' : 'disabled'}><option value="">Automatic - ${esc(STAGES[stageOfSto(l, null, D.latest && D.latest.date)].label)}</option>${Object.entries(STAGES).filter(([k]) => !['NOT_RAISED', 'PRIOR_PENDING', 'ASSUMED_ISSUED'].includes(k)).map(([k, v]) => `<option value="${k}" ${e.stage === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label class="fld"><span>Well ID override</span><input id="sWell" value="${esc(e.wellId || '')}" placeholder="${esc(l.wellId)}" ${adm ? '' : 'disabled'}></label>
      <label class="fld span2"><span>Note</span><textarea id="sNote" rows="2" ${adm ? '' : 'disabled'}>${esc(e.remarks || '')}</textarea></label>
    </div>
    ${adm ? `<div class="row-btns sticky-foot"><button class="btn primary" data-save>Save</button><button class="btn" data-reset>Reset</button></div>` : ''}`,
    d => {
      if (!adm) return;
      d.querySelector('[data-save]').onclick = () => { const ne = { stage: $('#sStage').value || undefined, wellId: normWell($('#sWell').value) || undefined, remarks: $('#sNote').value.trim() || undefined }; Object.keys(ne).forEach(k => ne[k] === undefined && delete ne[k]); if (Object.keys(ne).length) S.edits.sto[key] = Object.assign(ne, { at: Date.now() }); else delete S.edits.sto[key]; audit('Edit STO line', key + ' ' + JSON.stringify(ne)); closeDrawer(); commit(); toast('Saved', 'ok'); };
      d.querySelector('[data-reset]').onclick = () => { delete S.edits.sto[key]; audit('Reset STO line', key); closeDrawer(); commit(); };
    });
}

/* ---------------- flags ---------------- */
V.flags = el => {
  const rows = D.FL.filter(inScope);
  const cnt = {}; rows.forEach(f => cnt[f.code] = (cnt[f.code] || 0) + 1);
  el.innerHTML = `<div class="flag-sum">${Object.keys(FLAGS).filter(k => cnt[k]).map(k => `<button class="fs f-${FLAGS[k].tone}" data-fq="${k}"><b>${fmtI(cnt[k])}</b><span>${esc(FLAGS[k].label)}</span></button>`).join('') || '<p class="muted">No flags in the current scope.</p>'}</div><div data-g></div>`;
  const g = mountGrid(el.querySelector('[data-g]'), 'flags', {
    rows, rowKey: f => f.kind + f.id + f.code, noun: 'flags', exportName: 'Flags and Duplicates', onRow: f => f.kind === 'rec' ? recDrawer(f.id) : f.kind === 'sto' ? stoDrawer(f.id) : agDrawer(f.id),
    rowClass: f => f.sev >= 3 ? 'hl-bad' : f.sev === 2 ? 'hl-warn' : '',
    columns: [
      { k: 'sev', label: 'Severity', val: f => ['Info', 'Low', 'Medium', 'High'][f.sev], filter: true, sortVal: f => f.sev, html: f => `<span class="sev v${f.sev}">${['Info', 'Low', 'Medium', 'High'][f.sev]}</span>` },
      { k: 'code', label: 'Flag', val: f => FLAGS[f.code].label, filter: true, xw: 30 },
      { k: 'wellId', label: 'Well', val: f => f.wellId, filter: true }, { k: 'dept', label: 'Discipline', val: f => f.dept, filter: true },
      { k: 'material', label: 'Material', val: f => f.material, cls: 'mono' }, { k: 'desc', label: 'Description', val: f => f.desc, cls: 'wrap', w: '200px', xw: 40 },
      { k: 'text', label: 'Detail', val: f => f.text, cls: 'wrap', w: '320px', xw: 70 }, { k: 'src', label: 'Source', val: f => f.src, filter: true }, { k: 'ref', label: 'Reference', val: f => f.ref, cls: 'mono small' }
    ]
  });
  el.querySelectorAll('[data-fq]').forEach(b => b.onclick = () => { g.f.code = FLAGS[b.dataset.fq].label; g.page = 0; mountGrid(el.querySelector('[data-g]'), 'flags', g.opts); });
};

/* ---------------- wells ---------------- */
V.wells = el => {
  const open = S.ui.wellOpen || S.ui.well;
  if (open && D.W.has(open)) return wellDetail(el, D.W.get(open));
  const ws = [...D.W.values()].filter(w => !S.ui.dept || (w.depts && w.depts[S.ui.dept]));
  el.innerHTML = `<div class="bar"><span class="muted small">Material inventory per well: requested (MTO), raised in SAP, issued, pending and balance, by discipline. Click a well.</span></div><div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'wells', {
    rows: ws, rowKey: w => w.id, noun: 'wells', exportName: 'Wells', onRow: w => go('wells', { wellOpen: w.id }),
    columns: [
      { k: 'id', label: 'Well ID', val: w => w.id, html: w => `<b>${esc(w.id)}</b>` }, { k: 'name', label: 'Name / WBS description', val: w => w.name, cls: 'wrap', w: '220px', xw: 40 },
      { k: 'wbs', label: 'WBS', val: w => [...w.wbs].join(', '), cls: 'mono small', xw: 28 }, { k: 'type', label: 'Type', val: w => [...w.types].join(', ') },
      { k: 'loc', label: 'Location', val: w => w.loc }, { k: 'mto', label: 'MTO files', val: w => w.batches.length, num: true },
      { k: 'lastMto', label: 'Last MTO', val: w => w.lastMto, html: w => fmtDate(w.lastMto) }, { k: 'stos', label: 'STOs', val: w => w.stoNos.size, num: true },
      { k: 'materials', label: 'Materials', val: w => w.materials, num: true }, { k: 'balanceLines', label: 'Outstanding', val: w => w.balanceLines, num: true },
      { k: 'notRaisedLines', label: 'Not raised', val: w => w.notRaisedLines, num: true }, { k: 'flagLines', label: 'Flagged', val: w => w.flagLines, num: true },
      { k: 'pct', label: '% complete', val: w => w.pct, num: true, html: w => `<div class="pbar"><span style="width:${w.pct}%"></span><em>${w.pct}%</em></div>` }
    ],
    quick: [{ label: 'All' }, { label: 'With MTO', fn: w => w.batches.length }, { label: 'Outstanding', fn: w => w.balanceLines > 0 }, { label: 'Flagged', fn: w => w.flagLines > 0 }]
  });
};
function wellDetail(el, w) {
  const all = D.AG.filter(a => a.wellId === w.id);
  const tab = S.ui.wellTab || 'All'; const depts = DEPTS.filter(d => all.some(a => a.dept === d));
  const rows = all.filter(a => (tab === 'All' || a.dept === tab) && (!S.ui.dept || a.dept === S.ui.dept));
  const stos = D.STO.filter(l => l.wellId === w.id); const recs = D.REC.filter(r => r.wellId === w.id);
  const stoSum = [...groupBy(stos, l => l.sto)].map(([s, ar]) => ({ s, d: ar[0].reqOn, n: ar.length, st: uniq(ar.map(x => STAGES[x.stage].short)).join(', '), open: ar.filter(x => x.open).length })).sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  el.innerHTML = `<div class="bar"><button class="btn sm" data-wback>${icon('back')}All wells</button><span class="grow"></span>
    <button class="btn sm primary" data-wx>${icon('download')}Pending (MTO format)</button><button class="btn sm" data-wxe>${icon('file')}Engineering MTO</button><button class="btn sm" data-wxi>${icon('download')}Well inventory (Excel)</button></div>
  <section class="card well-h"><div><small>Well ID</small><h2>${esc(w.id)}</h2><p>${esc(w.name)}</p></div>
    <dl class="kv sm">${[['WBS', [...w.wbs].join(', ')], ['Type', [...w.types].join(', ')], ['Service PO', [...w.pos].join(', ')], ['RAMZ', [...w.ramz].join(', ')], ['Location', w.loc || '-'], ['PO work order', w.poDesc || '-'], ['MTO files', w.batches.map(id => fmtDate((S.batches.find(b => b.id === id) || {}).date)).join(', ') || '-'], ['Design MTO', w.design ? w.design.meta.docNo || w.design.file : '-']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
  <div class="kpis">${[['Materials', all.length], ['Complete', all.filter(a => a.balance <= EPS).length], ['Outstanding', all.filter(a => a.balance > EPS).length], ['Not raised', all.filter(a => a.notRaised > EPS).length], ['Pending PE', all.filter(a => a.pendingPE > EPS).length], ['Flagged', all.filter(a => a.flags.some(f => f.sev >= 2)).length], ['STOs', w.stoNos.size]].map(([l, v]) => `<div class="kpi"><span>${l}</span><b>${fmtI(v)}</b></div>`).join('')}</div>
  <div class="cards c3">${depts.map(d => { const r = all.filter(a => a.dept === d); const done = r.filter(a => a.balance <= EPS).length; return `<section class="card dep-card click" data-wtab="${d}"><div class="card-h">${deptDot(d)}<small>${done}/${r.length} complete</small></div>${stackBar([{ label: 'Not raised', value: r.filter(a => a.notRaised > EPS).length, color: GC.notraised }, { label: 'Pending PE', value: r.filter(a => a.balance > EPS && a.notRaised <= EPS && a.pendingPE > EPS).length, color: GC.pending }, { label: 'Approved', value: r.filter(a => a.balance > EPS && a.notRaised <= EPS && a.pendingPE <= EPS).length, color: GC.approved }, { label: 'Complete', value: done, color: GC.issued }])}</section>`; }).join('')}</div>
  <div class="tabs">${['All', ...depts].map(d => `<button data-wtab="${d}" class="${tab === d ? 'on' : ''}">${d} <small>${d === 'All' ? all.length : all.filter(a => a.dept === d).length}</small></button>`).join('')}</div>
  <div data-g></div>
  <section class="card"><div class="card-h"><h2>STO history for this well</h2><small>${stoSum.length} STOs · ${recs.length} MTO lines</small></div>
  <table class="mini"><thead><tr><th>STO</th><th>Requested on</th><th class="num">Lines</th><th class="num">Open</th><th>Stages</th></tr></thead><tbody>${stoSum.map(x => `<tr><td class="mono">${esc(x.s)}</td><td>${fmtDate(x.d)}</td><td class="num">${x.n}</td><td class="num">${x.open}</td><td>${esc(x.st)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No STOs.</td></tr>'}</tbody></table></section>`;
  mountGrid(el.querySelector('[data-g]'), 'well-' + w.id, { rows, columns: agCols(false), rowKey: a => a.key, noun: 'materials', exportName: 'Well ' + w.id + ' inventory', onRow: a => agDrawer(a.key), rowClass: a => a.flags.some(f => f.sev >= 3) ? 'hl-bad' : '',
    quick: [{ label: 'All' }, { label: 'Outstanding', fn: a => a.balance > EPS }, { label: 'Not raised', fn: a => a.notRaised > EPS }, { label: 'Complete', fn: a => a.balance <= EPS }, { label: 'Flagged', fn: a => a.flags.some(f => f.sev >= 2) }] });
  el.querySelector('[data-wback]').onclick = () => { S.ui.wellOpen = ''; if (S.ui.well === w.id) S.ui.well = ''; persist(); render(); };
  el.querySelectorAll('[data-wtab]').forEach(b => b.onclick = () => { S.ui.wellTab = b.dataset.wtab; render(); });
  el.querySelector('[data-wx]').onclick = () => openMtoExport({ rows: all.filter(a => a.balance > EPS), kind: 'ag', title: 'Well ' + w.id + ' pending' });
  el.querySelector('[data-wxe]').onclick = () => openEngExport(all.filter(a => a.balance > EPS).map(agToX));
  el.querySelector('[data-wxi]').onclick = () => exportWellInventory(w);
}

/* ---------------- materials ---------------- */
V.materials = el => {
  const rows = [...D.MAT.values()].filter(m => (!S.ui.dept || m.dept === S.ui.dept) && (!S.ui.well || m.wells.has(S.ui.well)));
  el.innerHTML = `<div class="bar"><span class="muted small">Discipline comes from the MTO "Department" column, otherwise from the description. Admin can override it per material (click a row).</span></div><div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'mat', {
    rows, rowKey: m => m.material, noun: 'materials', exportName: 'Material Master', onRow: m => matDrawer(m.material),
    columns: [{ k: 'material', label: 'Material', val: m => m.material, cls: 'mono' }, { k: 'desc', label: 'Description', val: m => m.desc, cls: 'wrap', w: '260px', xw: 45 }, { k: 'uom', label: 'UoM', val: m => m.uom },
      { k: 'dept', label: 'Discipline', val: m => m.dept, filter: true, html: m => deptDot(m.dept) }, { k: 'deptSrc', label: 'Source', val: m => m.deptSrc, filter: true },
      { k: 'wells', label: 'Wells', val: m => m.wells.size, num: true }, { k: 'mto', label: 'MTO qty', val: m => m.mto, num: true }, { k: 'raised', label: 'Raised', val: m => m.raised, num: true }, { k: 'open', label: 'Open in SAP', val: m => m.open, num: true }, { k: 'issued', label: 'Issued', val: m => m.issued, num: true }]
  });
};
function matDrawer(mat) {
  const m = D.MAT.get(mat); const adm = isAdmin();
  openDrawer(`${m.material} - ${m.desc}`, `<dl class="kv">${[['UoM', m.uom], ['Discipline', m.dept + ' (' + m.deptSrc + ')'], ['Wells', [...m.wells].join(', ')], ['MTO qty', fmt(m.mto)], ['Raised', fmt(m.raised)], ['Open', fmt(m.open)], ['Issued', fmt(m.issued)]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <label class="fld"><span>Discipline override</span><select id="mDept" ${adm ? '' : 'disabled'}><option value="">Automatic</option>${DEPTS.map(d => `<option ${(S.edits.mat[mat] || {}).dept === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    ${adm ? '<div class="row-btns"><button class="btn primary" data-save>Save</button></div>' : ''}`, d => { if (adm) d.querySelector('[data-save]').onclick = () => { const v = $('#mDept').value; if (v) S.edits.mat[mat] = { dept: v, at: Date.now() }; else delete S.edits.mat[mat]; audit('Material discipline', mat + ' -> ' + (v || 'auto')); closeDrawer(); commit(); }; });
}
