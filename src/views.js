/* =====================================================================
   views.js : shell (rail, top bar, command palette), screens, drill-downs
   ===================================================================== */
const VIEWS = [
  ['dashboard', 'Overview', 'dash'], ['mto', 'MTO', 'mto'], ['sto', 'STO register', 'sto'], ['inventory', 'Material master', 'inv'],
  ['wells', 'Well inventory', 'well'], ['excluded', 'Excluded lines', 'excl'], ['data', 'Data sources', 'data'], ['exports', 'Export', 'export'], ['settings', 'Settings', 'gear']
];
const V = {};
const inScope = r => (!S.ui.acc || r.acc === S.ui.acc) && (!S.ui.well || r.wellId === S.ui.well) && (!S.ui.disc || r.disc === S.ui.disc);
function go(view, extra) { Object.assign(S.ui, { view }, extra || {}); persist(true); closePop(); render(); window.scrollTo(0, 0); }

/* ---------------- appearance ---------------- */
function applyAppearance() {
  const st = S.settings, html = document.documentElement;
  const dark = st.theme === 'dark' || (st.theme === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  html.dataset.theme = dark ? 'dark' : 'light'; html.dataset.density = st.density || 'comfortable';
  html.style.setProperty('--brand', st.accent || '#204393');
  html.classList.toggle('pinned', !!st.navPinned);
  document.title = st.title || DEFAULT_TITLE;
}

/* ---------------- rail (collapsible navigation) ---------------- */
function renderRail() {
  const st = S.settings; const nEx = D ? D.DUMP.length : 0; const nFl = D ? D.ROWS.filter(r => r.flags.some(f => FLAGS[f.code].tone === 'bad')).length : 0;
  const badge = k => k === 'excluded' && nEx ? `<em>${fmtI(nEx)}</em>` : (k === 'mto' && nFl ? `<em class="bad" title="${nFl} lines with a critical flag">${fmtI(nFl)}</em>` : '');
  const tIc = st.theme === 'dark' ? 'moon' : st.theme === 'light' ? 'sun' : 'auto';
  $('#rail').innerHTML = `
    <div class="r-brand">${st.showLogo && st.logo ? `<img src="${st.logo}" alt="">` : '<span class="mono-mark">AT</span>'}<div class="r-l"><b>${esc(st.title)}</b><small>${esc(st.subtitle || '')}</small></div></div>
    <div class="r-nav">${VIEWS.map(([k, l, i], idx) => `${idx === 6 ? '<hr>' : ''}<button data-nav="${k}" class="${S.ui.view === k ? 'on' : ''}" title="${esc(l)}">${icon(i)}<span class="r-l">${esc(l)}</span>${badge(k)}</button>`).join('')}</div>
    <div class="r-foot">
      <button data-sync title="Team database">${icon('cloud')}<span class="r-l" id="syncTxt">${Sync.label()}</span><i class="dot sc-${Sync.status}" id="syncDot"></i></button>
      <button data-admin title="${hasPin() ? (ADMIN ? 'Admin unlocked' : 'Viewer mode') : 'No admin PIN'}">${icon(isAdmin() ? 'unlock' : 'lock')}<span class="r-l">${hasPin() ? (ADMIN ? 'Admin' : 'Viewer') : 'Open access'}</span></button>
      <button data-theme-cycle title="Theme: ${st.theme}">${icon(tIc)}<span class="r-l">Theme: ${st.theme}</span></button>
      <button data-pin title="${st.navPinned ? 'Unpin menu' : 'Keep menu open'}  [ ]">${icon('pin')}<span class="r-l">${st.navPinned ? 'Unpin menu' : 'Pin menu open'}</span></button>
    </div>`;
}
(function railHover() {
  let t = 0;
  document.addEventListener('mouseover', e => { const r = e.target.closest('#rail'); if (r && !document.documentElement.classList.contains('pinned')) { clearTimeout(t); t = setTimeout(() => r.classList.add('open'), 140); } });
  document.addEventListener('mouseout', e => { const r = e.target.closest('#rail'); if (r && !r.contains(e.relatedTarget)) { clearTimeout(t); r.classList.remove('open'); } });
  document.addEventListener('keydown', e => { if (e.key === '[' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { S.settings.navPinned = !S.settings.navPinned; persist(true); applyAppearance(); renderRail(); setTimeout(() => Object.keys(GRIDS).forEach(fitGrid), 220); } });
})();

/* ---------------- top bar with scope filters ---------------- */
function renderTop() {
  const v = VIEWS.find(x => x[0] === S.ui.view) || VIEWS[0];
  const rows = D ? D.ROWS : [];
  const wells = D ? [...D.W.values()] : [];
  const showScope = !['data', 'settings', 'exports'].includes(S.ui.view) && (S.mto.length || S.snapshots.length);
  $('#top').innerHTML = `
    <button class="ibtn only-m" data-mnav aria-label="Menu">${icon('menu')}</button>
    <div class="t-title"><small>${esc(S.settings.title)}</small><h1>${esc(v[1])}</h1></div>
    ${showScope ? `<div class="scope">
      ${combo('sc-acc', { value: S.ui.acc, label: 'Account', placeholder: 'All', allLabel: 'All accounts', options: ACC_KEYS.map(a => ({ v: a, l: ACC[a], n: rows.filter(r => r.acc === a).length })).filter(o => o.n), onChange: v => { S.ui.acc = v; if (S.ui.well && D.W.get(S.ui.well) && v && D.W.get(S.ui.well).acc !== v) S.ui.well = ''; persist(true); render(); } })}
      ${combo('sc-well', { value: S.ui.well, label: 'Well', placeholder: 'All', allLabel: 'All wells', options: wells.filter(w => !S.ui.acc || w.acc === S.ui.acc).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(w => ({ v: w.id, l: w.id || '(no well)', sub: ACC[w.acc] + ' · ' + (w.name || ''), n: w.lines })), onChange: v => { S.ui.well = v; persist(true); render(); } })}
      ${combo('sc-disc', { value: S.ui.disc, label: 'Discipline', placeholder: 'All', allLabel: 'All disciplines', options: DISCS.concat(rows.some(r => r.disc === 'Unassigned') ? ['Unassigned'] : []).map(d => ({ v: d, l: d, n: rows.filter(r => r.disc === d && (!S.ui.acc || r.acc === S.ui.acc)).length })), onChange: v => { S.ui.disc = v; persist(true); render(); } })}
      ${S.ui.acc || S.ui.well || S.ui.disc ? '<button class="lnk" data-scope-clear>Reset</button>' : ''}
    </div>` : ''}
    <span class="grow"></span>
    <button class="find" data-cmdk title="Find a well, material, STO, PO or page">${icon('search')}<span>Find well, material, STO…</span><kbd>Ctrl K</kbd></button>
    <button class="btn primary" data-import>${icon('upload')}<span>Import</span></button>`;
}
function render() {
  applyAppearance(); renderRail(); renderTop();
  const el = $('#view'); el.innerHTML = ''; el.className = 'view v-' + S.ui.view;
  if (!S.mto.length && !S.snapshots.length && !['data', 'settings'].includes(S.ui.view)) return V.welcome(el);
  (V[S.ui.view] || V.dashboard)(el);
}

/* ---------------- global clicks ---------------- */
document.addEventListener('click', e => {
  const t = e.target;
  const nav = t.closest('[data-nav]'); if (nav) { e.preventDefault(); $('#rail').classList.remove('open', 'mopen'); return go(nav.dataset.nav); }
  const op = t.closest('[data-open]'); if (op) { e.preventDefault(); e.stopPropagation(); const i = op.dataset.open.indexOf(':'); return openRef(op.dataset.open.slice(0, i), op.dataset.open.slice(i + 1)); }
  const gq = t.closest('[data-goq]'); if (gq) { e.preventDefault(); DSTACK.length = 0; closeDrawer(); return goQuery(gq.dataset.goq); }
  if (t.closest('[data-mnav]')) return $('#rail').classList.toggle('mopen');
  if (t.closest('[data-import]')) return pickFiles(false);
  if (t.closest('[data-import-folder]')) return pickFiles(true);
  if (t.closest('[data-cmdk]')) return openCmdk();
  if (t.closest('[data-scope-clear]')) { S.ui.acc = S.ui.well = S.ui.disc = ''; persist(true); return render(); }
  if (t.closest('[data-theme-cycle]')) { const o = ['system', 'light', 'dark']; S.settings.theme = o[(o.indexOf(S.settings.theme) + 1) % 3]; persist(true); return render(); }
  if (t.closest('[data-pin]')) { S.settings.navPinned = !S.settings.navPinned; persist(true); applyAppearance(); renderRail(); setTimeout(() => Object.keys(GRIDS).forEach(fitGrid), 220); return; }
  if (t.closest('[data-admin]')) return adminToggle();
  if (t.closest('[data-sync]')) { if (!Sync.on()) return go('settings'); return Sync.pull({ verbose: true }).then(() => Sync.dirty && Sync.push()); }
}, true);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); } });
/* "view:key:value" deep links from tiles, counts and drawers */
function goQuery(q) {
  const [view, key, val] = q.split(':'); const extra = {};
  if (key === 'acc') { extra.acc = val; extra.disc = ''; }
  if (key === 'well') extra.well = val; if (key === 'disc') { extra.disc = val; extra.acc = ''; }
  if (key === 'accdisc') { const [a, d] = val.split('|'); extra.acc = a; extra.disc = d; }
  const g = gridState(view); g.q = ''; g.f = {}; g.flag = null; g.quick = 0;
  if (key === 'stage') g.f.stage = [STAGES[val].short];
  if (key === 'quick') { const i = (QUICK[view] || []).findIndex(x => x.key === val); g.quick = i >= 0 ? i : 0; }
  if (key === 'flag') g.flag = val;
  go(view, extra);
}

/* ---------------- admin ---------------- */
function adminToggle() {
  if (!hasPin()) return openModal({ title: 'Admin access', body: `<p>No admin PIN is set: anyone who opens this tracker can import, edit and delete.</p><p class="muted">Set a PIN in Settings to lock editing. Viewers can still browse, drill down and export.</p>`, actions: [{ label: 'Close' }, { label: 'Set a PIN', primary: true, onClick: () => go('settings') }] });
  if (ADMIN) { ADMIN = false; try { sessionStorage.removeItem('atnm_admin'); } catch (e) { } render(); return toast('Locked. Viewer mode.'); }
  askPin(() => render());
}
function askPin(then) {
  openModal({ title: 'Unlock admin', body: `<label class="fld"><span>Admin PIN</span><input type="password" id="pinIn" autocomplete="current-password"></label><p class="muted small">A convenience lock inside this page, not server security.</p>`,
    actions: [{ label: 'Cancel' }, { label: 'Unlock', primary: true, onClick: () => { if (sha256('atnm|' + $('#pinIn').value) === S.settings.adminHash) { ADMIN = true; try { sessionStorage.setItem('atnm_admin', S.settings.adminHash); } catch (e) { } audit('Admin unlock', ''); persist(true); toast('Admin unlocked', 'ok'); then && then(); return true; } toast('Wrong PIN', 'bad'); return false; } }],
    onMount: m => m.querySelector('#pinIn').addEventListener('keydown', e => { if (e.key === 'Enter') m.querySelector('[data-act="1"]').click(); }) });
}
function needAdmin(then) { if (isAdmin()) { then && then(); return true; } askPin(() => { render(); then && then(); }); return false; }

/* ---------------- command palette ---------------- */
function openCmdk() {
  const c = $('#cmdk'); c.hidden = false;
  c.innerHTML = `<div class="ck-back" data-ckclose></div><div class="ck-box"><label>${icon('search')}<input placeholder="Well ID, material code or description, STO no., PO, page…" aria-label="Find"></label><ul></ul><footer><span>↑↓ move</span><span>Enter open</span><span>Esc close</span></footer></div>`;
  const inp = c.querySelector('input'), ul = c.querySelector('ul'); let items = [], act = 0;
  const idx = [];
  VIEWS.forEach(([k, l, i]) => idx.push({ t: 'Page', l, s: '', k: 'view:' + k, i }));
  if (D) {
    for (const w of D.W.values()) idx.push({ t: 'Well', l: w.id, s: ACC[w.acc] + ' · ' + (w.name || '') + ` · ${w.lines} lines · ${w.fillPct}% received`, k: 'well:' + w.id, i: 'well' });
    const mats = new Map(); for (const r of D.ROWS) if (!mats.has(r.material)) mats.set(r.material, r);
    for (const r of mats.values()) idx.push({ t: 'Material', l: r.material, s: r.desc, k: 'mat:' + r.material, i: 'inv' });
    const wellSet = new Set(D.W.keys());
    for (const [no, ls] of D.stoByNo) if (ls.some(l => wellSet.has(l.wellId))) idx.push({ t: 'STO', l: no, s: `${ls.length} lines · ${ls[0].status} · ${fmtDate(ls[0].reqOn)} · well ${ls[0].wellId}`, k: 'sto:' + no, i: 'sto' });
    for (const f of S.mto) idx.push({ t: 'MTO file', l: f.file, s: `${f.disc} · well ${f.wellId} · ${f.lines.length} lines`, k: 'file:' + f.id, i: 'mto' });
    for (const w of D.W.values()) if (w.po) idx.push({ t: 'PO', l: w.po.po, s: w.po.desc, k: 'po:' + w.po.po, i: 'file' });
  }
  const draw = () => {
    const q = norm(inp.value); const terms = q.split(' ').filter(Boolean);
    items = (q ? idx.filter(x => { const t = norm(x.l + ' ' + x.s + ' ' + x.t); return terms.every(w => t.includes(w)); }) : idx.filter(x => x.t === 'Page')).slice(0, 40);
    act = 0; ul.innerHTML = items.map((x, i) => `<li data-i="${i}" class="${i === 0 ? 'act' : ''}">${icon(x.i)}<b>${esc(x.l)}</b><span>${esc(x.s)}</span><em>${x.t}</em></li>`).join('') || '<li class="none">No match</li>';
  };
  const run = i => { const x = items[i]; if (!x) return; closeCmdk(); const p = x.k.indexOf(':'); const k = x.k.slice(0, p), v = x.k.slice(p + 1); if (k === 'view') go(v); else { DSTACK.length = 0; CUR_REF = null; openRef(k, v); } };
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => { const lis = $$('li[data-i]', ul); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, Math.min(lis.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); lis.forEach((l, i) => l.classList.toggle('act', i === act)); lis[act] && lis[act].scrollIntoView({ block: 'nearest' }); } if (e.key === 'Enter') run(act); });
  ul.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  c.querySelector('[data-ckclose]').onclick = closeCmdk;
  draw(); setTimeout(() => inp.focus(), 10);
}
function closeCmdk() { const c = $('#cmdk'); c.hidden = true; c.innerHTML = ''; }

/* ---------------- welcome ---------------- */
V.welcome = el => {
  el.innerHTML = `<section class="welcome">
    <div class="w-head">${S.settings.logo && S.settings.showLogo ? `<img src="${S.settings.logo}" alt="">` : ''}<div><small>Start here</small><h2>${esc(S.settings.title)}</h2></div></div>
    <ol class="steps">${stepCards()}</ol>
    <div class="drop" data-drop>${icon('upload', 'big')}<b>Drop the VPS folder files here</b><span>MTO files (.xls / .xlsx), P.O with work orders, STO report, STOCK file — each is recognised by its columns</span>
      <div class="row"><button class="btn primary" data-import-folder>${icon('folder')}Load a folder</button><button class="btn" data-import>${icon('file')}Choose files</button></div></div>
  </section>`;
  bindDrop(el);
};
function stepCards() {
  const sto = latestBlob('sto'), stock = latestBlob('stock');
  const s = [
    ['1', 'MTO files', 'All disciplines. The header block gives WBS, well ID, account (NIM = Greater NIMR, SEF = SSFD, anything else = Others) and the discipline from the job title. Struck-out lines and lines without a material code are set aside.', S.mto.length ? `${S.mto.length} file(s) · ${fmtI(sum(S.mto, f => f.lines.length))} lines` : ''],
    ['2', 'P.O with work orders', 'Service PO for each well: the PO line with CLA "FLH" whose description carries the well ID (gold column).', S.poMeta ? `${fmtI(S.poMeta.count)} PO lines · ${esc(S.poMeta.file)}` : ''],
    ['3', 'STO report', 'Light-blue columns (Request STO, Item, STO Status, Request Qty, Request On) matched by material number + well ID from the Target WBS. VPS doc = received.', sto ? `${fmtDate(sto.date)} · ${fmtI(sto.count)} lines` : ''],
    ['4', 'STOCK file', 'Yellow columns (Plant, Sloc, Batch, Val.Type, Procurement WBS) and SAP QTY = Available Qty. Same account first, then the highest available. Usually arrives last.', stock ? `${fmtDate(stock.date)} · ${fmtI(stock.count)} rows` : '']
  ];
  return s.map(([n, t, d, st]) => `<li class="${st ? 'done' : ''}"><b>${n}</b><div><h4>${t}</h4><p>${d}</p>${st ? `<span class="ok">${icon('check')}${st}</span>` : '<span class="todo">Not loaded</span>'}</div></li>`).join('');
}

/* ---------------- account tiles ---------------- */
function accTiles(rows, target = 'mto') {
  const live = ACC_KEYS.filter(a => a !== 'OTH' || rows.some(r => r.acc === 'OTH'));
  return `<div class="tiles">${live.map(a => {
    const rs = rows.filter(r => r.acc === a); const k = kpis(rs); const wells = uniq(rs.map(r => r.wellId)).length;
    return `<article class="tile acc-${a} click" data-goq="${target}:acc:${a}" title="Open ${ACC[a]} in ${target === 'mto' ? 'the MTO register' : 'well inventory'}">
      <header><span>${esc(ACC[a])}</span><small>${a === 'OTH' ? 'other WBS' : 'WBS ' + a}</small></header>
      <div class="read"><b>${rs.length ? k.fillPct : '–'}<i>%</i></b><span>received<br>vs requested</span></div>
      ${gauge(k.fillPct, { tone: a })}
      <dl><div><dt>Requested</dt><dd>${fmtI(k.lines)}</dd></div><div><dt>Received</dt><dd>${fmtI(k.receivedLines)}</dd></div><div><dt>Part</dt><dd>${fmtI(k.partLines)}</dd></div><div><dt>Not raised</dt><dd>${fmtI(k.notRaised)}</dd></div><div><dt>Wells</dt><dd>${fmtI(wells)}</dd></div></dl>
    </article>`;
  }).join('')}</div>`;
}

/* ---------------- overview ---------------- */
V.dashboard = el => {
  const all = D.ROWS.filter(r => (!S.ui.well || r.wellId === S.ui.well) && (!S.ui.disc || r.disc === S.ui.disc));
  const rows = all.filter(r => !S.ui.acc || r.acc === S.ui.acc);
  const sto = latestBlob('sto'), stock = latestBlob('stock');
  const src = [['MTO', S.mto.length ? `${S.mto.length} files` : '', S.mto.length ? `${fmtI(D.ROWS.length)} lines` : 'not loaded'], ['PO', S.poMeta ? fmtI(S.poMeta.count) : '', S.poMeta ? 'PO lines' : 'not loaded'], ['STO', sto ? fmtDate(sto.date) : '', sto ? fmtI(sto.count) + ' lines' : 'not loaded'], ['STOCK', stock ? fmtDate(stock.date) : '', stock ? fmtI(stock.count) + ' rows' : 'awaited']];
  const accs = ACC_KEYS.filter(a => all.some(r => r.acc === a));
  const att = [
    ['Request higher than available stock', rows.filter(r => r.reqGtAvail).length, 'mto:quick:reqavail', 'bad'],
    ['Not raised in SAP', rows.filter(r => r.stage === 'NOT_RAISED').length, 'mto:stage:NOT_RAISED', 'bad'],
    ['Raised in several STOs', rows.filter(r => r.stoCount > 1).length, 'mto:quick:multi', 'warn'],
    ['STO qty differs from MTO qty', rows.filter(r => r.flags.some(f => f.code === 'STO_OVER' || f.code === 'STO_SHORT')).length, 'mto:quick:qtydiff', 'warn'],
    ['Wells without FLH service PO', [...D.W.values()].filter(w => !w.po && (!S.ui.acc || w.acc === S.ui.acc)).length, 'wells:quick:nopo', 'warn'],
    ['Materials not in STOCK file', rows.filter(r => r.flags.some(f => f.code === 'NO_STOCK')).length, 'mto:quick:nostock', 'info'],
    ['Lines excluded from MTO files', D.DUMP.filter(d => (!S.ui.acc || d.acc === S.ui.acc) && (!S.ui.well || d.wellId === S.ui.well)).length, 'excluded:quick:all', 'info']
  ].filter(x => x[1]);
  const behind = [...D.W.values()].filter(w => (!S.ui.acc || w.acc === S.ui.acc) && (!S.ui.well || w.id === S.ui.well)).sort((a, b) => a.fillPct - b.fillPct || b.openLines - a.openLines).slice(0, 8);
  el.innerHTML = `
  <div class="srcs">${src.map(([k, a, b]) => `<button class="src ${a ? '' : 'miss'}" data-nav="data"><i></i><span>${k}</span><b>${a || '—'}</b><small>${b}</small></button>`).join('')}<span class="grow"></span><small class="muted">${esc([S.ui.acc ? ACC[S.ui.acc] : 'All accounts', S.ui.well ? 'well ' + S.ui.well : 'all wells', S.ui.disc || 'all disciplines'].join(' · '))}</small></div>
  ${accTiles(all)}
  <div class="grid2">
    <section class="panel"><header><h2>Request pipeline</h2><small>${fmtI(rows.length)} MTO lines by stage · click a stage</small></header>${pipeline(rows)}</section>
    <section class="panel"><header><h2>Received % by discipline</h2><small>click a cell</small></header>
      <table class="matrix"><thead><tr><th></th>${accs.map(a => `<th>${esc(ACC[a])}</th>`).join('')}<th>All</th></tr></thead><tbody>
      ${DISCS.concat(all.some(r => r.disc === 'Unassigned') ? ['Unassigned'] : []).map(d => { const rd = all.filter(r => r.disc === d); if (!rd.length) return ''; const cell = (rs, q) => { if (!rs.length) return '<td class="nil">·</td>'; const k = kpis(rs); return `<td class="click" data-goq="${q}" style="background:${heat(k.fillPct)}"><b>${k.fillPct}%</b><small>${k.receivedLines}/${k.lines}</small></td>`; }; return `<tr><th>${discTag(d)}</th>${accs.map(a => cell(rd.filter(r => r.acc === a), 'mto:accdisc:' + a + '|' + d)).join('')}${cell(rd, 'mto:disc:' + d)}</tr>`; }).join('')}
      </tbody></table></section>
  </div>
  <div class="grid2">
    <section class="panel"><header><h2>Needs attention</h2><small>click to open the lines</small></header>
      <ul class="attn">${att.map(([l, n, q, t]) => `<li class="click t-${t}" data-goq="${q}"><b>${fmtI(n)}</b><span>${esc(l)}</span>${icon('arrow')}</li>`).join('') || '<li class="none">Nothing to flag in this scope.</li>'}</ul></section>
    <section class="panel"><header><h2>Wells furthest behind</h2><small>lowest received %</small></header>
      <table class="mini"><thead><tr><th>Well</th><th>Account</th><th class="num">Lines</th><th class="num">Open</th><th>Received</th></tr></thead><tbody>
      ${behind.map(w => `<tr class="click" data-open="well:${esc(w.id)}"><td><b>${esc(w.id || '(no well)')}</b><small class="sub">${esc((w.name || '').slice(0, 34))}</small></td><td>${accTag(w.acc)}</td><td class="num">${fmtI(w.lines)}</td><td class="num">${fmtI(w.openLines)}</td><td class="gcell">${gauge(w.fillPct, { segs: 12, tone: w.acc })}<b>${w.fillPct}%</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No wells.</td></tr>'}
      </tbody></table></section>
  </div>`;
};

/* ---------------- MTO register (template layout) ---------------- */
const QUICK = {
  mto: [
    { key: 'all', label: 'All' }, { key: 'nr', label: 'Not raised', fn: r => r.stage === 'NOT_RAISED' }, { key: 'pe', label: 'Pending PE', fn: r => r.stage === 'PENDING_PE' },
    { key: 'ap', label: 'Approved', fn: r => r.group === 'approved' }, { key: 'rc', label: 'Received', fn: r => r.group === 'received' },
    { key: 'vps', label: 'VPS empty', fn: r => !r.vpsDoc, title: 'Nothing received into VPS yet' },
    { key: 'reqavail', label: 'Req > avail', fn: r => r.reqGtAvail, title: 'Request Qty higher than Available Qty (SAP QTY)' },
    { key: 'multi', label: 'Multi STO', fn: r => r.stoCount > 1 }, { key: 'qtydiff', label: 'STO ≠ MTO', fn: r => r.flags.some(f => f.code === 'STO_OVER' || f.code === 'STO_SHORT') },
    { key: 'nostock', label: 'Not in stock', fn: r => r.flags.some(f => f.code === 'NO_STOCK') }
  ],
  wells: [{ key: 'all', label: 'All' }, { key: 'open', label: 'Open lines', fn: w => w.openLines > 0 }, { key: 'done', label: 'Fully received', fn: w => w.lines && w.openLines === 0 }, { key: 'nopo', label: 'No FLH PO', fn: w => !w.po }],
  excluded: [{ key: 'all', label: 'All' }, { key: 'struck', label: 'Struck out', fn: d => d.reason === 'Struck out' }, { key: 'nocode', label: 'No / invalid code', fn: d => d.reason !== 'Struck out' }]
};
function mtoCols() {
  const c = (k, label, o = {}) => Object.assign({ k, label, val: r => r[k] }, o);
  return [
    c('n', '#', { w: 52, num: true, cls: 'muted' }),
    c('acc', 'Account', { w: 112, filter: true, val: r => ACC[r.acc], html: r => accTag(r.acc) }),
    c('disc', 'Discipline', { w: 150, filter: true, html: r => discTag(r.disc) }),
    c('sr', 'MTO Sr', { w: 64, cls: 'muted' }),
    c('material', 'Material', { w: 112, band: 'G', cls: 'mono', html: r => lnk('mat', r.material) }),
    c('desc', 'Description', { w: 300, band: 'G' }),
    c('uom', 'UoM', { w: 58, band: 'G' }),
    c('qty', 'Request Qty', { w: 98, band: 'G', num: true, html: r => `<b>${fmt(r.qty)}</b>${r.qty !== r.mtoQty ? '<sup title="Edited">✎</sup>' : ''}` }),
    c('sapQty', 'SAP QTY', { w: 92, band: 'Y', num: true, cellClass: r => r.reqGtAvail ? 'c-bad' : '', title: 'Available Qty from the STOCK file' }),
    c('plant', 'Plant', { w: 70, band: 'Y' }), c('sloc', 'Sloc', { w: 66, band: 'Y' }), c('slocDesc', 'Sloc Description', { w: 140, band: 'Y' }),
    c('batch', 'Batch', { w: 104, band: 'Y' }), c('valType', 'Val.Type', { w: 104, band: 'Y' }),
    c('wbs', 'Construction WBS', { w: 200, band: 'G', cls: 'mono' }), c('wellType', 'Well Type', { w: 82, band: 'G' }),
    c('wellId', 'Well ID', { w: 84, band: 'G', filter: true, html: r => lnk('well', r.wellId, r.wellId || '—') }),
    c('procWBS', 'Procurement WBS', { w: 200, band: 'Y', cls: 'mono' }),
    c('docHeader', 'Document header text', { w: 230, band: 'G' }), c('ramz', 'RAMZ ID', { w: 120, band: 'G', cls: 'mono' }),
    c('servicePO', 'Service PO', { w: 128, band: 'P', cls: 'mono', html: r => r.po ? lnk('po', r.po.po, r.servicePO) : '' }),
    c('stoNo', 'STO PO NO', { w: 132, band: 'B', cls: 'mono', html: r => r.stoNo ? lnk('sto', r.stoNo) + (r.stoCount > 1 ? ` <a href="#" class="more" data-open="row:${esc(r.id)}" title="${r.stoCount} STOs - open all">+${r.stoCount - 1}</a>` : '') : '' }),
    c('stoItem', 'STO Item', { w: 70, band: 'B', num: true }),
    c('stoStatus', 'POSTING STATUS', { w: 190, band: 'B', filter: true }),
    c('stoQty', 'STO Req Qty', { w: 96, band: 'B', num: true, html: r => r.stoLines.length ? fmt(r.stoQty) : '' }),
    c('stoReqOn', 'Request On', { w: 96, band: 'B', html: r => fmtDate(r.stoReqOn) }),
    c('vpsDoc', 'VPS Mat Doc', { w: 112, cls: 'mono' }),
    c('received', 'Received', { w: 86, num: true, html: r => r.received ? fmt(r.received) : '' }),
    c('balance', 'Balance', { w: 86, num: true, html: r => r.balance > EPS ? `<b>${fmt(r.balance)}</b>` : '<span class="muted">0</span>' }),
    c('stage', 'Status', { w: 142, filter: true, val: r => STAGES[r.stage].short, html: r => stageMark(r.stage) }),
    c('flags', 'Flags', { w: 220, val: r => r.flags.map(f => FLAGS[f.code].label).join('; '), html: r => flagMarks(r.flags) }),
    c('col1', 'Column1', { w: 200 }),
    c('file', 'MTO file', { w: 220, filter: true, html: r => lnk('file', r.fileId, r.file) }),
    c('section', 'MTO section', { w: 160 }), c('mesc', 'MESC', { w: 110, cls: 'mono' })
  ];
}
V.mto = el => {
  const g = gridState('mto');
  let rows = D.ROWS.filter(inScope);
  if (g.flag) rows = rows.filter(r => r.flags.some(f => f.code === g.flag));
  el.innerHTML = `<div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'mto', {
    rows, columns: mtoCols(), rowKey: r => r.id, noun: 'MTO lines', exportName: 'MTO', selectable: true,
    defaultHidden: ['sloc', 'slocDesc', 'valType', 'ramz', 'wellType', 'stoItem', 'section', 'mesc', 'sr', 'file'],
    onRow: r => { DSTACK.length = 0; CUR_REF = null; openRef('row', r.id); }, rowClass: r => 'g-' + r.group + (r.flags.some(f => FLAGS[f.code].tone === 'bad') ? ' fl-bad' : ''),
    quick: QUICK.mto, searchExtra: r => r.mtoDesc + ' ' + r.file,
    tools: `${g.flag ? `<button class="chip-x" data-unflag>Flag: ${esc(FLAGS[g.flag].label)} ✕</button>` : ''}<button class="btn sm primary" data-x-open>${icon('export')}Export…</button>`,
    bulk: [{ label: 'Set status…', admin: true, fn: sel => bulkStage(sel) }, { label: 'Export selected…', fn: sel => openExport({ rows: sel }) }]
  });
  const ub = el.querySelector('[data-unflag]'); if (ub) ub.onclick = () => { g.flag = null; render(); };
  el.querySelector('[data-x-open]').onclick = () => openExport({ rows: GRIDS.mto.view });
};
function bulkStage(sel) {
  if (!needAdmin()) return;
  openModal({ title: `Set status for ${sel.length} line(s)`, body: `<label class="fld"><span>Status</span><select id="bs"><option value="">Automatic (from STO / VPS)</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: () => { const v = $('#bs').value; for (const r of sel) { const e = S.edits.row[r.id] || (S.edits.row[r.id] = {}); if (v) e.stage = v; else delete e.stage; e.at = Date.now(); } audit('Bulk status', `${sel.length} lines -> ${v || 'auto'}`); commit(); } }] });
}
function commit() { rebuild(); persist(); render(); }

/* ---------------- STO register ---------------- */
V.sto = el => {
  const mtoKeys = new Set(D.ROWS.map(r => r.material + '|' + r.wellId));
  const rows = D.STO.filter(l => { const a = accOf(l.tgtWBS); return (!S.ui.acc || a === S.ui.acc) && (!S.ui.well || l.wellId === S.ui.well); });
  const c = (k, label, o = {}) => Object.assign({ k, label, val: r => r[k] }, o);
  el.innerHTML = `<div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'sto', {
    rows, rowKey: l => l.key, noun: 'STO lines', exportName: 'STO register', onRow: l => { DSTACK.length = 0; CUR_REF = null; openRef('sto', l.sto); },
    rowClass: l => mtoKeys.has(l.material + '|' + l.wellId) ? '' : 'dim',
    quick: [{ label: 'All' }, { label: 'Pending PE', fn: l => l.stage === 'PENDING_PE' }, { label: 'Approved', fn: l => STAGES[l.stage].group === 'approved' }, { label: 'VPS posted', fn: l => !!l.vpsDoc }, { label: 'VPS empty', fn: l => !l.vpsDoc }, { label: 'In MTO', fn: l => mtoKeys.has(l.material + '|' + l.wellId) }, { label: 'Not in MTO', fn: l => !mtoKeys.has(l.material + '|' + l.wellId) }],
    columns: [
      c('sto', 'Request STO', { w: 120, band: 'B', cls: 'mono', html: l => lnk('sto', l.sto) }), c('item', 'Item', { w: 62, band: 'B', num: true }),
      c('status', 'STO Status', { w: 200, band: 'B', filter: true }), c('material', 'Material Number', { w: 124, band: 'P', cls: 'mono', html: l => lnk('mat', l.material) }),
      c('desc', 'Material Description', { w: 280 }), c('qty', 'Request Qty', { w: 96, band: 'B', num: true }), c('uom', 'UoM', { w: 56 }),
      c('tgtWBS', 'Target WBS', { w: 200, band: 'P', cls: 'mono' }), c('wellId', 'Well', { w: 80, filter: true, html: l => lnk('well', l.wellId, l.wellId || '—') }),
      c('acc', 'Account', { w: 110, filter: true, val: l => ACC[accOf(l.tgtWBS)], html: l => accTag(accOf(l.tgtWBS)) }),
      c('reqOn', 'Request On', { w: 96, band: 'B', html: l => fmtDate(l.reqOn) }), c('vpsDoc', 'VPS Mat Doc', { w: 116, cls: 'mono' }),
      c('stage', 'Stage', { w: 140, filter: true, val: l => STAGES[l.stage].short, html: l => stageMark(l.stage) }),
      c('tgtWBSDesc', 'Target WBS Descr.', { w: 240 }), c('reqBy', 'Requested by', { w: 104, filter: true }), c('po', 'Service PO', { w: 120, cls: 'mono', val: l => l.po + (l.poItem ? '/' + l.poItem : '') }),
      c('batchNo', 'Batch', { w: 100 }), c('remarks', 'Request remarks', { w: 220 })
    ], defaultHidden: ['tgtWBSDesc', 'batchNo', 'remarks']
  });
};

/* ---------------- material master / inventory ---------------- */
function inventoryRows(rows, accFilter) {
  const m = new Map();
  for (const r of rows) {
    let a = m.get(r.material);
    if (!a) m.set(r.material, a = { material: r.material, desc: (r.stock && r.stock.desc) || r.desc, uom: r.uom, discs: new Set(), wells: new Set(), accs: new Set(), requested: 0, raised: 0, received: 0, balance: 0, lines: 0, rows: [] });
    a.discs.add(r.disc); a.wells.add(r.wellId); a.accs.add(r.acc); a.lines++; a.rows.push(r);
    if (r.group !== 'cancelled') { a.requested += r.qty; a.raised += r.stoQty; a.received += r.received; a.balance += r.balance; }
  }
  for (const a of m.values()) {
    const st = D.stockByMat.get(a.material) || [];
    a.stock = sum(st.filter(s => !accFilter || accOf(s.wbs) === accFilter), s => s.avail); a.stockAll = sum(st, s => s.avail); a.hasStock = st.length > 0;
    a.projected = a.stock - a.balance; a.fillPct = a.requested > EPS ? Math.round(Math.min(1, a.received / a.requested) * 1000) / 10 : 0;
  }
  return [...m.values()];
}
V.inventory = el => {
  const g = gridState('inventory'); g.mode = g.mode || 'all';
  const rows = inventoryRows(D.ROWS.filter(inScope), S.ui.acc).filter(a => g.mode === 'all' || (g.mode === 'req' ? a.received <= EPS : a.received > EPS));
  const c = (k, label, o = {}) => Object.assign({ k, label, val: a => a[k] }, o);
  el.innerHTML = `<div class="bar"><div class="seg big">${[['all', 'All materials'], ['req', 'Requested · nothing received'], ['rcv', 'Received (any)']].map(([k, l]) => `<button data-imode="${k}" class="${g.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <p class="muted small">Requested adds, received (VPS posted) subtracts: <b>Balance</b> = requested − received. <b>Stock</b> = Available Qty in the STOCK file${S.ui.acc ? ' on ' + ACC[S.ui.acc] + ' WBS' : ''}; <b>Projected</b> = stock − balance. Use Account / Well / Discipline above to filter.</p></div><div data-g></div>`;
  el.querySelectorAll('[data-imode]').forEach(b => b.onclick = () => { g.mode = b.dataset.imode; render(); });
  mountGrid(el.querySelector('[data-g]'), 'inventory', {
    rows, rowKey: a => a.material, noun: 'materials', exportName: 'Material master', onRow: a => { DSTACK.length = 0; CUR_REF = null; openRef('mat', a.material); },
    rowClass: a => a.projected < -EPS && a.balance > EPS ? 'fl-bad' : '',
    quick: [{ label: 'All' }, { label: 'Open balance', fn: a => a.balance > EPS }, { label: 'Fully received', fn: a => a.requested > EPS && a.balance <= EPS }, { label: 'Short of stock', fn: a => a.balance > EPS && a.projected < -EPS, title: 'Balance higher than available stock' }, { label: 'No stock record', fn: a => !a.hasStock }],
    columns: [
      c('material', 'Material', { w: 112, cls: 'mono', html: a => lnk('mat', a.material) }), c('desc', 'Description', { w: 300 }), c('uom', 'UoM', { w: 58 }),
      c('discs', 'Disciplines', { w: 190, val: a => [...a.discs].join(', '), html: a => [...a.discs].map(d => `<span class="dchip" title="${esc(d)}">${esc(DISC_SHORT[d] || d)}</span>`).join('') }),
      c('wellsN', 'Wells', { w: 66, num: true, val: a => a.wells.size, html: a => `<span title="${esc([...a.wells].join(', '))}">${a.wells.size}</span>` }),
      c('lines', 'MTO lines', { w: 82, num: true }), c('requested', 'Requested', { w: 100, num: true, html: a => `<b>${fmt(a.requested)}</b>` }), c('raised', 'STO raised', { w: 96, num: true }),
      c('received', 'Received', { w: 96, num: true }), c('balance', 'Balance', { w: 96, num: true, html: a => a.balance > EPS ? `<b>${fmt(a.balance)}</b>` : '<span class="muted">0</span>' }),
      c('fillPct', 'Received %', { w: 150, num: true, html: a => `<span class="gcell">${gauge(a.fillPct, { segs: 10 })}<b>${a.fillPct}%</b></span>` }),
      c('stock', 'Stock avail.', { w: 100, num: true, html: a => a.hasStock ? fmt(a.stock) : '<span class="muted">—</span>' }),
      c('projected', 'Projected', { w: 96, num: true, cellClass: a => a.projected < -EPS && a.balance > EPS ? 'c-bad' : '', html: a => a.hasStock ? fmt(a.projected) : '' })
    ]
  });
};

/* ---------------- wells ---------------- */
V.wells = el => {
  const ws = [...D.W.values()].filter(w => (!S.ui.acc || w.acc === S.ui.acc) && (!S.ui.well || w.id === S.ui.well));
  const rowsAll = D.ROWS.filter(r => (!S.ui.well || r.wellId === S.ui.well) && (!S.ui.disc || r.disc === S.ui.disc));
  const c = (k, label, o = {}) => Object.assign({ k, label, val: w => w[k] }, o);
  el.innerHTML = `${accTiles(rowsAll, 'wells')}<div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'wells', {
    rows: ws, rowKey: w => w.id, noun: 'wells', exportName: 'Well inventory', onRow: w => { DSTACK.length = 0; CUR_REF = null; openRef('well', w.id); }, quick: QUICK.wells,
    columns: [
      c('id', 'Well ID', { w: 86, html: w => lnk('well', w.id, w.id || '—') }), c('acc', 'Account', { w: 112, filter: true, val: w => ACC[w.acc], html: w => accTag(w.acc) }),
      c('name', 'Name / document header', { w: 260 }), c('wbs', 'Construction WBS', { w: 200, cls: 'mono' }), c('wellType', 'Type', { w: 64 }),
      c('svc', 'Service PO', { w: 128, cls: 'mono', val: w => w.po ? w.po.po + '/' + w.po.line : '', html: w => w.po ? lnk('po', w.po.po, w.po.po + '/' + w.po.line) : '<span class="t-warn">none</span>' }),
      c('discs', 'Disciplines', { w: 210, val: w => Object.keys(w.discs).join(', '), html: w => Object.keys(w.discs).map(d => `<span class="dchip" title="${esc(d)}">${esc(DISC_SHORT[d] || d)}</span>`).join('') }),
      c('lines', 'Lines', { w: 64, num: true }), c('receivedLines', 'Received', { w: 82, num: true }), c('openLines', 'Open', { w: 64, num: true }), c('notRaised', 'Not raised', { w: 86, num: true }),
      c('fillPct', 'Received %', { w: 150, num: true, html: w => `<span class="gcell">${gauge(w.fillPct, { segs: 12, tone: w.acc })}<b>${w.fillPct}%</b></span>` }),
      c('stos', 'STOs', { w: 60, num: true, val: w => w.stoNos.length }), c('flagged', 'Flagged', { w: 76, num: true })
    ]
  });
};

/* ---------------- excluded lines ---------------- */
V.excluded = el => {
  const rows = D.DUMP.filter(d => (!S.ui.acc || d.acc === S.ui.acc) && (!S.ui.well || d.wellId === S.ui.well) && (!S.ui.disc || d.disc === S.ui.disc));
  const c = (k, label, o = {}) => Object.assign({ k, label, val: d => d[k] }, o);
  el.innerHTML = `<p class="muted small lead">Lines left out of the MTO register while reading the MTO files: struck-out entries and entries without a valid SAP material code. Kept here for reference only.</p><div data-g></div>`;
  mountGrid(el.querySelector('[data-g]'), 'excluded', {
    rows, rowKey: d => d.fileId + '#' + d.row, noun: 'excluded lines', exportName: 'Excluded MTO lines', quick: QUICK.excluded, onRow: d => { DSTACK.length = 0; CUR_REF = null; openRef('file', d.fileId); },
    columns: [c('reason', 'Reason', { w: 230, filter: true, html: d => `<span class="fl ${d.reason === 'Struck out' ? 'fl-bad' : 'fl-warn'}">${esc(d.reason)}</span>` }), c('wellId', 'Well', { w: 80, filter: true, html: d => lnk('well', d.wellId) }), c('acc', 'Account', { w: 110, val: d => ACC[d.acc] }), c('disc', 'Discipline', { w: 150, filter: true }),
      c('file', 'MTO file', { w: 260, html: d => lnk('file', d.fileId, d.file) }), c('row', 'Excel row', { w: 80, num: true }), c('sr', 'Sr', { w: 56 }), c('section', 'Section', { w: 160 }), c('desc', 'Description', { w: 320 }), c('qty', 'Qty', { w: 72, num: true }), c('unit', 'Unit', { w: 60 }), c('material', 'Material (raw)', { w: 120, cls: 'mono' })]
  });
};

/* =====================================================================
   DRILL-DOWN DRAWERS (every clickable reference ends here)
   ===================================================================== */
let CUR_REF = null;
function openRef(kind, id, fromBack) {
  if (!fromBack && !$('#drawer').hidden && CUR_REF) DSTACK.push(CUR_REF);
  CUR_REF = fb => openRef(kind, id, fb);
  ({ row: drawRow, mat: drawMat, well: drawWell, sto: drawSto, po: drawPo, file: drawFile }[kind] || (() => { }))(id);
}
const kv = list => `<dl class="kv">${list.filter(x => x).map(([k, v, b]) => `<div class="${b ? 'kb b-' + b : ''}"><dt>${esc(k)}</dt><dd>${v === '' || v == null ? '<span class="muted">—</span>' : v}</dd></div>`).join('')}</dl>`;
const stat = (l, v, cls = '') => `<div class="stat ${cls}"><small>${esc(l)}</small><b>${v}</b></div>`;
function stoTable(lines, showWell = true) {
  if (!lines.length) return '<p class="muted small">No STO lines.</p>';
  return `<table class="mini"><thead><tr><th>STO / item</th><th>Requested</th>${showWell ? '<th>Well</th>' : ''}<th>Material</th><th class="num">Qty</th><th>Status</th><th>VPS doc</th></tr></thead><tbody>${lines.map(x => `<tr><td>${lnk('sto', x.sto)}<span class="muted">/${esc(x.item)}</span></td><td>${fmtDate(x.reqOn)}</td>${showWell ? `<td>${lnk('well', x.wellId, x.wellId || '—')}</td>` : ''}<td>${lnk('mat', x.material)}</td><td class="num">${fmt(x.qty)} ${esc(x.uom)}</td><td>${stageMark(x.stage)}</td><td class="mono">${esc(x.vpsDoc)}</td></tr>`).join('')}</tbody></table>`;
}
function drawRow(id) {
  const r = D.ROWS.find(x => x.id === id); if (!r) return toast('Line not found');
  const e = S.edits.row[id] || {}; const adm = isAdmin(); const f = S.mto.find(x => x.id === r.fileId);
  const stockRows = D.stockByMat.get(r.material) || [];
  openDrawer(`${r.material} · ${r.desc}`, `
    <div class="d-sum">${stageMark(r.stage)} ${accTag(r.acc)} ${discTag(r.disc)} <span class="muted">Well ${lnk('well', r.wellId)} · ${lnk('file', r.fileId, 'MTO row ' + r.row)}</span></div>
    <div class="stats">${stat('Request', fmt(r.qty) + ' ' + esc(r.uom))}${stat('SAP QTY', r.sapQty == null ? '—' : fmt(r.sapQty), r.reqGtAvail ? 'bad' : '')}${stat('STO raised', fmt(r.stoQty))}${stat('Received', fmt(r.received))}${stat('Balance', fmt(r.balance), r.balance > EPS ? 'warn' : 'ok')}</div>
    ${r.flags.length ? `<div class="flist">${r.flags.map(x => `<div class="fl-row fl-${FLAGS[x.code].tone}"><b>${esc(FLAGS[x.code].label)}</b><span>${esc(x.text)}</span></div>`).join('')}</div>` : ''}
    <h4>Template row</h4>
    ${kv([['Material', lnk('mat', r.material), 'G'], ['Description', esc(r.desc), 'G'], ['UoM', esc(r.uom) + (r.mtoUom && normUom(r.mtoUom) !== r.uom ? ` <small class="muted">(MTO: ${esc(r.mtoUom)})</small>` : ''), 'G'], ['Request Qty', fmt(r.qty) + (r.qty !== r.mtoQty ? ` <small class="muted">(MTO ${fmt(r.mtoQty)})</small>` : ''), 'G'],
      ['SAP QTY', r.sapQty == null ? '' : fmt(r.sapQty), 'Y'], ['Plant / Sloc', esc([r.plant, r.sloc, r.slocDesc].filter(Boolean).join(' · ')), 'Y'], ['Batch / Val.Type', esc([r.batch, r.valType].filter(Boolean).join(' · ')), 'Y'], ['Procurement WBS', esc(r.procWBS), 'Y'],
      ['Construction WBS', esc(r.wbs), 'G'], ['Well Type / ID', esc(r.wellType) + ' · ' + lnk('well', r.wellId), 'G'], ['Document header', esc(r.docHeader), 'G'], ['RAMZ ID', esc(r.ramz), 'G'],
      ['Service PO', r.po ? lnk('po', r.po.po, r.servicePO) + ` <small class="muted">CLA ${esc(r.po.cla)}</small>` : '', 'P'],
      ['STO PO NO', r.stoNo ? lnk('sto', r.stoNo) + ` <small class="muted">item ${esc(r.stoItem)} · ${fmtDate(r.stoReqOn)}</small>` : '', 'B'], ['POSTING STATUS', esc(r.stoStatus), 'B'], ['VPS Mat Doc', esc(r.vpsDoc)], ['Column1', esc(r.col1)]])}
    <h4>STO lines for this material at well ${esc(r.wellId)} <small>${r.stoLines.length}</small></h4>${stoTable(r.stoLines, false)}
    <h4>Stock rows for ${esc(r.material)} <small>${stockRows.length}</small></h4>
    ${stockRows.length ? `<table class="mini"><thead><tr><th>WBS</th><th>Batch</th><th>Sloc</th><th class="num">Available</th></tr></thead><tbody>${stockRows.slice().sort((a, b) => b.avail - a.avail).map(s => `<tr class="${s === r.stock ? 'pick' : ''}"><td class="mono">${esc(s.wbs)} ${accTag(accOf(s.wbs))}</td><td>${esc(s.batch)}</td><td>${esc(s.sloc)}</td><td class="num">${fmt(s.avail)}</td></tr>`).join('')}</tbody></table><p class="muted small">Highlighted = row used (same account first, then highest available).</p>` : '<p class="muted small">Not in the STOCK file' + (D.stockBlob ? '' : ' (no STOCK file loaded yet)') + '.</p>'}
    <h4>From the MTO file</h4>${kv([['File', lnk('file', r.fileId, r.file)], ['Sheet row', String(r.row)], ['Section', esc(r.section)], ['MESC', esc(r.mesc)], ['MTO description', esc(r.mtoDesc)], ['Remarks', esc(r.remarks)], ['Job title', esc(r.jobTitle)]])}
    <h4>Edit ${adm ? '' : '<small>(admin only)</small>'}</h4>
    <div class="form2">
      <label class="fld"><span>Request Qty</span><input id="eQty" type="number" step="any" value="${e.qty ?? ''}" placeholder="${fmt(r.mtoQty)}" ${adm ? '' : 'disabled'}></label>
      <label class="fld"><span>Status</span><select id="eStage" ${adm ? '' : 'disabled'}><option value="">Automatic</option>${Object.entries(STAGES).map(([k, v]) => `<option value="${k}" ${e.stage === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
      <label class="fld"><span>Discipline</span><select id="eDisc" ${adm ? '' : 'disabled'}><option value="">From file (${esc(f ? f.disc : r.disc)})</option>${DISCS.map(d => `<option ${e.disc === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="fld"><span>Document header text</span><input id="eDoc" value="${esc(e.docHeader || '')}" placeholder="${esc(r.docHeader)}" ${adm ? '' : 'disabled'}></label>
      <label class="fld span2"><span>Column1 (remark written to the template)</span><input id="eC1" value="${esc(e.col1 ?? '')}" placeholder="${esc(r.col1 || 'automatic flags')}" ${adm ? '' : 'disabled'}></label>
    </div>
    ${adm ? `<div class="row sticky"><button class="btn primary" data-save>Save</button><button class="btn" data-reset>Reset to file values</button></div>` : ''}`, d => {
    if (!adm) return;
    d.querySelector('[data-save]').onclick = () => {
      const ne = { qty: $('#eQty').value === '' ? undefined : num($('#eQty').value), stage: $('#eStage').value || undefined, disc: $('#eDisc').value || undefined, docHeader: $('#eDoc').value.trim() || undefined, col1: $('#eC1').value.trim() === '' ? undefined : $('#eC1').value.trim() };
      Object.keys(ne).forEach(k => ne[k] === undefined && delete ne[k]);
      if (Object.keys(ne).length) S.edits.row[id] = Object.assign(ne, { at: Date.now() }); else delete S.edits.row[id];
      audit('Edit MTO line', `${r.wellId} ${r.material} row ${r.row}`); DSTACK.length = 0; closeDrawer(); commit(); toast('Saved', 'ok');
    };
    d.querySelector('[data-reset]').onclick = () => { delete S.edits.row[id]; audit('Reset MTO line', id); DSTACK.length = 0; closeDrawer(); commit(); };
  }, 'MTO line');
}
function drawMat(mat) {
  const rows = D.ROWS.filter(r => r.material === mat); const st = D.stockByMat.get(mat) || []; const sto = D.STO.filter(l => l.material === mat);
  const inv = inventoryRows(rows)[0] || { requested: 0, received: 0, balance: 0, raised: 0, desc: (st[0] || sto[0] || {}).desc || '' };
  const byWell = [...groupBy(rows, r => r.wellId)].map(([w, rs]) => ({ w, acc: rs[0].acc, discs: uniq(rs.map(r => r.disc)), req: sum(rs, r => r.qty), rcv: sum(rs, r => r.received), bal: sum(rs, r => r.balance), stage: rs[0].stage }));
  openDrawer(`${mat} · ${inv.desc || ''}`, `
    <div class="stats">${stat('Requested', fmt(inv.requested))}${stat('STO raised', fmt(inv.raised))}${stat('Received', fmt(inv.received))}${stat('Balance', fmt(inv.balance), inv.balance > EPS ? 'warn' : 'ok')}${stat('Stock avail.', st.length ? fmt(sum(st, s => s.avail)) : '—')}</div>
    <h4>Requested by well <small>${byWell.length}</small></h4>
    ${byWell.length ? `<table class="mini"><thead><tr><th>Well</th><th>Account</th><th>Discipline</th><th class="num">Req.</th><th class="num">Rcvd</th><th class="num">Bal.</th><th>Status</th></tr></thead><tbody>${byWell.map(x => `<tr><td>${lnk('well', x.w)}</td><td>${accTag(x.acc)}</td><td>${x.discs.map(d => DISC_SHORT[d]).join(', ')}</td><td class="num">${fmt(x.req)}</td><td class="num">${fmt(x.rcv)}</td><td class="num">${fmt(x.bal)}</td><td>${stageMark(x.stage)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Not requested in any loaded MTO.</p>'}
    <h4>MTO lines <small>${rows.length}</small></h4>
    ${rows.length ? `<table class="mini"><thead><tr><th>Well</th><th>File / row</th><th class="num">Qty</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr class="click" data-open="row:${esc(r.id)}"><td>${esc(r.wellId)}</td><td>${esc(r.file.slice(0, 40))} <span class="muted">#${r.row}</span></td><td class="num">${fmt(r.qty)} ${esc(r.uom)}</td><td>${stageMark(r.stage)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h4>Stock rows <small>${st.length}${D.stockBlob ? ' · STOCK ' + fmtDate(D.stockBlob.date) : ''}</small></h4>
    ${st.length ? `<table class="mini"><thead><tr><th>WBS</th><th>Plant / Sloc</th><th>Batch</th><th class="num">Available</th></tr></thead><tbody>${st.slice().sort((a, b) => b.avail - a.avail).map(s => `<tr><td class="mono">${esc(s.wbs)} ${accTag(accOf(s.wbs))}</td><td>${esc(s.plant)} ${esc(s.sloc)}</td><td>${esc(s.batch)}</td><td class="num">${fmt(s.avail)} ${esc(s.uom)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No stock rows.</p>'}
    <h4>STO lines (all wells) <small>${sto.length}</small></h4>${stoTable(sto.slice(0, 120))}`, null, 'Material');
}
function drawWell(id) {
  const w = D.W.get(id); const sl = D.STO.filter(l => l.wellId === id);
  if (!w) { openDrawer(`Well ${id}`, `<p class="muted">No MTO lines for this well.</p><h4>STO lines <small>${sl.length}</small></h4>${stoTable(sl, false)}`, null, 'Well'); return; }
  const dump = D.DUMP.filter(d => d.wellId === id);
  const tabs = Object.keys(w.discs).sort((a, b) => DISCS.indexOf(a) - DISCS.indexOf(b));
  openDrawer(`Well ${id}`, `
    <div class="d-sum">${accTag(w.acc)} <span class="muted">${esc(w.name || '')}</span></div>
    <div class="well-g"><div class="read"><b>${w.fillPct}<i>%</i></b><span>received<br>vs requested</span></div>${gauge(w.fillPct, { tone: w.acc })}</div>
    <div class="stats">${stat('Lines', fmtI(w.lines))}${stat('Received', fmtI(w.receivedLines), 'ok')}${stat('Part', fmtI(w.partLines))}${stat('Not raised', fmtI(w.notRaised), w.notRaised ? 'bad' : '')}${stat('Pending PE', fmtI(w.pendingPE), w.pendingPE ? 'warn' : '')}</div>
    ${kv([['Construction WBS', esc(w.wbs)], ['Well type', esc(w.wellType)], ['RAMZ ID', esc(w.ramz)], ['Area', esc(w.area)], ['Service PO (FLH)', w.po ? lnk('po', w.po.po, w.po.po + '/' + w.po.line) + `<br><small class="muted">${esc(w.po.desc)}</small>` : '<span class="t-warn">No CLA FLH PO line found</span>'], ['MTO files', [...w.files].map(fid => { const f = S.mto.find(x => x.id === fid); return f ? lnk('file', fid, f.disc) : ''; }).join(' · ')], ['STOs', w.stoNos.slice(0, 12).map(s => lnk('sto', s)).join(' ') + (w.stoNos.length > 12 ? ` +${w.stoNos.length - 12}` : '')]])}
    <h4>By discipline</h4>
    <div class="dtabs">${tabs.map((d, i) => { const k = kpis(w.discs[d]); return `<button data-dt="${i}" class="${i === 0 ? 'on' : ''}">${esc(d)}<b>${k.fillPct}%</b><small>${k.receivedLines}/${k.lines} received</small></button>`; }).join('')}</div>
    ${tabs.map((d, i) => `<div class="dpane" data-dp="${i}" ${i ? 'hidden' : ''}><table class="mini"><thead><tr><th>Material</th><th>Description</th><th class="num">Req.</th><th class="num">Rcvd</th><th>STO</th><th>Status</th></tr></thead><tbody>${w.discs[d].map(r => `<tr class="click" data-open="row:${esc(r.id)}"><td class="mono">${esc(r.material)}</td><td class="trunc">${esc(r.desc)}</td><td class="num">${fmt(r.qty)}</td><td class="num">${fmt(r.received)}</td><td class="mono">${esc(r.stoNo)}</td><td>${stageMark(r.stage)}</td></tr>`).join('')}</tbody></table></div>`).join('')}
    <div class="row"><button class="btn sm" data-goq="mto:well:${esc(id)}">Open in MTO register</button><button class="btn sm" data-wx>${icon('export')}Export this well…</button></div>
    ${dump.length ? `<h4>Excluded lines <small>${dump.length}</small></h4><ul class="plain">${dump.map(x => `<li><span class="fl ${x.reason === 'Struck out' ? 'fl-bad' : 'fl-warn'}">${esc(x.reason)}</span> ${esc(x.desc)}</li>`).join('')}</ul>` : ''}
    <h4>STO lines for this well <small>${sl.length}</small></h4>${stoTable(sl, false)}`, d => {
    d.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => { d.querySelectorAll('[data-dt]').forEach(x => x.classList.toggle('on', x === b)); d.querySelectorAll('[data-dp]').forEach(p => p.hidden = p.dataset.dp !== b.dataset.dt); });
    d.querySelector('[data-wx]').onclick = () => openExport({ rows: w.rows });
  }, ACC[w.acc] + ' · well');
}
function drawSto(no) {
  const ls = D.stoByNo.get(no) || []; if (!ls.length) return toast('STO not found');
  const f = ls[0]; const wells = uniq(ls.map(l => l.wellId));
  openDrawer(`STO ${no}`, `
    <div class="d-sum">${stageMark(f.stage)} <span class="muted">${esc(f.status)}</span></div>
    <div class="stats">${stat('Lines', fmtI(ls.length))}${stat('Requested on', fmtDate(f.reqOn))}${stat('VPS posted', fmtI(ls.filter(l => l.vpsDoc).length))}${stat('Wells', wells.length)}</div>
    ${kv([['Requested by', esc(f.reqBy)], ['Target WBS', esc(f.tgtWBS)], ['Target WBS descr.', esc(f.tgtWBSDesc)], ['Service PO', esc(f.po + (f.poItem ? '/' + f.poItem : ''))], ['RAMZ ID', esc(f.ramz)], ['Request remarks', esc(f.remarks)], ['Wells', wells.map(w => lnk('well', w, w || '—')).join(' ')]])}
    <h4>Lines</h4>${stoTable(ls.slice().sort((a, b) => a.item - b.item))}`, null, 'Stock transfer order');
}
function drawPo(po) {
  const ls = (PO && PO.rows || []).filter(r => r.po === po);
  openDrawer(`PO ${po}`, ls.length ? `<table class="mini"><thead><tr><th>Line</th><th>CLA</th><th>Issued</th><th>Location</th><th>Description</th><th>Wells</th></tr></thead><tbody>${ls.map(r => `<tr class="${r.cla === 'FLH' ? 'pick' : ''}"><td>${esc(r.line)}</td><td><b>${esc(r.cla)}</b></td><td>${fmtDate(r.date)}</td><td>${esc(r.loc)}</td><td>${esc(r.desc)}</td><td>${r.wells.filter(w => D.W.has(w)).map(w => lnk('well', w)).join(' ')}</td></tr>`).join('')}</tbody></table><p class="muted small">Highlighted: CLA FLH (flowline &amp; hook-up) lines, used as the Service PO.</p>` : '<p class="muted">PO not in the loaded P.O file.</p>', null, 'Purchase order');
}
function drawFile(fid) {
  const f = S.mto.find(x => x.id === fid); if (!f) return toast('MTO file not found'); const adm = isAdmin();
  const rows = D.ROWS.filter(r => r.fileId === fid); const k = kpis(rows);
  openDrawer(f.file, `
    <div class="d-sum">${accTag(f.acc)} ${discTag(f.disc)} <span class="muted">well ${lnk('well', f.wellId)}</span></div>
    <div class="stats">${stat('Lines', fmtI(f.lines.length))}${stat('Excluded', fmtI(f.dumped.length), f.dumped.length ? 'warn' : '')}${stat('Received %', k.fillPct + '%')}${stat('Imported', fmtDate((f.imported || '').slice(0, 10)))}</div>
    ${kv([['Job title', esc(f.meta.jobTitle)], ['WBS.NO.', esc(f.meta.wbs)], ['Project ID (RAMZ)', esc(f.meta.projectId)], ['Doc. no.', esc(f.meta.docNo)], ['Job no.', esc(f.meta.jobNo)], ['Site / area', esc([f.meta.site, f.meta.area].filter(Boolean).join(' · '))], ['Sheet', esc(f.sheet)]])}
    <h4>Correct detection ${adm ? '' : '<small>(admin only)</small>'}</h4>
    <div class="form2"><label class="fld"><span>Discipline</span><select id="fDisc" ${adm ? '' : 'disabled'}>${DISCS.concat('Unassigned').map(d => `<option ${f.disc === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="fld"><span>WBS.NO. (sets well ID and account)</span><input id="fWbs" value="${esc(f.meta.wbs)}" ${adm ? '' : 'disabled'}></label></div>
    ${adm ? `<div class="row"><button class="btn primary" data-fsave>Save</button><span class="grow"></span><button class="btn danger" data-fdel>${icon('trash')}Remove file</button></div>` : ''}
    <h4>Excluded lines <small>${f.dumped.length}</small></h4>${f.dumped.length ? `<table class="mini"><thead><tr><th>Row</th><th>Reason</th><th>Description</th></tr></thead><tbody>${f.dumped.map(x => `<tr><td>${x.row}</td><td><span class="fl ${x.reason === 'Struck out' ? 'fl-bad' : 'fl-warn'}">${esc(x.reason)}</span></td><td>${esc(x.desc)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">None.</p>'}`, d => {
    if (!adm) return;
    d.querySelector('[data-fsave]').onclick = () => { const w = $('#fWbs').value.trim().toUpperCase(); f.disc = $('#fDisc').value; f.meta.wbs = w; f.wellId = wellFromWBS(w); f.acc = accOf(w); f.modified = Date.now(); audit('Edit MTO file', f.file + ' -> ' + f.disc + ' ' + w); DSTACK.length = 0; closeDrawer(); commit(); };
    d.querySelector('[data-fdel]').onclick = () => confirmBox('Remove MTO file', `Remove ${esc(f.file)} and its ${f.lines.length} lines from the register?`, 'Remove', () => { S.mto = S.mto.filter(x => x.id !== fid); for (const k in S.edits.row) if (k.startsWith(fid + '#')) delete S.edits.row[k]; audit('Remove MTO file', f.file); DSTACK.length = 0; closeDrawer(); commit(); });
  }, 'MTO file');
}
