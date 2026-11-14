/* =====================================================================
   ui.js : components (icons, toasts, modal, drawer, grid, charts)
   ===================================================================== */
const IC = {
  dash: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  list: 'M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zm-4 6h2v2H3zm4 0h14v2H7z',
  hourglass: 'M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5-4-4V4h8v3.5l-4 4z',
  db: 'M12 3C7.6 3 4 4.3 4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3zm6 15c0 .5-2.2 1.5-6 1.5S6 18.5 6 18v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3V18zm0-4.5c0 .5-2.2 1.5-6 1.5s-6-1-6-1.5v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3v2.3zM12 9c-3.8 0-6-1-6-1.5S8.2 6 12 6s6 1 6 1.5S15.8 9 12 9z',
  flag: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
  pin: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z',
  box: 'M20 2H4c-1 0-2 .9-2 2v3c0 .7.4 1.4 1 1.7V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.6-.3 1-1 1-1.7V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
  download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
  upload: 'M5 20h14v-2H5v2zm0-10h4v6h6v-6h4l-7-7-7 7z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.6-1L14 3h-4l-.4 2.9a7.3 7.3 0 0 0-1.6 1l-2.5-1-2 3.5L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1 .7 1.6 1L10 21h4l.4-2.9c.6-.3 1.1-.6 1.6-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  lock: 'M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  unlock: 'M18 8h-8V6a2 2 0 0 1 4 0h2a4 4 0 0 0-8 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1z',
  moon: 'M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4A5.5 5.5 0 0 1 12.4 3.1 9 9 0 0 0 12 3z',
  auto: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18V4a8 8 0 0 1 0 16z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  folder: 'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z',
  edit: 'M3 17.2V21h3.8l11-11-3.8-3.8-11 11zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  refresh: 'M17.7 6.3A8 8 0 1 0 19.7 14h-2.1A6 6 0 1 1 12 6c1.7 0 3.1.7 4.2 1.8L13 11h7V4l-2.3 2.3z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z'
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n] || ''}"/></svg>`;

/* ---------------- toasts / modal / drawer ---------------- */
function toast(msg, tone = 'info', ms = 3800) {
  const t = document.createElement('div'); t.className = 'toast t-' + tone; t.innerHTML = esc(msg);
  $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}
function openModal({ title, body, actions = [], wide = false, onMount }) {
  const m = $('#modal');
  m.innerHTML = `<div class="m-back" data-close></div><div class="m-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="m-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div>
    <div class="m-body">${body}</div>
    <div class="m-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  m.hidden = false;
  m.onclick = e => {
    if (e.target.closest('[data-close]')) return closeModal();
    const b = e.target.closest('[data-act]'); if (b) { const a = actions[+b.dataset.act]; if (a && a.onClick) { const r = a.onClick(m); if (r !== false) closeModal(); } else closeModal(); }
  };
  if (onMount) onMount(m);
  const f = m.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; if (typeof Sync !== 'undefined' && Sync.needRender && $('#drawer').hidden) { Sync.needRender = false; render(); } }
function confirmBox(title, text, okLabel, fn, danger = true) { openModal({ title, body: `<p>${text}</p>`, actions: [{ label: 'Cancel' }, { label: okLabel, primary: !danger, danger, onClick: fn }] }); }
function openDrawer(title, html, onMount) {
  const d = $('#drawer');
  d.innerHTML = `<div class="d-back" data-dclose></div><aside class="d-box" role="dialog" aria-label="${esc(title)}"><div class="d-head"><h3>${esc(title)}</h3><button class="icon-btn" data-dclose aria-label="Close">${icon('close')}</button></div><div class="d-body">${html}</div></aside>`;
  d.hidden = false; d.onclick = e => { if (e.target.closest('[data-dclose]')) closeDrawer(); };
  if (onMount) onMount(d.querySelector('.d-box'));
}
function closeDrawer() { const d = $('#drawer'); d.hidden = true; d.innerHTML = ''; if (typeof Sync !== 'undefined' && Sync.needRender && $('#modal').hidden) { Sync.needRender = false; render(); } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (!$('#drawer').hidden) closeDrawer(); } });

/* ---------------- badges ---------------- */
const stageBadge = s => { const x = STAGES[s] || STAGES.PENDING_PE; return `<span class="badge s-${x.css}" title="${esc(x.label)}">${esc(x.short)}</span>`; };
const groupBadge = g => `<span class="badge s-${(GROUPS[g] || GROUPS.pending).css}">${esc((GROUPS[g] || {}).label || g)}</span>`;
const flagChips = (fl, max = 3) => { if (!fl || !fl.length) return ''; const u = []; const seen = new Set(); for (const f of fl) if (!seen.has(f.code)) { seen.add(f.code); u.push(f); } return u.slice(0, max).map(f => `<span class="chip f-${(FLAGS[f.code] || {}).tone || 'info'}" title="${esc(f.text)}">${esc((FLAGS[f.code] || { label: f.code }).label)}</span>`).join('') + (u.length > max ? `<span class="chip">+${u.length - max}</span>` : ''); };
const statusTone = s => ({ 'Complete': 'received', 'Not raised': 'notraised', 'Pending PE': 'pending', 'Approved': 'approved', 'Cancelled': 'cancel' }[s] || 'pending');
const deptDot = d => `<span class="dept d-${norm(d).replace(/ /g, '') || 'other'}">${esc(d || 'Other')}</span>`;

/* ---------------- data grid ---------------- */
const GRIDS = {};
function mountGrid(container, id, opts) {
  const g = GRIDS[id] || (GRIDS[id] = { q: '', f: {}, sort: null, dir: 1, page: 0, sel: new Set(), quick: 0, size: +S.settings.pageSize || 50 });
  g.opts = opts; g.cache = new WeakMap(); g.el = container;
  const cols = opts.columns; const fcols = cols.filter(c => c.filter);
  const fopts = {}; for (const c of fcols) fopts[c.k] = uniq(opts.rows.map(r => String(c.val(r) ?? ''))).filter(x => x !== '').sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  container.innerHTML = `<div class="grid" data-grid="${id}">
    <div class="g-tools">
      <label class="search">${icon('search')}<input type="search" placeholder="Search ${esc(opts.noun || 'rows')}..." value="${esc(g.q)}" data-gq aria-label="Search"></label>
      ${fcols.map(c => `<select data-gf="${c.k}" aria-label="Filter ${esc(c.label)}"><option value="">${esc(c.label)}: all</option>${fopts[c.k].map(v => `<option ${g.f[c.k] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`).join('')}
      ${opts.quick ? `<div class="seg">${opts.quick.map((q, i) => `<button data-gquick="${i}" class="${g.quick === i ? 'on' : ''}">${esc(q.label)}</button>`).join('')}</div>` : ''}
      <span class="g-count" data-gcount></span>
      <span class="grow"></span>
      ${opts.tools || ''}
      <button class="btn sm" data-gexport title="Export the filtered rows of this table to Excel">${icon('download')}Export view</button>
    </div>
    ${opts.selectable ? `<div class="g-bulk" data-gbulk hidden></div>` : ''}
    <div class="tbl-wrap"><table class="tbl ${opts.cls || ''}"><thead><tr>
      ${opts.selectable ? '<th class="ck"><input type="checkbox" data-gall aria-label="Select page"></th>' : ''}
      ${cols.map(c => `<th data-gs="${c.k}" class="${c.num ? 'num' : ''} ${c.cls || ''}" style="${c.w ? 'min-width:' + c.w : ''}" title="${esc(c.title || 'Sort by ' + c.label)}">${esc(c.label)}<i class="sorti"></i></th>`).join('')}
    </tr></thead><tbody data-gbody></tbody></table></div>
    <div class="g-pager" data-gpager></div></div>`;
  const root = container.querySelector('.grid');
  let tmr;
  root.addEventListener('input', e => { if (e.target.matches('[data-gq]')) { clearTimeout(tmr); tmr = setTimeout(() => { g.q = e.target.value; g.page = 0; gridRefresh(id); }, 160); } });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-gf]')) { g.f[t.dataset.gf] = t.value; g.page = 0; gridRefresh(id); }
    else if (t.matches('[data-gsize]')) { g.size = +t.value; g.page = 0; gridRefresh(id); }
    else if (t.matches('[data-gall]')) { const rows = gridPage(g); for (const r of rows) { const k = opts.rowKey(r); t.checked ? g.sel.add(k) : g.sel.delete(k); } gridRefresh(id); }
    else if (t.matches('[data-gck]')) { const k = t.dataset.gck; t.checked ? g.sel.add(k) : g.sel.delete(k); gridBulk(id); }
  });
  root.addEventListener('click', e => {
    const t = e.target;
    const th = t.closest('th[data-gs]'); if (th) { const k = th.dataset.gs; if (g.sort === k) g.dir = -g.dir; else { g.sort = k; g.dir = (cols.find(c => c.k === k) || {}).num ? -1 : 1; } gridRefresh(id); return; }
    const qb = t.closest('[data-gquick]'); if (qb) { g.quick = +qb.dataset.gquick; g.page = 0; $$('[data-gquick]', root).forEach(b => b.classList.toggle('on', b === qb)); gridRefresh(id); return; }
    const pg = t.closest('[data-gpage]'); if (pg) { g.page = +pg.dataset.gpage; gridRefresh(id); root.querySelector('.tbl-wrap').scrollTop = 0; return; }
    if (t.closest('[data-gexport]')) { exportGridView(id); return; }
    if (t.closest('[data-gclearsel]')) { g.sel.clear(); gridRefresh(id); return; }
    const bb = t.closest('[data-gbulkact]'); if (bb) { const act = (opts.bulk || [])[+bb.dataset.gbulkact]; if (act) act.fn(gridSelected(id)); return; }
    if (t.closest('input,button,a,select,label')) return;
    const tr = t.closest('tr[data-gk]'); if (tr && opts.onRow) { const r = g.map && g.map.get(tr.dataset.gk); if (r) opts.onRow(r); }
  });
  gridRefresh(id);
  return g;
}
function gridRows(g) {
  const o = g.opts; let rows = o.rows;
  if (o.quick && o.quick[g.quick] && o.quick[g.quick].fn) rows = rows.filter(o.quick[g.quick].fn);
  for (const k in g.f) if (g.f[k]) { const c = o.columns.find(x => x.k === k); if (c) rows = rows.filter(r => String(c.val(r) ?? '') === g.f[k]); }
  if (g.q) {
    const terms = norm(g.q).split(' ').filter(Boolean);
    rows = rows.filter(r => { let t = g.cache.get(r); if (t == null) { t = norm(o.columns.map(c => c.val(r)).join(' ') + ' ' + (o.searchExtra ? o.searchExtra(r) : '')); g.cache.set(r, t); } return terms.every(x => t.includes(x)); });
  }
  if (g.sort) {
    const c = o.columns.find(x => x.k === g.sort);
    if (c) { const sv = c.sortVal || c.val; rows = rows.slice().sort((a, b) => { const x = sv(a), y = sv(b); if (c.num) return ((+x || 0) - (+y || 0)) * g.dir; return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true }) * g.dir; }); }
  }
  return rows;
}
function gridPage(g) { const rows = gridRows(g); g.last = rows; const n = Math.max(1, Math.ceil(rows.length / g.size)); if (g.page >= n) g.page = n - 1; return rows.slice(g.page * g.size, g.page * g.size + g.size); }
function gridRefresh(id) {
  const g = GRIDS[id]; if (!g || !g.el.isConnected) return; const o = g.opts; const root = g.el.querySelector('.grid');
  const page = gridPage(g); const total = g.last.length; g.map = new Map();
  const body = page.map(r => {
    const k = String(o.rowKey(r)); g.map.set(k, r);
    return `<tr data-gk="${esc(k)}" class="${o.rowClass ? o.rowClass(r) : ''} ${o.onRow ? 'click' : ''}">${o.selectable ? `<td class="ck"><input type="checkbox" data-gck="${esc(k)}" ${g.sel.has(k) ? 'checked' : ''} aria-label="Select row"></td>` : ''}${o.columns.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html ? c.html(r) : esc(c.num ? fmt(c.val(r)) : c.val(r))}</td>`).join('')}</tr>`;
  }).join('');
  root.querySelector('[data-gbody]').innerHTML = body || `<tr><td class="empty" colspan="${o.columns.length + (o.selectable ? 1 : 0)}">${esc(o.empty || 'No rows match the current filters.')}</td></tr>`;
  root.querySelector('[data-gcount]').textContent = `${fmtI(total)} of ${fmtI(o.rows.length)}`;
  $$('th[data-gs]', root).forEach(th => { th.classList.toggle('sorted', th.dataset.gs === g.sort); th.classList.toggle('desc', th.dataset.gs === g.sort && g.dir < 0); });
  const n = Math.max(1, Math.ceil(total / g.size)); const p = g.page;
  const btn = (i, l = i + 1) => `<button data-gpage="${i}" class="${i === p ? 'on' : ''}" ${i < 0 || i >= n ? 'disabled' : ''}>${l}</button>`;
  let pages = []; for (let i = 0; i < n; i++) if (i < 2 || i >= n - 2 || Math.abs(i - p) <= 2) pages.push(i); else if (pages[pages.length - 1] !== '...') pages.push('...');
  root.querySelector('[data-gpager]').innerHTML = `<span>Rows per page <select data-gsize>${[25, 50, 100, 250, 500].map(s => `<option ${s === g.size ? 'selected' : ''}>${s}</option>`).join('')}</select></span><span class="grow"></span>${btn(p - 1, 'Prev')}${pages.map(i => i === '...' ? '<span class="dots">...</span>' : btn(i)).join('')}${btn(p + 1, 'Next')}`;
  const all = root.querySelector('[data-gall]'); if (all) all.checked = page.length > 0 && page.every(r => g.sel.has(String(o.rowKey(r))));
  gridBulk(id);
}
function gridSelected(id) { const g = GRIDS[id]; const k = g.opts.rowKey; return g.opts.rows.filter(r => g.sel.has(String(k(r)))); }
function gridBulk(id) {
  const g = GRIDS[id]; const el = g.el.querySelector('[data-gbulk]'); if (!el) return;
  const n = g.sel.size; el.hidden = !n;
  if (n) el.innerHTML = `<b>${fmtI(n)} selected</b>${(g.opts.bulk || []).map((b, i) => (b.admin && !isAdmin()) ? '' : `<button class="btn sm" data-gbulkact="${i}">${esc(b.label)}</button>`).join('')}<button class="btn sm ghost" data-gclearsel>Clear selection</button>`;
}
function exportGridView(id) {
  const g = GRIDS[id]; const rows = g.last || gridRows(g); const cols = g.opts.columns.filter(c => !c.noExport);
  const aoa = [cols.map(c => c.label)].concat(rows.map(r => cols.map(c => { const v = c.xval ? c.xval(r) : c.val(r); return v == null ? '' : v; })));
  const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, styledSheet(aoa, { widths: cols.map(c => c.xw || (c.num ? 12 : 18)), numCols: cols.map(c => !!c.num) }), sheetName(g.opts.exportName || 'Export'));
  saveWB(wb, `${S.settings.exportPrefix} - ${g.opts.exportName || 'Export'} - ${todayISO()}.xlsx`);
}

/* ---------------- charts (inline SVG / CSS) ---------------- */
function barsH(items, { fmtV = fmtI, max } = {}) {
  const mx = max || Math.max(1, ...items.map(i => i.value));
  if (!items.length) return '<p class="muted">No data.</p>';
  return `<div class="barsH">${items.map(i => `<div class="bh-row ${i.attr ? 'click' : ''}" ${i.attr || ''} title="${esc(i.label)}: ${fmtV(i.value)}"><div class="bh-label">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</div><div class="bh-track"><div class="bh-fill" style="width:${Math.max(.5, i.value / mx * 100).toFixed(1)}%;background:${i.color || 'var(--primary)'}"></div></div><div class="bh-val">${fmtV(i.value)}</div></div>`).join('')}</div>`;
}
function stackBar(parts, { legend = true, height = 14 } = {}) {
  const tot = sum(parts, p => p.value);
  return `<div class="stack" style="height:${height}px" role="img" aria-label="${esc(parts.map(p => p.label + ' ' + p.value).join(', '))}">${tot ? parts.filter(p => p.value > 0).map(p => `<span style="width:${(p.value / tot * 100).toFixed(2)}%;background:${p.color}" title="${esc(p.label)}: ${fmtI(p.value)} (${pct(p.value, tot)}%)"></span>`).join('') : '<span class="empty-stack"></span>'}</div>` +
    (legend ? `<div class="legend">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)} <b>${fmtI(p.value)}</b>${tot ? ` <em>${pct(p.value, tot)}%</em>` : ''}</span>`).join('')}</div>` : '');
}
function donut(parts, { size = 168, thick = 24, center = '', sub = '' } = {}) {
  const tot = sum(parts, p => p.value); const r = (size - thick) / 2; const C = 2 * Math.PI * r; let off = 0;
  const segs = tot ? parts.filter(p => p.value > 0).map(p => { const len = p.value / tot * C; const s = `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${p.color}" stroke-width="${thick}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${esc(p.label)}: ${fmtI(p.value)} (${pct(p.value, tot)}%)</title></circle>`; off += len; return s; }).join('') : '';
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(parts.map(p => p.label + ' ' + p.value).join(', '))}"><circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--surface-3)" stroke-width="${thick}"/><g transform="rotate(-90 ${size / 2} ${size / 2})">${segs}</g><text x="50%" y="48%" text-anchor="middle" class="d-c">${esc(center)}</text><text x="50%" y="62%" text-anchor="middle" class="d-s">${esc(sub)}</text></svg>
  <div class="legend col">${parts.map(p => `<span><i style="background:${p.color}"></i>${esc(p.label)} <b>${fmtI(p.value)}</b></span>`).join('')}</div></div>`;
}
function columnsChart(items, { h = 150 } = {}) {
  const mx = Math.max(1, ...items.map(i => i.value));
  return `<div class="cols" style="height:${h}px">${items.map(i => `<div class="col" title="${esc(i.label)}: ${fmtI(i.value)}"><b>${fmtI(i.value)}</b><span style="height:${(i.value / mx * 100).toFixed(1)}%;background:${i.color || 'var(--primary)'}"></span><em>${esc(i.label)}</em></div>`).join('')}</div>`;
}
const SC = { notraised: 'var(--s-notraised)', prior: 'var(--s-prior)', pending: 'var(--s-pending)', approved: 'var(--s-approved)', delivery: 'var(--s-delivery)', transit: 'var(--s-transit)', received: 'var(--s-received)', cancel: 'var(--s-cancel)' };
const stageColor = s => SC[(STAGES[s] || {}).css] || 'var(--primary)';
const GC = { pending: 'var(--s-pending)', approved: 'var(--s-approved)', issued: 'var(--s-received)', cancelled: 'var(--s-cancel)', notraised: 'var(--s-notraised)' };
