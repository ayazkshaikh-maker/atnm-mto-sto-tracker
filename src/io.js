/* =====================================================================
   io.js : imports, Excel exports, data sources, settings, init
   ===================================================================== */

/* ---------------- import ---------------- */
function pickFiles(folder) {
  if (!S.settings.viewerImport && !isAdmin()) return needAdmin(() => pickFiles(folder));
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.xlsx,.xlsm,.xls,.json';
  if (folder) inp.webkitdirectory = true;
  inp.onchange = () => handleFiles([...inp.files]); inp.click();
}
function bindDrop(el) {
  const z = el.querySelector('[data-drop]'); if (!z) return;
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); });
  z.addEventListener('dragleave', () => z.classList.remove('over'));
  z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('over'); if (!S.settings.viewerImport && !isAdmin()) return needAdmin(); handleFiles([...e.dataTransfer.files]); });
}
document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => { if (e.target.closest('[data-drop]')) return; if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); if (!S.settings.viewerImport && !isAdmin()) return needAdmin(); handleFiles([...e.dataTransfer.files]); } });
const isXl = f => /\.(xlsx|xlsm|xls)$/i.test(f.name) && !/^~\$/.test(f.name);
async function handleFiles(files) {
  const json = files.find(f => /\.json$/i.test(f.name)); if (json && files.length === 1) return restoreBackup(json);
  files = files.filter(isXl);
  if (!files.length) return toast('No Excel files found (.xlsx / .xls)', 'warn');
  const done = showBusy(`Reading ${files.length} file(s)…`); const items = [];
  for (const f of files) {
    try {
      const u8 = new Uint8Array(await f.arrayBuffer());
      const wb = XL.read(u8, { type: 'array', cellDates: false });
      const fi = { name: f.name, sig: f.name + '|' + f.size + '|' + f.lastModified };
      const found = analyzeWorkbook(wb, fi, u8);
      if (!found.length) items.push({ kind: 'unknown', file: f.name, sig: fi.sig });
      for (const it of found) { it.known = S.fileSigs[it.sig + '|' + it.kind + '|' + (it.sheet || '')]; items.push(it); }
    } catch (e) { console.error(e); items.push({ kind: 'error', file: f.name, error: String(e.message || e) }); }
    await new Promise(r => setTimeout(r, 0));
  }
  done(); importPreview(items);
}
function showBusy(msg) { const b = document.createElement('div'); b.className = 'busy'; b.innerHTML = `<div><span class="spin"></span>${esc(msg)}</div>`; document.body.appendChild(b); return () => b.remove(); }
const KIND = { mto: 'MTO', sto: 'STO report', stock: 'STOCK', po: 'P.O / work orders', template: 'Template', unknown: 'Not recognised', error: 'Read error' };
function importPreview(items) {
  const ok = it => ['mto', 'sto', 'stock', 'po', 'template'].includes(it.kind);
  const order = { mto: 0, po: 1, sto: 2, stock: 3, template: 4 };
  items.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
  const row = (it, i) => {
    let info = '', ctl = '';
    if (it.kind === 'mto') { info = `<b>${it.lines.length}</b> lines · well <b>${esc(it.wellId || '?')}</b> · ${accTag(it.acc)} · ${it.dumped.length} excluded (${it.dumped.filter(d => d.reason === 'Struck out').length} struck out)<br><small>${esc(it.meta.jobTitle)} · ${esc(it.meta.wbs || 'WBS not found')}</small>`; ctl = `<select data-idisc="${i}" aria-label="Discipline">${DISCS.concat('Unassigned').map(d => `<option ${d === it.disc ? 'selected' : ''}>${d}</option>`).join('')}</select>`; }
    if (it.kind === 'sto') { info = `<b>${fmtI(it.lines.length)}</b> STO lines · ${uniq(it.lines.map(l => l.sto)).length} STOs · ${it.lines.filter(l => l.vpsDoc).length} with VPS doc${it.dupDropped ? ` · ${it.dupDropped} duplicate rows dropped (kept highest Available Qty)` : ''}`; ctl = `<input type="date" data-idate="${i}" value="${it.date}" title="Report date (from ${esc(it.dateSrc)})">`; }
    if (it.kind === 'stock') { info = `<b>${fmtI(it.lines.length)}</b> stock rows · ${uniq(it.lines.map(l => l.material)).length} materials${it.dupDropped ? ` · ${it.dupDropped} duplicates dropped (kept highest Available Qty)` : ''}${it.otherSheets ? `<br><small>Used sheet "${esc(it.sheet)}", skipped subset sheet(s) ${esc(it.otherSheets.join(', '))}</small>` : ''}`; ctl = `<input type="date" data-idate="${i}" value="${it.date}" title="Stock date (from ${esc(it.dateSrc)})">`; }
    if (it.kind === 'po') info = `<b>${fmtI(it.count)}</b> PO lines · ${it.rows.filter(r => r.cla === 'FLH').length} with CLA FLH`;
    if (it.kind === 'template') info = `Header layout (${it.header.filter(Boolean).length} columns) - used for exports${it.rowsWithData ? `; its ${it.rowsWithData} data rows are not imported` : ''}`;
    if (it.kind === 'unknown') info = 'No MTO / STO / STOCK / PO / template header found - skipped.';
    if (it.kind === 'error') info = esc(it.error);
    return `<tr class="${ok(it) ? '' : 'dim'}"><td><input type="checkbox" data-iinc="${i}" ${ok(it) ? 'checked' : 'disabled'} aria-label="Include"></td><td><span class="kind k-${it.kind}">${KIND[it.kind]}</span></td><td class="wrap"><b>${esc(it.file)}</b>${it.sheet ? ` <small class="muted">[${esc(it.sheet)}]</small>` : ''}<br><small>${info}</small>${it.known ? '<br><small class="t-warn">Imported before - will replace.</small>' : ''}</td><td>${ctl}</td></tr>`;
  };
  openModal({
    title: `Import ${items.filter(ok).length} dataset(s)`, wide: true,
    body: `<p class="muted small">Recognised from the columns. Check discipline (from the job title) and the dates; the newest STO report and STOCK file are used.</p><div class="tbl-x"><table class="mini imp"><thead><tr><th></th><th>Type</th><th>File</th><th>Discipline / date</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Import', primary: true, onClick: m => {
      $$('[data-idate]', m).forEach(x => items[+x.dataset.idate].date = x.value || todayISO());
      $$('[data-idisc]', m).forEach(x => items[+x.dataset.idisc].disc = x.value);
      commitImport(items.filter((it, i) => { const c = m.querySelector(`[data-iinc="${i}"]`); return c && c.checked; }));
    } }]
  });
}
async function commitImport(items) {
  if (!items.length) return;
  const now = new Date().toISOString(); const msgs = []; const done = showBusy('Saving…');
  for (const it of items) {
    if (it.kind === 'mto') {
      const id = 'M-' + norm(it.file).replace(/ /g, '_').slice(0, 70) + '-' + norm(it.sheet).replace(/ /g, '_').slice(0, 30);
      S.mto = S.mto.filter(f => f.id !== id);
      S.mto.push({ id, file: it.file, sheet: it.sheet, imported: now, modified: Date.now(), meta: it.meta, wellId: it.wellId, acc: it.acc, disc: it.disc, wellType: it.wellType, lines: it.lines, dumped: it.dumped });
      msgs.push(`MTO ${it.disc} ${it.wellId}: ${it.lines.length}`);
    } else if (it.kind === 'sto' || it.kind === 'stock') {
      const id = (it.kind === 'sto' ? 'S-' : 'K-') + it.date + '-' + norm(it.file).replace(/ /g, '_').slice(0, 50);
      S.snapshots = S.snapshots.filter(s => s.id !== id);
      S.snapshots.push({ id, kind: it.kind, file: it.file, date: it.date, imported: now, modified: Date.now(), count: it.lines.length, stos: it.kind === 'sto' ? uniq(it.lines.map(l => l.sto)).length : undefined });
      SNAP[id] = it.lines; await idb.set('snap:' + id, it.lines); Sync.queueSnap(id);
      msgs.push(`${it.kind.toUpperCase()} ${fmtDate(it.date)}: ${fmtI(it.lines.length)}`);
    } else if (it.kind === 'po') {
      PO = { file: it.file, imported: now, rows: (PO && PO.file === it.file && PO.imported === now ? PO.rows : []).concat(it.rows) };
      S.poMeta = { file: it.file, imported: now, count: PO.rows.length }; await idb.set('po', PO); Sync.queuePo();
      msgs.push(`PO: ${fmtI(it.count)}`);
    } else if (it.kind === 'template') { S.template = { file: it.file, header: it.header, imported: now }; msgs.push('Template header'); }
    S.fileSigs[it.sig + '|' + it.kind + '|' + (it.sheet || '')] = now;
  }
  audit('Import', msgs.join('; ')); rebuild(); persist(); done(); render();
  toast('Imported · ' + msgs.join(' · '), 'ok', 6000);
}

/* ---------------- Excel helpers ---------------- */
const BRD = { style: 'thin', color: { rgb: 'A6A6A6' } }, BORDER = { top: BRD, bottom: BRD, left: BRD, right: BRD };
const XS = { hdr: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '000000' } }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: BORDER }, cell: { font: { sz: 10, name: 'Calibri' }, border: BORDER, alignment: { vertical: 'top' } } };
const BAND_FILL = { G: 'C5E0B3', Y: 'FFFF00', P: 'FFE699', B: 'D9E1F2' };
const sheetName = s => String(s).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Sheet';
function styledSheet(aoa, { widths, numCols, bands, fillData = false, rowFill } = {}) {
  const ws = XL.utils.aoa_to_sheet(aoa); const R = XL.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = R.s.r; r <= R.e.r; r++) for (let c = R.s.c; c <= R.e.c; c++) {
    const a = XL.utils.encode_cell({ r, c }); if (!ws[a]) ws[a] = { t: 's', v: '' };
    const band = bands && bands[c]; const fill = band && BAND_FILL[band] ? { patternType: 'solid', fgColor: { rgb: BAND_FILL[band] } } : null;
    if (r === 0) ws[a].s = Object.assign({}, XS.hdr, fill ? { fill } : { fill: { patternType: 'solid', fgColor: { rgb: 'E7E6E6' } } });
    else { const rf = rowFill && rowFill(r - 1); ws[a].s = Object.assign({}, XS.cell, rf ? { fill: { patternType: 'solid', fgColor: { rgb: rf } } } : (fillData && fill ? { fill } : {})); if (numCols && numCols[c] && ws[a].t === 'n') ws[a].z = '#,##0.###'; }
  }
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  if (aoa.length > 1) ws['!autofilter'] = { ref: XL.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R.e.r, c: R.e.c } }) };
  return ws;
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function saveWB(wb, name) {
  try { const out = XL.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true }); download(name.replace(/[\\\/:*?"<>|]+/g, ' '), new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); audit('Export', name); persist(true); toast('Exported ' + name, 'ok'); }
  catch (e) { console.error(e); toast('Export failed: ' + e.message, 'bad', 6000); }
}
const xNum = v => (typeof v === 'string' && /^\d{1,15}$/.test(v)) ? Number(v) : v;

/* ---------------- export dialog: MTO in the STO PO Standard request template ---------------- */
const EXP = { acc: [], wells: [], discs: [], stages: [], vps: 'any', avail: 'any', sto: 'any', qtyPos: true, flagged: false, cols: 'tplsto', qty: 'mto', group: 'well', fill: true, base: 'view' };
function expFilter(rows, o) {
  return rows.filter(r => (!o.acc.length || o.acc.includes(r.acc)) && (!o.wells.length || o.wells.includes(r.wellId)) && (!o.discs.length || o.discs.includes(r.disc)) && (!o.stages.length || o.stages.includes(r.stage))
    && (o.vps === 'any' || (o.vps === 'empty' ? !r.vpsDoc : !!r.vpsDoc)) && (o.avail === 'any' || (o.avail === 'only' ? r.reqGtAvail : !r.reqGtAvail))
    && (o.sto === 'any' || (o.sto === 'raised' ? r.stoLines.length > 0 : !r.stoLines.length)) && (!o.flagged || r.flags.length > 0) && (!o.qtyPos || expQty(r, o) > EPS));
}
const expQty = (r, o) => o.qty === 'balance' ? r.balance : o.qty === 'notraised' ? Math.max(0, r.qty - r.stoQty) : r.qty;
function openExport({ rows, preset } = {}) {
  if (!D || !D.ROWS.length) return toast('Load MTO files first', 'warn');
  const o = Object.assign(EXP, { acc: [], wells: [], discs: [], stages: [] }, preset || {});
  const viewRows = rows && rows.length ? rows : null; if (!viewRows) o.base = 'all';
  const base = () => o.base === 'view' && viewRows ? viewRows : D.ROWS;
  const seg = (k, opts) => `<div class="seg" data-seg="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(o[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const body = () => `
    <div class="xg">
      <div class="xl">Start from</div><div>${seg('base', (viewRows ? [['view', `Rows shown (${fmtI(viewRows.length)})`]] : []).concat([['all', `All MTO lines (${fmtI(D.ROWS.length)})`]]))}</div>
      <div class="xl">Account</div><div>${combo('x-acc', { value: o.acc, multi: true, placeholder: 'All accounts', options: ACC_KEYS.map(a => ({ v: a, l: ACC[a], n: D.ROWS.filter(r => r.acc === a).length })).filter(x => x.n), onChange: v => { o.acc = v; upd(); } })}</div>
      <div class="xl">Wells</div><div>${combo('x-well', { value: o.wells, multi: true, placeholder: 'All wells', options: [...D.W.values()].map(w => ({ v: w.id, l: w.id, sub: ACC[w.acc] + ' · ' + (w.name || ''), n: w.lines })), onChange: v => { o.wells = v; upd(); } })}</div>
      <div class="xl">Discipline</div><div>${combo('x-disc', { value: o.discs, multi: true, placeholder: 'All disciplines', options: DISCS.map(d => ({ v: d, l: d, n: D.ROWS.filter(r => r.disc === d).length })).filter(x => x.n), onChange: v => { o.discs = v; upd(); } })}</div>
      <div class="xl">Status</div><div>${combo('x-stage', { value: o.stages, multi: true, placeholder: 'Any status', options: Object.keys(STAGES).map(s => ({ v: s, l: STAGES[s].label, n: D.ROWS.filter(r => r.stage === s).length })).filter(x => x.n), onChange: v => { o.stages = v; upd(); } })}</div>
      <div class="xl">VPS column</div><div>${seg('vps', [['any', 'Any'], ['empty', 'Empty · nothing received'], ['filled', 'Filled · received']])}</div>
      <div class="xl">Request vs available</div><div>${seg('avail', [['any', 'Any'], ['only', 'Request > available'], ['ok', 'Within available']])}</div>
      <div class="xl">STO</div><div>${seg('sto', [['any', 'Any'], ['raised', 'Raised in SAP'], ['none', 'Not raised']])}</div>
      <div class="xl">Request Qty column</div><div>${seg('qty', [['mto', 'MTO qty'], ['balance', 'Balance (MTO − received)'], ['notraised', 'Not yet raised (MTO − STO)']])}</div>
      <div class="xl">Columns</div><div>${seg('cols', [['tpl', 'Template only (22)'], ['tplsto', 'Template + STO / VPS'], ['full', 'Full register']])}</div>
      <div class="xl">Sheets</div><div>${seg('group', [['one', 'One sheet'], ['well', 'Per well'], ['acc', 'Per account'], ['disc', 'Per discipline']])}</div>
      <div class="xl">Options</div><div class="chks"><label class="chk"><input type="checkbox" data-o="qtyPos" ${o.qtyPos ? 'checked' : ''}> Skip zero quantity</label><label class="chk"><input type="checkbox" data-o="flagged" ${o.flagged ? 'checked' : ''}> Flagged lines only</label><label class="chk"><input type="checkbox" data-o="fill" ${o.fill ? 'checked' : ''}> Template colours on cells</label></div>
    </div>
    <div class="xcount" data-xc></div>`;
  let mEl = null;
  const upd = () => { if (!mEl) return; const n = expFilter(base(), o); const w = uniq(n.map(r => r.wellId)).length; mEl.querySelector('[data-xc]').innerHTML = `<b>${fmtI(n.length)}</b> lines · ${w} well(s) · ${uniq(n.map(r => r.disc)).length} discipline(s) will be exported`; };
  openModal({ title: 'Export MTO · STO PO Standard request template', wide: true, body: body(),
    actions: [{ label: 'Cancel' }, { label: 'Export .xlsx', primary: true, onClick: () => { const n = expFilter(base(), o); if (!n.length) { toast('No lines match these filters', 'warn'); return false; } exportTemplate(n, o); } }],
    onMount: m => {
      mEl = m;
      m.addEventListener('click', e => { const b = e.target.closest('[data-seg] [data-v]'); if (!b) return; const k = b.closest('[data-seg]').dataset.seg; o[k] = b.dataset.v === 'true' ? true : b.dataset.v; $$('button', b.parentNode).forEach(x => x.classList.toggle('on', x === b)); upd(); });
      m.addEventListener('change', e => { const c = e.target.closest('[data-o]'); if (c) { o[c.dataset.o] = c.checked; upd(); } });
      upd();
    } });
}
function exportTemplate(rows, o) {
  const header = (S.template && S.template.header && S.template.header.filter(Boolean).length >= 10) ? S.template.header.slice() : TEMPLATE_COLS.map(c => c[1]);
  while (header.length && !header[header.length - 1]) header.pop();
  const cm = colMap(header, TPL_ALIASES); const keyAt = {}; for (const k in cm) keyAt[cm[k]] = k;
  const bandOf = k => { const t = TEMPLATE_COLS.find(c => c[0] === k); if (!t) return ''; return k === 'sapQty' ? 'G' : (t[2] === 'N' ? '' : t[2]); };
  const extra = o.cols === 'tpl' ? [] : o.cols === 'tplsto'
    ? [['STO Item', r => r.stoItem, 'B'], ['STO Request Qty', r => r.stoLines.length ? r3(r.stoQty) : '', 'B'], ['STO Request On', r => fmtDate(r.stoReqOn), 'B'], ['STO count', r => r.stoCount || '', ''], ['VPS Mat Doc', r => r.vpsDoc, ''], ['Received Qty', r => r3(r.received), ''], ['Balance', r => r3(r.balance), ''], ['Tracker status', r => STAGES[r.stage].label, ''], ['Account', r => ACC[r.acc], ''], ['MTO file', r => r.file, '']]
    : mtoCols().filter(c => !['n', 'material', 'desc', 'uom', 'qty', 'sapQty', 'plant', 'sloc', 'slocDesc', 'batch', 'valType', 'wbs', 'wellType', 'wellId', 'procWBS', 'docHeader', 'ramz', 'servicePO', 'stoNo', 'stoStatus', 'col1', 'disc'].includes(c.k)).map(c => [c.label, r => { const v = c.xval ? c.xval(r) : c.val(r); return c.k === 'stoReqOn' ? fmtDate(v) : v; }, c.band || '']);
  const val = (r, k, i) => {
    switch (k) {
      case 'sr': return i + 1; case 'material': return xNum(r.material); case 'qty': return r3(expQty(r, o)); case 'sapQty': return r.sapQty == null ? '' : r.sapQty;
      case 'wellId': return xNum(r.wellId); case 'disc': return r.disc; case 'stoStatus': return r.stoStatus; case 'stoNo': return xNum(r.stoNo);
      default: return r[k] == null ? '' : r[k];
    }
  };
  const gk = { one: () => 'MTO', well: r => r.wellId || 'no well', acc: r => ACC[r.acc], disc: r => r.disc }[o.group];
  const wb = XL.utils.book_new();
  for (const [name, rs] of [...groupBy(rows, gk)].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))) {
    const aoa = [header.concat(extra.map(x => x[0]))].concat(rs.map((r, i) => header.map((h, c) => keyAt[c] ? val(r, keyAt[c], i) : '').concat(extra.map(x => x[1](r) ?? ''))));
    const bands = header.map((h, c) => keyAt[c] ? bandOf(keyAt[c]) : '').concat(extra.map(x => x[2]));
    const widths = header.map((h, c) => ({ desc: 44, docHeader: 32, wbs: 26, procWBS: 26, col1: 34, stoStatus: 26, slocDesc: 18 }[keyAt[c]] || Math.max(9, Math.min(16, String(h).length + 2)))).concat(extra.map(x => Math.max(10, x[0].length + 2)));
    XL.utils.book_append_sheet(wb, styledSheet(aoa, { widths, bands, fillData: o.fill, numCols: header.map((h, c) => ['qty', 'sapQty'].includes(keyAt[c])).concat(extra.map(() => false)) }), sheetName(name));
  }
  const tag = o.group === 'well' && uniq(rows.map(r => r.wellId)).length === 1 ? 'Well ' + rows[0].wellId : `${uniq(rows.map(r => r.wellId)).length} wells`;
  saveWB(wb, `${S.settings.exportPrefix} - STO PO Request - ${tag} - ${todayISO()}.xlsx`);
}
function exportSimple(name, cols, rows, sheet) {
  const wb = XL.utils.book_new(); const aoa = [cols.map(c => c[0])].concat(rows.map(r => cols.map(c => { const v = c[1](r); return v == null ? '' : v; })));
  XL.utils.book_append_sheet(wb, styledSheet(aoa, { widths: cols.map(c => c[2] || 14) }), sheetName(sheet || name)); return wb;
}
function exportWorkbook() {
  const wb = XL.utils.book_new(); const add = (nm, cols, rows) => { const aoa = [cols.map(c => c[0])].concat(rows.map(r => cols.map(c => { const v = c[1](r); return v == null ? '' : v; }))); XL.utils.book_append_sheet(wb, styledSheet(aoa, { widths: cols.map(c => c[2] || 14) }), sheetName(nm)); };
  const sum1 = [['Tracker', S.settings.title], ['Exported', fmtDate(todayISO())], ['MTO files', S.mto.length], ['MTO lines', D.ROWS.length], ['Excluded lines', D.DUMP.length], ['STO report', D.latestSto ? fmtDate(D.latestSto.date) : '-'], ['STOCK file', D.stockBlob ? fmtDate(D.stockBlob.date) : '-'], ['PO lines', S.poMeta ? S.poMeta.count : '-']];
  for (const a of ACC_KEYS) { const k = kpis(D.ROWS.filter(r => r.acc === a)); if (k.lines) sum1.push([ACC[a] + ' received %', k.fillPct + '%'], [ACC[a] + ' lines received / requested', k.receivedLines + ' / ' + k.lines]); }
  add('Summary', [['Item', r => r[0], 30], ['Value', r => r[1], 40]], sum1);
  const mc = mtoCols(); add('MTO', mc.map(c => [c.label, r => { const v = c.xval ? c.xval(r) : c.val(r); return c.k === 'stoReqOn' ? fmtDate(v) : (c.k === 'material' ? xNum(v) : v); }, Math.round((c.w || 120) / 7)]), D.ROWS);
  const inv = inventoryRows(D.ROWS); add('Material master', [['Material', a => xNum(a.material), 12], ['Description', a => a.desc, 44], ['UoM', a => a.uom, 6], ['Disciplines', a => [...a.discs].join(', '), 26], ['Wells', a => [...a.wells].join(', '), 20], ['Requested', a => r3(a.requested)], ['STO raised', a => r3(a.raised)], ['Received', a => r3(a.received)], ['Balance', a => r3(a.balance)], ['Received %', a => a.fillPct], ['Stock available', a => a.hasStock ? a.stock : ''], ['Projected', a => a.hasStock ? r3(a.projected) : '']], inv);
  add('Wells', [['Well', w => xNum(w.id), 9], ['Account', w => ACC[w.acc], 14], ['Name', w => w.name, 34], ['WBS', w => w.wbs, 26], ['Service PO', w => w.po ? w.po.po + '/' + w.po.line : '', 16], ['Disciplines', w => Object.keys(w.discs).join(', '), 30], ['Lines', w => w.lines], ['Received', w => w.receivedLines], ['Open', w => w.openLines], ['Not raised', w => w.notRaised], ['Received %', w => w.fillPct]], [...D.W.values()]);
  add('Excluded lines', [['Reason', d => d.reason, 26], ['Well', d => xNum(d.wellId)], ['Discipline', d => d.disc, 18], ['File', d => d.file, 40], ['Excel row', d => d.row], ['Description', d => d.desc, 44], ['Qty', d => d.qty], ['Unit', d => d.unit], ['Material (raw)', d => d.material, 14]], D.DUMP);
  const wellSet = new Set(D.W.keys()); add('STO lines (MTO wells)', [['Request STO', l => xNum(l.sto), 12], ['Item', l => +l.item || l.item], ['STO Status', l => l.status, 26], ['Material', l => xNum(l.material), 12], ['Description', l => l.desc, 40], ['Request Qty', l => l.qty], ['UoM', l => l.uom], ['Target WBS', l => l.tgtWBS, 26], ['Well', l => xNum(l.wellId)], ['Request On', l => fmtDate(l.reqOn)], ['VPS Mat Doc', l => l.vpsDoc, 14]], D.STO.filter(l => wellSet.has(l.wellId)));
  saveWB(wb, `${S.settings.exportPrefix} - Tracker workbook - ${todayISO()}.xlsx`);
}

/* ---------------- export view ---------------- */
V.exports = el => {
  const card = (t, d, a, b) => `<section class="panel xcard"><header><h2>${t}</h2></header><p>${d}</p><div class="row">${b}</div></section>`;
  el.innerHTML = `<div class="xcards">
    ${card('STO PO Standard request', 'The MTO register in the template layout - green from MTO, yellow from STOCK, gold from PO, light blue from STO. Filter by account, wells, discipline, status, empty VPS column, request above available stock, and more.', '', `<button class="btn primary" data-x="tpl">${icon('export')}Choose filters…</button>`)}
    ${card('Nothing received yet', 'Shortcut: every line whose VPS column is empty, Request Qty = balance, one sheet per well.', '', `<button class="btn" data-x="novps">${icon('download')}Export</button>`)}
    ${card('Request above available stock', 'Lines where the Request Qty is higher than the Available Qty in the STOCK file.', '', `<button class="btn" data-x="avail">${icon('download')}Export</button>`)}
    ${card('Material master', 'Requested, STO raised, received, balance, stock and projected stock per material for the current scope.', '', `<button class="btn" data-x="inv">${icon('download')}Export</button>`)}
    ${card('Whole tracker workbook', 'Summary with received % per account, full MTO register, material master, wells, excluded lines and the STO lines for MTO wells.', '', `<button class="btn" data-x="wb">${icon('download')}Export</button>`)}
    ${card('Database backup', 'Everything (MTO files, edits, settings, STO / STOCK / PO data) as one .json file. Restore it from Settings on any PC.', '', `<button class="btn" data-x="json">${icon('download')}Download backup</button>`)}
  </div>`;
  el.onclick = e => {
    const b = e.target.closest('[data-x]'); if (!b) return; const k = b.dataset.x;
    if (k === 'tpl') openExport({ rows: D.ROWS.filter(inScope) });
    if (k === 'novps') openExport({ rows: D.ROWS.filter(inScope), preset: { vps: 'empty', qty: 'balance', group: 'well' } });
    if (k === 'avail') openExport({ rows: D.ROWS.filter(inScope), preset: { avail: 'only', group: 'well' } });
    if (k === 'inv') { const inv = inventoryRows(D.ROWS.filter(inScope), S.ui.acc); saveWB(exportSimple('Material master', [['Material', a => xNum(a.material), 12], ['Description', a => a.desc, 44], ['UoM', a => a.uom, 6], ['Disciplines', a => [...a.discs].join(', '), 26], ['Wells', a => [...a.wells].join(', '), 20], ['Requested', a => r3(a.requested)], ['STO raised', a => r3(a.raised)], ['Received', a => r3(a.received)], ['Balance', a => r3(a.balance)], ['Received %', a => a.fillPct], ['Stock available', a => a.hasStock ? a.stock : ''], ['Projected', a => a.hasStock ? r3(a.projected) : '']], inv), `${S.settings.exportPrefix} - Material master - ${todayISO()}.xlsx`); }
    if (k === 'wb') exportWorkbook();
    if (k === 'json') backup();
  };
};

/* ---------------- data sources ---------------- */
V.data = el => {
  const adm = isAdmin(), canImp = adm || S.settings.viewerImport;
  const stos = S.snapshots.filter(s => s.kind === 'sto').sort((a, b) => b.date.localeCompare(a.date)), stocks = S.snapshots.filter(s => s.kind === 'stock').sort((a, b) => b.date.localeCompare(a.date));
  const tbl = (h, rows) => rows.length ? `<table class="mini"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="muted small">None loaded.</p>';
  const del = (attr, id) => adm ? `<button class="ibtn sm" data-${attr}="${esc(id)}" title="Remove">${icon('trash')}</button>` : '';
  el.innerHTML = `
  <ol class="steps wide">${stepCards()}</ol>
  <div class="drop slim" data-drop>${icon('upload')}<b>Drop files anywhere on the page</b><span>or</span><button class="btn primary sm" data-import-folder ${canImp ? '' : 'disabled'}>${icon('folder')}Load folder</button><button class="btn sm" data-import ${canImp ? '' : 'disabled'}>${icon('file')}Choose files</button>${window.showDirectoryPicker ? `<button class="btn sm" data-link ${canImp ? '' : 'disabled'}>Scan linked folder</button>` : ''}</div>
  <section class="panel"><header><h2>1 · MTO files</h2><small>${S.mto.length} files · ${fmtI(D.ROWS.length)} lines · ${D.DUMP.length} excluded</small></header>
    ${tbl(['File', 'Discipline', 'Well', 'Account', 'WBS', 'Lines', 'Excluded', 'Imported', ''], S.mto.slice().sort((a, b) => a.wellId.localeCompare(b.wellId, undefined, { numeric: true }) || DISCS.indexOf(a.disc) - DISCS.indexOf(b.disc)).map(f => [lnk('file', f.id, f.file), discTag(f.disc), lnk('well', f.wellId), accTag(f.acc), `<span class="mono">${esc(f.meta.wbs)}</span>`, f.lines.length, f.dumped.length, fmtDate((f.imported || '').slice(0, 10)), del('fdel', f.id)]))}</section>
  <div class="grid2">
    <section class="panel"><header><h2>2 · P.O with work orders</h2></header>${S.poMeta ? `<p>${esc(S.poMeta.file)} · <b>${fmtI(S.poMeta.count)}</b> PO lines · ${fmtDate(S.poMeta.imported.slice(0, 10))} ${adm ? '<button class="lnk" data-podel>remove</button>' : ''}</p><p class="muted small">${[...D.W.values()].filter(w => w.po).length} of ${D.W.size} MTO wells have a CLA FLH service PO.</p>` : '<p class="muted small">Not loaded.</p>'}</section>
    <section class="panel"><header><h2>Template layout</h2></header>${S.template ? `<p>${esc(S.template.file)} · ${S.template.header.filter(Boolean).length} columns ${adm ? '<button class="lnk" data-tdel>use built-in</button>' : ''}</p>` : '<p class="muted small">Built-in STO PO Standard request layout (22 columns). Drop the template file to use its exact headers.</p>'}</section>
  </div>
  <div class="grid2">
    <section class="panel"><header><h2>3 · STO reports</h2><small>newest is used · older reports detect closed lines</small></header>${tbl(['Date', 'File', 'Lines', 'STOs', ''], stos.map((s, i) => [fmtDate(s.date) + (i === 0 ? ' <span class="pill">current</span>' : ''), esc(s.file), fmtI(s.count), fmtI(s.stos || 0), del('sdel', s.id)]))}</section>
    <section class="panel"><header><h2>4 · STOCK files</h2><small>newest is used</small></header>${tbl(['Date', 'File', 'Rows', ''], stocks.map((s, i) => [fmtDate(s.date) + (i === 0 ? ' <span class="pill">current</span>' : ''), esc(s.file), fmtI(s.count), del('sdel', s.id)]))}</section>
  </div>`;
  bindDrop(el);
  el.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.fdel) { const f = S.mto.find(x => x.id === t.dataset.fdel); return confirmBox('Remove MTO file', `Remove ${esc(f.file)} (${f.lines.length} lines)?`, 'Remove', () => { S.mto = S.mto.filter(x => x !== f); audit('Remove MTO file', f.file); commit(); }); }
    if (t.dataset.sdel) { const s = S.snapshots.find(x => x.id === t.dataset.sdel); return confirmBox('Remove dataset', `Remove ${esc(s.file)}?`, 'Remove', async () => { S.snapshots = S.snapshots.filter(x => x !== s); delete SNAP[s.id]; await idb.del('snap:' + s.id); Sync.deleteSnap(s.id); audit('Remove dataset', s.file); commit(); }); }
    if (t.hasAttribute('data-podel')) { PO = null; S.poMeta = null; await idb.del('po'); Sync.poUnsent = false; audit('Remove PO file', ''); return commit(); }
    if (t.hasAttribute('data-tdel')) { S.template = null; return commit(); }
    if (t.hasAttribute('data-link')) return linkFolder();
  };
};
async function linkFolder() {
  try {
    let h = await idb.get('dirHandle');
    if (h) { const p = await h.requestPermission({ mode: 'read' }); if (p !== 'granted') h = null; }
    if (!h) { h = await window.showDirectoryPicker({ mode: 'read' }); await idb.set('dirHandle', h); }
    const files = []; const walk = async (dir, depth) => { for await (const [name, fh] of dir.entries()) { if (fh.kind === 'file' && /\.(xlsx|xlsm|xls)$/i.test(name) && !/^~\$/.test(name)) { const f = await fh.getFile(); if (!Object.keys(S.fileSigs).some(k => k.startsWith(f.name + '|' + f.size + '|' + f.lastModified))) files.push(f); } else if (fh.kind === 'directory' && depth < 2) await walk(fh, depth + 1); } };
    await walk(h, 0);
    if (!files.length) return toast('No new Excel files in ' + h.name, 'info');
    toast(`${files.length} new file(s) in ${h.name}`); handleFiles(files);
  } catch (e) { if (e.name !== 'AbortError') toast('Folder access not available here: ' + e.message, 'warn', 6000); }
}

/* ---------------- settings & admin ---------------- */
V.settings = el => {
  const st = S.settings; const adm = isAdmin(); const dis = adm ? '' : 'disabled';
  const statuses = uniq(S.snapshots.filter(s => s.kind === 'sto').flatMap(s => (SNAP[s.id] || []).map(l => l.status))).filter(Boolean).sort();
  el.innerHTML = `${adm ? '' : `<div class="note warn">${icon('lock')} Viewer mode: settings are read-only. <a href="#" data-admin>Unlock admin</a></div>`}
  <div class="grid2">
  <section class="panel"><header><h2>Appearance</h2></header><div class="form2">
    <label class="fld span2"><span>Tracker name</span><input id="sTitle" value="${esc(st.title)}" ${dis}></label>
    <label class="fld span2"><span>Subtitle</span><input id="sSub" value="${esc(st.subtitle)}" ${dis}></label>
    <label class="fld span2"><span>Export file name prefix</span><input id="sPre" value="${esc(st.exportPrefix)}" ${dis}></label>
    <label class="fld"><span>Theme</span><select id="sTheme" ${dis}>${['system', 'light', 'dark'].map(t => `<option ${st.theme === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="fld"><span>Row density</span><select id="sDen" ${dis}>${['comfortable', 'compact'].map(t => `<option ${st.density === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="fld"><span>Brand colour</span><input type="color" id="sAcc" value="${esc(st.accent)}" ${dis}></label>
    <div class="fld"><span>Presets</span><div class="row tight">${[['#204393', 'Al Tasnim blue'], ['#F48323', 'Al Tasnim orange'], ['#495053', 'Graphite'], ['#0f766e', 'Teal']].map(([c, n]) => `<button class="swatch" style="background:${c}" data-acc="${c}" title="${n}" ${dis}></button>`).join('')}</div></div>
    <div class="fld span2"><span>Company logo</span><div class="row tight">${st.logo ? `<img class="logo-pv" src="${st.logo}" alt="Logo">` : '<em class="muted">No logo</em>'}
      <label class="btn sm ${adm ? '' : 'disabled'}">${icon('upload')}Upload<input type="file" accept="image/*" id="sLogo" hidden ${dis}></label><button class="btn sm" data-logodef ${dis}>Default</button><button class="btn sm" data-logodel ${dis}>Remove</button><label class="chk"><input type="checkbox" id="sShow" ${st.showLogo ? 'checked' : ''} ${dis}> Show</label></div></div>
  </div>${adm ? '<div class="row"><button class="btn primary" data-saveapp>Save appearance</button></div>' : ''}</section>

  <section class="panel"><header><h2>Team database · Google Drive</h2><small class="dot-l"><i class="dot sc-${Sync.status}"></i>${Sync.on() ? esc(Sync.label()) : 'Not connected'}</small></header>
    <p class="small muted">Saves to the Drive folder through the Apps Script Web App. Everyone with the URL and team key shares one database; changes sync every minute and are merged if two people save at once. These details stay in this browser.</p>
    <div class="form2">
      <label class="fld span2"><span>Web App URL (ends with /exec)</span><input id="cUrl" value="${esc(Sync.cfg().url || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="fld"><span>Team key</span><input id="cKey" type="password" value="${esc(Sync.cfg().key || '')}" autocomplete="off"></label>
      <label class="fld"><span>Your name (activity log)</span><input id="cName" value="${esc(Sync.cfg().name || '')}"></label>
    </div>
    <div class="row"><button class="btn primary" data-cconnect>${icon('cloud')}${Sync.on() ? 'Save & reconnect' : 'Connect'}</button>${Sync.on() ? '<button class="btn" data-csync>Sync now</button><button class="btn" data-cdisc>Disconnect</button>' : ''}</div>
    ${Sync.on() ? `<p class="muted small">Revision ${Sync.rev}${Sync.msg ? ' · ' + esc(Sync.msg) : ''}</p>` : ''}</section>

  <section class="panel"><header><h2>Admin access</h2></header>
    <p class="small">${hasPin() ? 'A PIN is set. Viewers can browse, drill down and export; import, edit, delete and settings need the PIN.' : '<b>No admin PIN.</b> Anyone with the link can edit.'}</p>
    <div class="form2"><label class="fld"><span>${hasPin() ? 'New PIN' : 'Set PIN'}</span><input type="password" id="p1" autocomplete="new-password" ${dis}></label><label class="fld"><span>Repeat</span><input type="password" id="p2" autocomplete="new-password" ${dis}></label>
      <label class="chk span2"><input type="checkbox" id="sVI" ${st.viewerImport ? 'checked' : ''} ${dis}> Viewers may import Excel files</label></div>
    ${adm ? `<div class="row"><button class="btn primary" data-setpin>Save PIN</button>${hasPin() ? '<button class="btn" data-rmpin>Remove PIN</button><button class="btn" data-lock>Lock now</button>' : ''}</div>` : ''}</section>

  <section class="panel"><header><h2>STO status mapping</h2></header>
    <label class="chk"><input type="checkbox" id="lDrop" ${st.dropAsClosed ? 'checked' : ''} ${dis}> STO lines missing from the newest report count as received (closed)</label>
    <table class="mini"><thead><tr><th>SAP "STO Status"</th><th>Tracker stage</th></tr></thead><tbody>${(statuses.length ? statuses : DEFAULT_STATUS_MAP.map(x => x[0])).map(s => `<tr><td>${esc(s)}</td><td><select data-smap="${esc(s)}" ${dis}>${['PENDING_PE', 'ON_HOLD', 'APPROVED', 'AWAIT_DELIVERY', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'].map(k => `<option value="${k}" ${mapStoStatus(s) === k ? 'selected' : ''}>${esc(STAGES[k].label)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
    ${adm ? '<div class="row"><button class="btn primary" data-savelogic>Save</button></div>' : ''}</section>

  <section class="panel"><header><h2>Backup · restore · reset</h2></header>
    <div class="row"><button class="btn" data-backup>${icon('download')}Download backup</button><label class="btn ${adm ? '' : 'disabled'}">${icon('upload')}Restore<input type="file" accept=".json" id="rIn" hidden ${dis}></label>${adm ? `<button class="btn danger" data-reset>${icon('trash')}${Sync.on() ? 'Clear local copy' : 'Reset database'}</button>` : ''}</div>
    <h3 class="sub">Activity</h3><div class="audit">${S.audit.slice(0, 150).map(a => `<div><time>${esc(a.ts.slice(0, 16).replace('T', ' '))}</time><b>${esc(a.action)}</b><em>${esc(a.who)}</em><span>${esc(a.detail)}</span></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div></section>

  <section class="panel"><header><h2>How the files are read</h2><small>v${VERSION}</small></header><ol class="small how">
    <li><b>MTO</b> header → WBS.NO. (or the WBS in the revision block), well ID = last 3-5 digits, account from the 3rd WBS segment (NIM Greater NIMR · SEF SSFD · other). Discipline from the job title: flow line → Mechanical Flowline, hook-up → Mechanical Hook-up, electrical, instrument (C&amp;A), civil.</li>
    <li>Struck-out lines and lines without a numeric SAP material code are excluded (see Excluded lines).</li>
    <li><b>STOCK</b>: duplicate rows that differ only in Available Qty keep the highest. Per material: rows on the same account WBS first, then the highest Available Qty → SAP QTY, Plant, Sloc, Batch, Val.Type, Procurement WBS.</li>
    <li><b>PO</b>: Service PO = the CLA FLH line whose description carries the well ID.</li>
    <li><b>STO</b>: matched on material number + well ID from the Target WBS; latest STO shown, quantities summed, all lines one click away. Received = VPS Mat Doc posted.</li></ol></section>
  </div>`;
  el.querySelector('[data-backup]').onclick = backup;
  el.querySelector('[data-cconnect]').onclick = async () => {
    const url = $('#cUrl').value.trim(), key = $('#cKey').value.trim(), name = $('#cName').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return toast('Paste the Apps Script Web App URL (https://script.google.com/…/exec)', 'warn', 6000);
    if (!key) return toast('Enter the team key', 'warn');
    Sync.saveCfg({ url, key, name, enabled: true }); const done = showBusy('Connecting to the team database…');
    try { const info = await Sync.connect(); done(); audit('Connected to team database', info.folder || ''); persist(true); toast('Connected · revision ' + Sync.rev, 'ok', 5000); if (!Sync.started) Sync.start(); render(); }
    catch (e) { done(); Sync.setStatus('error', e.message); toast('Connection failed: ' + e.message, 'bad', 8000); }
  };
  const cs = el.querySelector('[data-csync]'); if (cs) cs.onclick = async () => { await Sync.pull({ verbose: true }); if (Sync.dirty) await Sync.push(); render(); toast('Synced', 'ok'); };
  const cd = el.querySelector('[data-cdisc]'); if (cd) cd.onclick = () => confirmBox('Disconnect', 'Stop syncing this browser? Data stays here and on Drive.', 'Disconnect', () => { const c = Sync.cfg(); c.enabled = false; Sync.saveCfg(c); Sync.setStatus('off'); render(); }, false);
  if (!adm) return;
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { $('#sAcc').value = b.dataset.acc; });
  $('#sLogo').onchange = () => { const f = $('#sLogo').files[0]; if (!f) return; if (f.size > 1.5e6) return toast('Logo too large (max 1.5 MB)', 'warn'); const r = new FileReader(); r.onload = () => { st.logo = r.result; st.showLogo = true; audit('Logo uploaded', f.name); persist(); render(); }; r.readAsDataURL(f); };
  el.querySelector('[data-logodef]').onclick = () => { st.logo = DEFAULT_LOGO; st.showLogo = true; persist(); render(); };
  el.querySelector('[data-logodel]').onclick = () => { st.logo = ''; persist(); render(); };
  el.querySelector('[data-saveapp]').onclick = () => { Object.assign(st, { title: $('#sTitle').value.trim() || DEFAULT_TITLE, subtitle: $('#sSub').value.trim(), exportPrefix: $('#sPre').value.trim() || 'Tracker', theme: $('#sTheme').value, density: $('#sDen').value, accent: $('#sAcc').value, showLogo: $('#sShow').checked }); audit('Appearance saved', st.title); persist(); render(); toast('Saved', 'ok'); };
  el.querySelector('[data-setpin]').onclick = () => { const a = $('#p1').value, b = $('#p2').value; if (a.length < 4) return toast('Use at least 4 characters', 'warn'); if (a !== b) return toast('PINs do not match', 'warn'); st.adminHash = sha256('atnm|' + a); st.viewerImport = $('#sVI').checked; ADMIN = true; try { sessionStorage.setItem('atnm_admin', st.adminHash); } catch (e) { } audit('Admin PIN set', ''); persist(); render(); toast('PIN saved', 'ok'); };
  const rm = el.querySelector('[data-rmpin]'); if (rm) rm.onclick = () => confirmBox('Remove PIN', 'Everyone will be able to edit. Continue?', 'Remove PIN', () => { st.adminHash = ''; audit('Admin PIN removed', ''); persist(); render(); });
  const lk = el.querySelector('[data-lock]'); if (lk) lk.onclick = () => { ADMIN = false; try { sessionStorage.removeItem('atnm_admin'); } catch (e) { } render(); };
  el.querySelector('[data-savelogic]').onclick = () => { st.dropAsClosed = $('#lDrop').checked; const map = st.statusMap.filter(([k]) => !$$('[data-smap]', el).some(s => norm(s.dataset.smap) === norm(k))); $$('[data-smap]', el).forEach(s => map.unshift([norm(s.dataset.smap), s.value])); st.statusMap = map; audit('Status mapping saved', ''); commit(); toast('Saved and recalculated', 'ok'); };
  el.querySelector('[data-reset]').onclick = () => confirmBox(Sync.on() ? 'Clear local copy' : 'Reset database', Sync.on() ? 'Clear this browser\'s copy and download a fresh one from the team database? Drive is not changed.' : 'Delete ALL data stored in this browser? Download a backup first. This cannot be undone.', Sync.on() ? 'Clear and reload' : 'Reset everything', async () => { const cloud = Sync.on(); await idb.clear(); const ui = S.ui; S = blankState(); S.ui = ui; SNAP = {}; PO = null; ADMIN = false; Object.assign(Sync, { rev: -1, base: null, dirty: false, poUnsent: false }); Sync.unsentSnaps.clear(); await Sync.saveMeta(); rebuild(); persist(true); if (cloud) await Sync.pull({ verbose: true }); render(); toast(cloud ? 'Reloaded from the team database' : 'Database reset'); });
  $('#rIn').onchange = e => { const f = e.target.files[0]; if (f) restoreBackup(f); };
};
function backup() {
  const data = { app: 'atnm-mto-sto-tracker', version: VERSION, exported: new Date().toISOString(), state: S, snaps: SNAP, po: PO };
  download(`${S.settings.exportPrefix} - Tracker Backup - ${todayISO()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  audit('Backup downloaded', ''); persist(true); toast('Backup downloaded', 'ok');
}
async function restoreBackup(file) {
  if (!needAdmin(() => restoreBackup(file))) return;
  try {
    const d = JSON.parse(await file.text()); if (d.app !== 'atnm-mto-sto-tracker' || !d.state) throw new Error('not a tracker backup');
    confirmBox('Restore backup', `${Sync.on() ? 'This also replaces the TEAM database on Drive. ' : ''}Replace the current data with the backup from ${esc((d.exported || '').slice(0, 10))}?`, 'Restore', async () => {
      await idb.clear(); const ui = S.ui; S = migrateState(d.state); S.ui = ui; SNAP = d.snaps || {}; PO = normalizePO(d.po);
      for (const k in SNAP) { await idb.set('snap:' + k, SNAP[k]); Sync.queueSnap(k); } if (PO) { await idb.set('po', PO); Sync.queuePo(); }
      audit('Backup restored', file.name); rebuild(); persist(); render(); toast('Backup restored', 'ok');
    }, false);
  } catch (e) { toast('Restore failed: ' + e.message, 'bad', 6000); }
}

/* ---------------- init ---------------- */
async function init() {
  STORAGE_OK = await idb.open();
  if (STORAGE_OK) {
    const s = await idb.get('state'); if (s) S = migrateState(s);
    for (const sp of S.snapshots) SNAP[sp.id] = (await idb.get('snap:' + sp.id)) || [];
    PO = normalizePO((await idb.get('po')) || null);
  } else toast('Browser storage is blocked: data will not be kept after closing. Use backups.', 'warn', 9000);
  try { const u = JSON.parse(localStorage.getItem('atnm_ui') || 'null'); if (u) S.ui = Object.assign(blankState().ui, u); } catch (e) { }
  if (!VIEWS.some(v => v[0] === S.ui.view)) S.ui.view = 'dashboard';
  await Sync.loadMeta();
  try { if (S.settings.adminHash && sessionStorage.getItem('atnm_admin') === S.settings.adminHash) ADMIN = true; } catch (e) { }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'system') render(); });
  rebuild(); render();
  if (Sync.on()) Sync.start();
  window.ATNM = { get state() { return S; }, get data() { return D; }, handleFiles, commitImport, analyzeWorkbook, rebuild, render, Sync, mergeStates, openExport, exportTemplate, EXP };
}
init();
