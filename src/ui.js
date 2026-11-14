/* =====================================================================
   ui.js : icons, toasts, modal, drawer, combobox, virtual grid, charts
   ===================================================================== */
const IC = {
  dash: 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z',
  mto: 'M4 4h16v3H4zm0 5h16v2H4zm0 4h16v2H4zm0 4h10v2H4z',
  sto: 'M3 7l9-4 9 4v10l-9 4-9-4zm9-1.8L6.4 7.6 12 10l5.6-2.4zM5 9.3v6.4l6 2.7v-6.4zm8 9.1 6-2.7V9.3l-6 2.7z',
  inv: 'M4 5h16v4H4zm1 6h14v8H5zm4 2v2h6v-2z',
  well: 'M11 2h2v4h3l-2 6h-1v10h-2V12h-1L8 6h3zM5 22l2-6h2l-2 6zm12-6h2l2 6h-2z',
  excl: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM6 12h12v2H6z',
  data: 'M12 3C7.6 3 4 4.3 4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3zm6 15c0 .5-2.2 1.5-6 1.5S6 18.5 6 18v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3zm0-4.5c0 .5-2.2 1.5-6 1.5s-6-1-6-1.5v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3zM12 9c-3.8 0-6-1-6-1.5S8.2 6 12 6s6 1 6 1.5S15.8 9 12 9z',
  export: 'M12 3l5 5h-3v6h-4V8H7zM4 18h16v3H4z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 0 0-1.6-1L14 3h-4l-.4 2.9a7.3 7.3 0 0 0-1.6 1l-2.5-1-2 3.5L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1 .7 1.6 1L10 21h4l.4-2.9c.6-.3 1.1-.6 1.6-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  lock: 'M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  unlock: 'M18 8h-8V6a2 2 0 0 1 4 0h2a4 4 0 0 0-8 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1z',
  moon: 'M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4A5.5 5.5 0 0 1 12.4 3.1 9 9 0 0 0 12 3z',
  auto: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18V4a8 8 0 0 1 0 16z',
  pin: 'M16 3l5 5-3 1-3 3 1 5-2 2-4-4-5 5H4v-1l5-5-4-4 2-2 5 1 3-3z',
  menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  down: 'M7 10l5 5 5-5z',
  up: 'M7 14l5-5 5 5z',
  cols: 'M3 4h5v16H3zm6.5 0h5v16h-5zM16 4h5v16h-5z',
  upload: 'M5 20h14v-2H5v2zm0-10h4v6h6v-6h4l-7-7-7 7z',
  download: 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z',
  folder: 'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  edit: 'M3 17.2V21h3.8l11-11-3.8-3.8-11 11zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  arrow: 'M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  bolt: 'M11 21h-1l1-7H7.5c-.6 0-.6-.3-.4-.7L13 3h1l-1 7h3.5c.5 0 .6.3.4.7z'
};
const icon = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n] || ''}"/></svg>`;

/* ---------------- toast / modal / drawer ---------------- */
function toast(msg, tone = 'info', ms = 3600) {
  const t = document.createElement('div'); t.className = 'toast t-' + tone; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
}
function openModal({ title, body, actions = [], wide = false, onMount }) {
  const m = $('#modal');
  m.innerHTML = `<div class="m-back" data-close></div><div class="m-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="m-head"><h3>${esc(title)}</h3><button class="ibtn" data-close aria-label="Close">${icon('close')}</button></div>
    <div class="m-body">${body}</div>
    <div class="m-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  m.hidden = false;
  m.onclick = e => {
    if (e.target.closest('[data-close]')) return closeModal();
    const b = e.target.closest('[data-act]'); if (b) { const a = actions[+b.dataset.act]; if (a && a.onClick) { const r = a.onClick(m); if (r !== false) closeModal(); } else closeModal(); }
  };
  if (onMount) onMount(m);
  const f = m.querySelector('input:not([type=checkbox]),textarea'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; afterOverlay(); }
function confirmBox(title, text, okLabel, fn, danger = true) { openModal({ title, body: `<p>${text}</p>`, actions: [{ label: 'Cancel' }, { label: okLabel, primary: !danger, danger, onClick: fn }] }); }
const DSTACK = [];
function openDrawer(title, html, onMount, kicker = '') {
  const d = $('#drawer');
  d.innerHTML = `<div class="d-back" data-dclose></div><aside class="d-box" role="dialog" aria-label="${esc(title)}"><div class="d-head">${DSTACK.length ? `<button class="ibtn" data-dback title="Back">${icon('arrow', 'flip')}</button>` : ''}<div class="d-title">${kicker ? `<small>${esc(kicker)}</small>` : ''}<h3>${esc(title)}</h3></div><button class="ibtn" data-dclose aria-label="Close">${icon('close')}</button></div><div class="d-body">${html}</div></aside>`;
  d.hidden = false;
  d.onclick = e => { if (e.target.closest('[data-dclose]')) { DSTACK.length = 0; closeDrawer(); } else if (e.target.closest('[data-dback]')) { const prev = DSTACK.pop(); if (prev) prev(true); } };
  if (onMount) onMount(d.querySelector('.d-box'));
}
function closeDrawer() { const d = $('#drawer'); d.hidden = true; d.innerHTML = ''; afterOverlay(); }
function afterOverlay() { if (typeof Sync !== 'undefined' && Sync.needRender && $('#modal').hidden && $('#drawer').hidden) { Sync.needRender = false; render(); } }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#pop').hidden) return closePop(); if (!$('#cmdk').hidden) return closeCmdk(); if (!$('#modal').hidden) return closeModal(); if (!$('#drawer').hidden) { DSTACK.length = 0; return closeDrawer(); } }
});

/* ---------------- status / flag marks ---------------- */
const stageMark = s => { const x = STAGES[s] || STAGES.NOT_RAISED; return `<span class="st st-${x.css}" title="${esc(x.label)}"><i></i>${esc(x.short)}</span>`; };
const flagMarks = (fl, max = 2) => { if (!fl || !fl.length) return ''; return fl.slice(0, max).map(f => `<span class="fl fl-${(FLAGS[f.code] || {}).tone || 'info'}" title="${esc(f.text)}">${esc((FLAGS[f.code] || { label: f.code }).label)}</span>`).join('') + (fl.length > max ? `<span class="fl" title="${esc(fl.slice(max).map(f => f.text).join('\n'))}">+${fl.length - max}</span>` : ''); };
const accTag = a => `<span class="acc acc-${a}">${esc(ACC[a] || a)}</span>`;
const discTag = d => `<span class="disc" data-d="${esc(DISC_SHORT[d] || '')}">${esc(d)}</span>`;
/* clickable references: open a drill-down drawer */
const lnk = (kind, id, text, cls = '') => id ? `<a href="#" class="ref ${cls}" data-open="${kind}:${esc(id)}">${esc(text ?? id)}</a>` : '';

/* ---------------- popover + combobox (searchable dropdown) ---------------- */
let POP = null;
function openPop(anchor, html, onMount, minW = 260) {
  const p = $('#pop'); p.innerHTML = html; p.hidden = false;
  const r = anchor.getBoundingClientRect(); const w = Math.max(minW, r.width);
  p.style.minWidth = w + 'px';
  const left = Math.min(r.left, window.innerWidth - w - 8); p.style.left = Math.max(8, left) + 'px';
  const below = window.innerHeight - r.bottom; const ph = Math.min(420, p.scrollHeight);
  p.style.top = (below < ph + 12 && r.top > ph ? r.top - ph - 4 : r.bottom + 4) + 'px';
  POP = { anchor }; if (onMount) onMount(p);
}
function closePop() { const p = $('#pop'); p.hidden = true; p.innerHTML = ''; POP = null; }
document.addEventListener('mousedown', e => { if (POP && !e.target.closest('#pop') && !e.target.closest('[data-combo]') && !e.target.closest('[data-popbtn]')) closePop(); });
window.addEventListener('resize', () => closePop());

const COMBOS = {};
/* options: [{v, l, sub, n}]; value: string (single) or array (multi) */
function combo(id, { value, options, placeholder = 'All', onChange, multi = false, label = '', wide = false, allLabel }) {
  COMBOS[id] = { value, options, onChange, multi, placeholder, allLabel };
  return `<button type="button" class="combo ${wide ? 'wide' : ''} ${comboHasValue(id) ? 'set' : ''}" data-combo="${id}" aria-haspopup="listbox">${label ? `<em>${esc(label)}</em>` : ''}<span>${esc(comboText(id))}</span>${icon('down')}</button>`;
}
function comboHasValue(id) { const c = COMBOS[id]; return c.multi ? (c.value || []).length > 0 : !!c.value; }
function comboText(id) {
  const c = COMBOS[id];
  if (c.multi) { const v = c.value || []; if (!v.length) return c.placeholder; if (v.length === 1) return (c.options.find(o => o.v === v[0]) || { l: v[0] }).l; return v.length + ' selected'; }
  if (!c.value) return c.placeholder; const o = c.options.find(o => o.v === c.value); return o ? o.l : c.value;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-combo]'); if (!b) return;
  e.preventDefault(); const id = b.dataset.combo; const c = COMBOS[id]; if (!c) return;
  if (POP && POP.anchor === b) return closePop();
  const listHtml = q => {
    const t = norm(q); const opts = t ? c.options.filter(o => norm(o.l + ' ' + (o.sub || '') + ' ' + o.v).includes(t)) : c.options;
    const sel = c.multi ? new Set(c.value || []) : new Set([c.value || '']);
    const head = c.multi ? '' : `<li data-v="" class="${!c.value ? 'on' : ''}">${esc(c.allLabel || c.placeholder)}</li>`;
    return head + opts.slice(0, 400).map(o => `<li data-v="${esc(o.v)}" class="${sel.has(o.v) ? 'on' : ''}">${c.multi ? `<b class="ck">${sel.has(o.v) ? icon('check') : ''}</b>` : ''}<span>${esc(o.l)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.n != null ? `<em>${fmtI(o.n)}</em>` : ''}</li>`).join('') + (opts.length > 400 ? `<li class="more">${opts.length - 400} more - type to narrow</li>` : '') + (!opts.length ? '<li class="more">No match</li>' : '');
  };
  openPop(b, `<div class="cb"><label class="cb-s">${icon('search')}<input placeholder="Search ${c.options.length} option${c.options.length === 1 ? '' : 's'}..." aria-label="Search options"></label>${c.multi ? '<div class="cb-tools"><button data-cball>Select shown</button><button data-cbnone>Clear</button></div>' : ''}<ul role="listbox">${listHtml('')}</ul></div>`, p => {
    const inp = p.querySelector('input'), ul = p.querySelector('ul'); let act = -1;
    const commit = v => { if (c.multi) { const s = new Set(c.value || []); s.has(v) ? s.delete(v) : s.add(v); c.value = [...s]; ul.innerHTML = listHtml(inp.value); } else { c.value = v; closePop(); } b.querySelector('span').textContent = comboText(id); b.classList.toggle('set', comboHasValue(id)); c.onChange && c.onChange(c.value); };
    inp.addEventListener('input', () => { ul.innerHTML = listHtml(inp.value); act = -1; });
    inp.addEventListener('keydown', ev => {
      const items = $$('li[data-v]', ul);
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); act = Math.max(0, Math.min(items.length - 1, act + (ev.key === 'ArrowDown' ? 1 : -1))); items.forEach((li, i) => li.classList.toggle('act', i === act)); items[act] && items[act].scrollIntoView({ block: 'nearest' }); }
      if (ev.key === 'Enter') { ev.preventDefault(); const li = items[act >= 0 ? act : (inp.value ? (c.multi ? 0 : 1) : -1)]; if (li) commit(li.dataset.v); }
    });
    ul.addEventListener('click', ev => { const li = ev.target.closest('li[data-v]'); if (li) commit(li.dataset.v); });
    const all = p.querySelector('[data-cball]'); if (all) all.onclick = () => { const t = norm(inp.value); const shown = (t ? c.options.filter(o => norm(o.l + ' ' + (o.sub || '') + ' ' + o.v).includes(t)) : c.options).map(o => o.v); c.value = uniq([...(c.value || []), ...shown]); ul.innerHTML = listHtml(inp.value); b.querySelector('span').textContent = comboText(id); b.classList.add('set'); c.onChange && c.onChange(c.value); };
    const none = p.querySelector('[data-cbnone]'); if (none) none.onclick = () => { c.value = []; ul.innerHTML = listHtml(inp.value); b.querySelector('span').textContent = comboText(id); b.classList.remove('set'); c.onChange && c.onChange(c.value); };
    setTimeout(() => inp.focus(), 10);
  });
});
const optsFrom = (rows, f, labelF, subF) => { const m = new Map(); for (const r of rows) { const v = f(r); if (v == null || v === '') continue; m.set(v, (m.get(v) || 0) + 1); } return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([v, n]) => ({ v: String(v), l: labelF ? labelF(v) : String(v), sub: subF ? subF(v) : '', n })); };

/* ---------------- virtual data grid ---------------- */
const GRIDS = {};
function gridState(id) { return GRIDS[id] || (GRIDS[id] = { q: '', f: {}, sort: null, dir: 1, sel: new Set(), quick: 0, hidden: new Set(((S.ui.cols || {})[id]) || []) }); }
function mountGrid(el, id, o) {
  const g = gridState(id); g.o = o; g.el = el; g.cache = new WeakMap(); g.rowH = document.documentElement.dataset.density === 'compact' ? 28 : 33;
  if (!g.hiddenInit && o.defaultHidden) { g.hidden = new Set(((S.ui.cols || {})[id]) || o.defaultHidden); g.hiddenInit = true; }
  const fcols = o.columns.filter(c => c.filter);
  el.innerHTML = `<section class="grid" data-grid="${id}">
    <div class="g-bar">
      <label class="g-search">${icon('search')}<input type="search" placeholder="Search ${esc(o.noun || 'rows')}" value="${esc(g.q)}" data-gq aria-label="Search"></label>
      ${o.quick ? `<div class="seg" role="tablist">${o.quick.map((q, i) => `<button data-gquick="${i}" class="${g.quick === i ? 'on' : ''}" title="${esc(q.title || '')}">${esc(q.label)}<b data-qn="${i}"></b></button>`).join('')}</div>` : ''}
      <span class="g-count" data-gcount></span><span class="grow"></span>
      ${o.tools || ''}
      <button class="btn sm ghost" data-popbtn="cols" title="Show / hide columns">${icon('cols')}Columns</button>
      <button class="btn sm ghost" data-gexport title="Export the rows shown to Excel">${icon('download')}Excel</button>
    </div>
    ${fcols.length ? `<div class="g-filters">${fcols.map(c => combo(`gf-${id}-${c.k}`, { value: g.f[c.k] || [], multi: true, label: c.label, placeholder: 'All', options: optsFrom(o.rows, r => c.fval ? c.fval(r) : c.val(r), c.flabel), onChange: v => { g.f[c.k] = v; gridRefresh(id); } })).join('')}<button class="lnk" data-gclear>Clear filters</button></div>` : ''}
    <div class="g-bulk" data-gbulk hidden></div>
    <div class="vwrap" data-vw><table class="tbl"><colgroup></colgroup><thead></thead><tbody></tbody></table></div>
  </section>`;
  const root = el.querySelector('.grid'); g.root = root; g.vw = root.querySelector('[data-vw]');
  let tmr, raf = 0;
  root.addEventListener('input', e => { if (e.target.matches('[data-gq]')) { clearTimeout(tmr); tmr = setTimeout(() => { g.q = e.target.value; gridRefresh(id); }, 140); } });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-gall]')) { for (const r of g.view) { const k = String(o.rowKey(r)); t.checked ? g.sel.add(k) : g.sel.delete(k); } gridDraw(id); gridBulk(id); }
    else if (t.matches('[data-gck]')) { const k = t.dataset.gck; t.checked ? g.sel.add(k) : g.sel.delete(k); gridBulk(id); }
  });
  root.addEventListener('click', e => {
    const t = e.target;
    const th = t.closest('th[data-gs]'); if (th) { const k = th.dataset.gs; if (g.sort === k) g.dir = -g.dir; else { g.sort = k; g.dir = (o.columns.find(c => c.k === k) || {}).num ? -1 : 1; } gridRefresh(id); return; }
    const qb = t.closest('[data-gquick]'); if (qb) { g.quick = +qb.dataset.gquick; $$('[data-gquick]', root).forEach(b => b.classList.toggle('on', b === qb)); gridRefresh(id); return; }
    if (t.closest('[data-gexport]')) return exportGridView(id);
    if (t.closest('[data-gclear]')) { g.f = {}; g.q = ''; mountGrid(el, id, o); return; }
    if (t.closest('[data-popbtn="cols"]')) return colChooser(id, t.closest('[data-popbtn]'));
    if (t.closest('[data-gclearsel]')) { g.sel.clear(); gridDraw(id); gridBulk(id); return; }
    const bb = t.closest('[data-gbulkact]'); if (bb) { const a = (o.bulk || [])[+bb.dataset.gbulkact]; if (a) a.fn(o.rows.filter(r => g.sel.has(String(o.rowKey(r))))); return; }
    if (t.closest('a,input,button,label,select')) return;
    const tr = t.closest('tr[data-gk]'); if (tr && o.onRow) { const r = g.map.get(tr.dataset.gk); if (r) o.onRow(r); }
  });
  g.vw.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; gridDraw(id); }); }, { passive: true });
  gridHead(id); gridRefresh(id); fitGrid(id);
  return g;
}
function fitGrid(id) { const g = GRIDS[id]; if (!g || !g.vw.isConnected) return; const top = g.vw.getBoundingClientRect().top; g.vw.style.height = Math.max(300, window.innerHeight - top - 14) + 'px'; gridDraw(id); }
window.addEventListener('resize', () => { for (const id in GRIDS) if (GRIDS[id].vw && GRIDS[id].vw.isConnected) fitGrid(id); });
function visCols(g) { return g.o.columns.filter(c => !g.hidden.has(c.k)); }
function gridHead(id) {
  const g = GRIDS[id], o = g.o, cols = visCols(g), tbl = g.root.querySelector('table');
  const ck = o.selectable ? 34 : 0; const total = ck + sum(cols, c => c.w || 120);
  tbl.style.width = total + 'px';
  tbl.querySelector('colgroup').innerHTML = (o.selectable ? '<col style="width:34px">' : '') + cols.map(c => `<col style="width:${c.w || 120}px">`).join('');
  let bands = '';
  if (cols.some(c => c.band)) {
    const groups = []; for (const c of cols) { const b = c.band || ''; const last = groups[groups.length - 1]; if (last && last.b === b) last.n++; else groups.push({ b, n: 1 }); }
    bands = `<tr class="bands">${o.selectable ? '<th></th>' : ''}${groups.map(x => `<th colspan="${x.n}" class="${x.b ? 'band b-' + x.b : ''}">${x.b ? esc(BAND_LABEL[x.b] || '') : ''}</th>`).join('')}</tr>`;
  }
  tbl.querySelector('thead').innerHTML = bands + `<tr>${o.selectable ? '<th class="ck"><input type="checkbox" data-gall aria-label="Select all rows shown"></th>' : ''}${cols.map(c => `<th data-gs="${c.k}" class="${c.num ? 'num' : ''} ${c.band ? 'hb-' + c.band : ''} ${g.sort === c.k ? 'sorted' + (g.dir < 0 ? ' desc' : '') : ''}" title="${esc(c.title || c.label)}">${esc(c.label)}<i class="si"></i></th>`).join('')}</tr>`;
}
function gridRows(g) {
  const o = g.o; let rows = o.rows;
  if (o.quick && o.quick[g.quick] && o.quick[g.quick].fn) rows = rows.filter(o.quick[g.quick].fn);
  for (const k in g.f) { const v = g.f[k]; if (!v || !v.length) continue; const c = o.columns.find(x => x.k === k); if (!c) continue; const set = new Set(v); const f = c.fval || c.val; rows = rows.filter(r => set.has(String(f(r) ?? ''))); }
  if (g.q) {
    const terms = norm(g.q).split(' ').filter(Boolean);
    rows = rows.filter(r => { let t = g.cache.get(r); if (t == null) { t = norm(o.columns.map(c => c.val(r)).join(' ') + ' ' + (o.searchExtra ? o.searchExtra(r) : '')); g.cache.set(r, t); } return terms.every(x => t.includes(x)); });
  }
  if (g.sort) { const c = o.columns.find(x => x.k === g.sort); if (c) { const sv = c.sortVal || c.val; rows = rows.slice().sort((a, b) => { const x = sv(a), y = sv(b); if (c.num) return ((x == null ? -Infinity : +x) - (y == null ? -Infinity : +y)) * g.dir; return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true }) * g.dir; }); } }
  return rows;
}
function gridRefresh(id) {
  const g = GRIDS[id]; if (!g || !g.root.isConnected) return; const o = g.o;
  g.view = gridRows(g); g.map = new Map(); for (const r of g.view) g.map.set(String(o.rowKey(r)), r);
  g.root.querySelector('[data-gcount]').innerHTML = `<b>${fmtI(g.view.length)}</b> of ${fmtI(o.rows.length)}`;
  if (o.quick) o.quick.forEach((q, i) => { const el = g.root.querySelector(`[data-qn="${i}"]`); if (el) el.textContent = q.fn ? fmtI(o.rows.filter(q.fn).length) : fmtI(o.rows.length); });
  gridHead(id); g.vw.scrollTop = 0; gridDraw(id); gridBulk(id);
}
function gridDraw(id) {
  const g = GRIDS[id]; if (!g || !g.view) return; const o = g.o, cols = visCols(g), rows = g.view, H = g.rowH;
  const top = g.vw.scrollTop, h = g.vw.clientHeight || 600;
  const start = Math.max(0, Math.floor(top / H) - 8), end = Math.min(rows.length, Math.ceil((top + h) / H) + 8);
  const span = cols.length + (o.selectable ? 1 : 0);
  let html = start ? `<tr class="sp"><td colspan="${span}" style="height:${start * H}px"></td></tr>` : '';
  for (let i = start; i < end; i++) {
    const r = rows[i]; const k = String(o.rowKey(r));
    html += `<tr data-gk="${esc(k)}" class="${o.rowClass ? o.rowClass(r) : ''} ${o.onRow ? 'click' : ''}" style="height:${H}px">${o.selectable ? `<td class="ck"><input type="checkbox" data-gck="${esc(k)}" ${g.sel.has(k) ? 'checked' : ''} aria-label="Select row"></td>` : ''}${cols.map(c => { const v = c.val(r); const txt = c.html ? c.html(r) : esc(c.num ? fmt(v) : v); return `<td class="${c.num ? 'num' : ''} ${c.cls || ''} ${c.cellClass ? c.cellClass(r) : ''}" title="${c.html ? '' : esc(v)}">${txt}</td>`; }).join('')}</tr>`;
  }
  if (end < rows.length) html += `<tr class="sp"><td colspan="${span}" style="height:${(rows.length - end) * H}px"></td></tr>`;
  if (!rows.length) html = `<tr><td class="empty" colspan="${span}">${esc(o.empty || 'Nothing matches these filters.')}</td></tr>`;
  g.root.querySelector('tbody').innerHTML = html;
  const all = g.root.querySelector('[data-gall]'); if (all) all.checked = rows.length > 0 && rows.every(r => g.sel.has(String(o.rowKey(r))));
}
function gridBulk(id) {
  const g = GRIDS[id]; const el = g.root.querySelector('[data-gbulk]'); if (!el) return; const n = g.sel.size; el.hidden = !n;
  if (n) el.innerHTML = `<b>${fmtI(n)} selected</b>${(g.o.bulk || []).map((b, i) => (b.admin && !isAdmin()) ? '' : `<button class="btn sm" data-gbulkact="${i}">${esc(b.label)}</button>`).join('')}<button class="lnk" data-gclearsel>Clear</button>`;
}
function colChooser(id, btn) {
  const g = GRIDS[id];
  openPop(btn, `<div class="cb colsel"><div class="cb-tools"><button data-call>Show all</button>${g.o.defaultHidden ? '<button data-cdef>Default</button>' : ''}</div><ul>${g.o.columns.map(c => `<li data-ck="${c.k}" class="${g.hidden.has(c.k) ? '' : 'on'}"><b class="ck">${g.hidden.has(c.k) ? '' : icon('check')}</b><span>${esc(c.label)}${c.band ? `<small>${esc(BAND_LABEL[c.band])}</small>` : ''}</span></li>`).join('')}</ul></div>`, p => {
    const save = () => { S.ui.cols = S.ui.cols || {}; S.ui.cols[id] = [...g.hidden]; persist(true); gridHead(id); gridDraw(id); };
    p.addEventListener('click', e => {
      const li = e.target.closest('[data-ck]'); if (li) { const k = li.dataset.ck; g.hidden.has(k) ? g.hidden.delete(k) : g.hidden.add(k); li.classList.toggle('on'); li.querySelector('.ck').innerHTML = g.hidden.has(k) ? '' : icon('check'); save(); }
      if (e.target.closest('[data-call]')) { g.hidden.clear(); $$('[data-ck]', p).forEach(l => { l.classList.add('on'); l.querySelector('.ck').innerHTML = icon('check'); }); save(); }
      if (e.target.closest('[data-cdef]')) { g.hidden = new Set(g.o.defaultHidden); closePop(); save(); }
    });
  }, 240);
}
function exportGridView(id) {
  const g = GRIDS[id]; const cols = visCols(g).filter(c => !c.noExport);
  const aoa = [cols.map(c => c.label)].concat(g.view.map(r => cols.map(c => { const v = c.xval ? c.xval(r) : c.val(r); return v == null ? '' : v; })));
  const wb = XL.utils.book_new();
  XL.utils.book_append_sheet(wb, styledSheet(aoa, { widths: cols.map(c => Math.max(8, Math.round((c.w || 120) / 7))), numCols: cols.map(c => !!c.num), bands: cols.map(c => c.band || '') }), sheetName(g.o.exportName || 'Export'));
  saveWB(wb, `${S.settings.exportPrefix} - ${g.o.exportName || 'Export'} - ${todayISO()}.xlsx`);
}

/* ---------------- charts ---------------- */
/* segmented gauge, 0..100 */
function gauge(p, { segs = 25, tone = '' } = {}) {
  const on = Math.round(p / 100 * segs);
  return `<div class="gauge ${tone}" role="img" aria-label="${p}%">${Array.from({ length: segs }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`;
}
/* stage pipeline */
function pipeline(rows, clickable = true) {
  const order = ['NOT_RAISED', 'PENDING_PE', 'APPROVED', 'AWAIT_DELIVERY', 'IN_TRANSIT', 'PART_RECEIVED', 'RECEIVED'];
  const cnt = {}; for (const r of rows) cnt[r.stage] = (cnt[r.stage] || 0) + 1; const tot = rows.length || 1;
  return `<div class="pipe">${order.map(s => `<div class="pipe-s st-${STAGES[s].css} ${clickable ? 'click' : ''}" ${clickable ? `data-goq="mto:stage:${s}"` : ''} style="flex:${Math.max(cnt[s] || 0, tot * 0.04)}" title="${esc(STAGES[s].label)}"><b>${fmtI(cnt[s] || 0)}</b><span>${esc(STAGES[s].short)}</span></div>`).join('')}</div>`;
}
const heat = p => `hsl(${Math.round(4 + p * 1.25)} 55% ${document.documentElement.dataset.theme === 'dark' ? 30 : 86}%)`;
