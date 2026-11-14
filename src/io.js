/* =====================================================================
   io.js : import pipeline, Excel exports, data sources, settings, init
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
const isXl = f => /\.(xlsx|xlsm|xls)$/i.test(f.name) && !/^~\$/.test(f.name);
async function handleFiles(files) {
  const json = files.find(f => /\.json$/i.test(f.name)); if (json && files.length === 1) return restoreBackup(json);
  files = files.filter(isXl);
  if (!files.length) return toast('No Excel files found (.xlsx / .xls)', 'warn');
  const busy = showBusy(`Reading ${files.length} file(s)...`);
  const items = [];
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer();
      const wb = XL.read(buf, { type: 'array', cellDates: false, dense: false });
      const fi = { name: f.name, sig: f.name + '|' + f.size + '|' + f.lastModified };
      const found = analyzeWorkbook(wb, fi);
      if (!found.length) items.push({ kind: 'unknown', file: f.name, sig: fi.sig });
      for (const it of found) { it.known = S.fileSigs[it.sig + '|' + it.kind + '|' + (it.sheet || '')]; items.push(it); }
    } catch (e) { console.error(e); items.push({ kind: 'error', file: f.name, error: String(e.message || e) }); }
    await new Promise(r => setTimeout(r, 0));
  }
  busy();
  importPreview(items);
}
function showBusy(msg) { const b = document.createElement('div'); b.className = 'busy'; b.innerHTML = `<div><span class="spin"></span>${esc(msg)}</div>`; document.body.appendChild(b); return () => b.remove(); }
const KIND = { req: 'MTO / STO PO request', sap: 'SAP STO report', design: 'Engineering MTO', po: 'P.O with work orders', unknown: 'Not recognised', error: 'Read error' };
function importPreview(items) {
  const row = (it, i) => {
    const ok = ['req', 'sap', 'design', 'po'].includes(it.kind);
    let info = '';
    if (it.kind === 'req') info = `${it.lines.length} lines · well(s) ${esc(it.wells.join(', '))} · disciplines ${esc(uniq(it.lines.map(l => l.dept || '?')).join(', '))}`;
    if (it.kind === 'sap') info = `${fmtI(it.lines.length)} STO lines · ${uniq(it.lines.map(l => l.sto)).length} STOs · ${it.wells.length} wells · statuses: ${esc(uniq(it.lines.map(l => l.status)).join(', '))}`;
    if (it.kind === 'design') info = `${it.lines.length} lines · WBS ${esc(it.meta.wbs)} · well ${esc(it.wellId)}`;
    if (it.kind === 'po') info = `${fmtI(it.count)} PO lines (sheet ${esc(it.sheet)})`;
    if (it.kind === 'unknown') info = 'No MTO / SAP / design / PO header found - skipped.';
    if (it.kind === 'error') info = esc(it.error);
    const dateFld = (it.kind === 'req' || it.kind === 'sap') ? `<label class="fld inline"><span>${it.kind === 'req' ? 'MTO date' : 'Report date'}</span><input type="date" data-idate="${i}" value="${it.date}"><small class="muted">from ${esc(it.dateSrc)}</small></label>` : '';
    return `<tr class="${ok ? '' : 'muted'}"><td><input type="checkbox" data-iinc="${i}" ${ok && !(it.known && it.kind !== 'sap') ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="Include"></td>
      <td><span class="badge k-${it.kind}">${KIND[it.kind]}</span></td><td class="wrap"><b>${esc(it.file)}</b>${it.sheet && it.kind !== 'req' ? ` <small>[${esc(it.sheet)}]</small>` : ''}<br><small>${info}</small>${it.known ? `<br><small class="t-warn">Imported before on ${fmtDate(it.known.slice(0, 10))} - will replace.</small>` : ''}</td><td>${dateFld}</td></tr>`;
  };
  openModal({
    title: 'Import preview', wide: true,
    body: `<p class="muted small">File types are detected from the column headers. Check the dates: the MTO date drives matching with SAP STO lines; the report date decides which lines are "current".</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Type</th><th>File</th><th>Date</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Import selected', primary: true, onClick: m => { $$('[data-idate]', m).forEach(x => { items[+x.dataset.idate].date = x.value || todayISO(); }); const sel = items.filter((it, i) => { const c = m.querySelector(`[data-iinc="${i}"]`); return c && c.checked; }); commitImport(sel); } }]
  });
}
async function commitImport(items) {
  if (!items.length) return;
  const now = new Date().toISOString(); const msgs = [];
  for (const it of items) {
    if (it.kind === 'req') {
      const id = 'B-' + norm(it.file).replace(/ /g, '_').slice(0, 60) + '-' + it.date;
      S.batches = S.batches.filter(b => b.id !== id);
      S.batches.push({ id, file: it.file, date: it.date, imported: now, modified: Date.now(), header: it.header, sheets: it.sheets, lines: it.lines.map((l, i) => Object.assign({}, l, { id: id + '#' + i, idx: i })) });
      msgs.push(`MTO ${fmtDate(it.date)}: ${it.lines.length} lines`);
    } else if (it.kind === 'sap') {
      const id = 'S-' + it.date + '-' + norm(it.file).replace(/ /g, '_').slice(0, 50);
      S.snapshots = S.snapshots.filter(s => s.id !== id);
      S.snapshots.push({ id, file: it.file, date: it.date, imported: now, modified: Date.now(), count: it.lines.length, stos: uniq(it.lines.map(l => l.sto)).length });
      SNAP[id] = it.lines; await idb.set('snap:' + id, it.lines); Sync.queueSnap(id);
      msgs.push(`SAP report ${fmtDate(it.date)}: ${fmtI(it.lines.length)} lines`);
    } else if (it.kind === 'design') {
      const id = 'E-' + norm(it.file).replace(/ /g, '_').slice(0, 60) + '-' + norm(it.sheet).replace(/ /g, '_');
      S.design = S.design.filter(d => d.id !== id);
      S.design.push({ id, file: it.file, sheet: it.sheet, imported: now, modified: Date.now(), meta: it.meta, wellId: it.wellId, lines: it.lines });
      msgs.push(`Engineering MTO ${it.wellId}: ${it.lines.length} lines`);
    } else if (it.kind === 'po') {
      if (!PO || PO.file !== it.file) PO = { file: it.file, imported: now, map: {} };
      Object.assign(PO.map, it.map); await idb.set('po', PO);
      S.poMeta = { file: it.file, imported: now, count: Object.keys(PO.map).length }; PO.imported = now; await idb.set('po', PO); Sync.queuePo();
      msgs.push(`PO lookup: ${fmtI(it.count)} lines`);
    }
    S.fileSigs[it.sig + '|' + it.kind + '|' + (it.sheet || '')] = now;
  }
  audit('Import', msgs.join('; '));
  rebuild(); persist(); render();
  toast('Imported: ' + msgs.join(' · '), 'ok', 6000);
}

/* ---------------- Excel helpers ---------------- */
const BRD = { style: 'thin', color: { rgb: 'B7BFCB' } };
const BORDER = { top: BRD, bottom: BRD, left: BRD, right: BRD };
const XS = {
  hdr: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: '204393' } }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: BORDER },
  cell: { font: { sz: 10, name: 'Calibri' }, border: BORDER, alignment: { vertical: 'top', wrapText: false } }
};
const FILLS = { warn: 'FFF2CC', bad: 'FCE4E4', ok: 'E2F0D9', info: 'DDEBF7', grey: 'EDEDED', sec: 'D9E1F2' };
const sheetName = s => String(s).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Sheet';
function styledSheet(aoa, { widths, hdrRow = 0, rowFill, numCols } = {}) {
  const ws = XL.utils.aoa_to_sheet(aoa); const R = XL.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = R.s.r; r <= R.e.r; r++) for (let c = R.s.c; c <= R.e.c; c++) {
    const a = XL.utils.encode_cell({ r, c }); if (!ws[a]) ws[a] = { t: 's', v: '' };
    if (r === hdrRow) ws[a].s = XS.hdr;
    else if (r > hdrRow) { const f = rowFill && rowFill(r - hdrRow - 1); ws[a].s = Object.assign({}, XS.cell, f ? { fill: { patternType: 'solid', fgColor: { rgb: f } } } : {}); if (numCols && numCols[c] && ws[a].t === 'n') ws[a].z = '#,##0.###'; }
  }
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  if (aoa.length > hdrRow + 1) ws['!autofilter'] = { ref: XL.utils.encode_range({ s: { r: hdrRow, c: 0 }, e: { r: R.e.r, c: R.e.c } }) };
  return ws;
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function saveWB(wb, name) {
  try { const out = XL.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true }); download(name.replace(/[\\\/:*?"<>|]+/g, ' '), new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); audit('Export', name); persist(); toast('Exported ' + name, 'ok'); }
  catch (e) { console.error(e); toast('Export failed: ' + e.message, 'bad', 6000); }
}
const colsToAoa = (cols, rows) => [cols.map(c => c.label)].concat(rows.map(r => cols.map(c => { const v = c.xval ? c.xval(r) : c.val(r); return v == null ? '' : v; })));
const xNum = v => (typeof v === 'string' && /^\d{1,15}$/.test(v)) ? Number(v) : v;
const flagFill = fl => fl && fl.some(f => f.sev >= 3) ? FILLS.bad : (fl && fl.some(f => f.sev === 2) ? FILLS.warn : null);

/* normalised export rows */
function recToX(r) {
  return { wellId: r.wellId, material: r.material, desc: r.desc, uom: r.uom, qtyOrig: r.reqQty, qtyOpen: r.open, qtyPending: r.pendingQty, qtyNR: r.notRaised, sapQty: r.sapQty, plant: r.plant, sloc: r.sloc, slocDesc: r.slocDesc, batch: r.batch, valType: r.valType, constWBS: r.constWBS, wellType: r.wellType, procWBS: r.procWBS, docHeader: r.docHeader, ramzId: r.ramzId, servicePO: r.servicePO, stoPO: r.stoNos.join(', ') || r.stoPO, postingStatus: STAGES[r.stage].label, flags: r.flags, dept: r.dept, issued: r.issued, approved: r.approved, pendingPE: r.pendingPE, notRaised: r.notRaised, mesc: (D.AGmap.get(r.wellId + '|' + r.material) || {}).mesc || '', remarks: [r.reason && r.group !== 'issued' ? r.reason : '', r.remarks].filter(Boolean).join(' - ') };
}
function agToX(a) {
  const r = a.recLines[a.recLines.length - 1]; const l = a.stoLines[a.stoLines.length - 1] || {};
  const w = D.W.get(a.wellId) || { pos: new Set(), ramz: new Set(), types: new Set(), wbs: new Set() };
  return { wellId: a.wellId, material: a.material, desc: a.desc, uom: a.uom, qtyOrig: a.required, qtyOpen: a.balance, qtyPending: Math.max(0, a.balance - a.approved), qtyNR: a.notRaised, sapQty: r ? r.sapQty : null,
    plant: r ? r.plant : l.srcPlant, sloc: r ? r.sloc : l.srcSloc, slocDesc: r ? r.slocDesc : l.srcSlocDesc, batch: r ? r.batch : l.batchNo, valType: r ? r.valType : l.batchNo,
    constWBS: r ? r.constWBS : (l.tgtWBS || [...w.wbs][0] || ''), wellType: r ? r.wellType : [...w.types][0] || '', procWBS: r ? r.procWBS : l.srcWBS, docHeader: r ? r.docHeader : (a.wellName || ''),
    ramzId: r ? r.ramzId : (l.ramz || ''), servicePO: r ? r.servicePO : (l.po ? l.po + '-' + l.poItem : ''), stoPO: [...a.openStos].join(', '), postingStatus: a.status, flags: a.flags, dept: a.dept,
    issued: a.issuedEff, approved: a.approved, pendingPE: a.pendingPE, notRaised: a.notRaised, mesc: a.mesc, remarks: a.status };
}
function stoToX(l) {
  return { wellId: l.wellId, material: l.material, desc: l.desc, uom: l.uom, qtyOrig: l.qty, qtyOpen: l.group === 'issued' || l.group === 'cancelled' ? 0 : l.qty, qtyPending: l.group === 'pending' ? l.qty : 0, qtyNR: 0, sapQty: null,
    plant: l.srcPlant, sloc: l.srcSloc, slocDesc: l.srcSlocDesc, batch: l.batchNo, valType: l.batchNo, constWBS: l.tgtWBS, wellType: '', procWBS: l.srcWBS, docHeader: l.tgtWBSDesc.replace(/^\s*\d+\s*-\s*/, ''),
    ramzId: l.ramz, servicePO: l.po + (l.poItem ? '-' + l.poItem : ''), stoPO: l.sto, postingStatus: l.status, flags: l.flags, dept: l.dept, issued: l.group === 'issued' ? l.qty : 0, approved: l.group === 'approved' ? l.qty : 0, pendingPE: l.group === 'pending' ? l.qty : 0, notRaised: 0, mesc: '', remarks: STAGES[l.stage].label };
}
const toX = (rows, kind) => rows.map(kind === 'rec' ? recToX : kind === 'ag' ? agToX : kind === 'sto' ? stoToX : (x => x));

/* ---------------- export: MTO request format ---------------- */
function openMtoExport({ rows, kind, title }) {
  if (!rows || !rows.length) return toast('Nothing to export in this selection', 'warn');
  const X = toX(rows, kind);
  openModal({
    title: 'Export to MTO request format', wide: false,
    body: `<p class="muted small">${esc(title)} - ${fmtI(rows.length)} row(s), ${uniq(X.map(x => x.wellId)).length} well(s). Same columns as the STO PO REQUEST file, ready to send back to the project engineer.</p>
    <div class="form2">
      <label class="fld span2"><span>Quantity in "Request Qty"</span><select id="xq"><option value="open">Open qty (requested - issued)</option><option value="pending">Pending qty (not yet approved or issued)</option><option value="nr">Not raised in SAP only</option><option value="orig">Original requested qty</option></select></label>
      <label class="chk"><input type="checkbox" id="xz" checked> Skip rows with zero quantity</label>
      <label class="chk"><input type="checkbox" id="xs" checked> One sheet per well</label>
      <label class="chk"><input type="checkbox" id="xsto" checked> Fill "STO PO NO" with matched STOs</label>
      <label class="chk"><input type="checkbox" id="xps" checked> Fill "POSTING STATUS" with tracker status</label>
      <label class="chk"><input type="checkbox" id="xc1" checked> Write flags in "Column1" (e.g. ALREADY REQUESTED)</label>
      <label class="chk"><input type="checkbox" id="xex"> Add tracker columns at the end</label>
      <label class="chk"><input type="checkbox" id="xhl" checked> Highlight flagged rows</label>
    </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Export .xlsx', primary: true, onClick: () => { exportMTO(X, { q: $('#xq').value, skipZero: $('#xz').checked, perWell: $('#xs').checked, sto: $('#xsto').checked, ps: $('#xps').checked, c1: $('#xc1').checked, extra: $('#xex').checked, hl: $('#xhl').checked, title }); } }]
  });
}
function exportMTO(X, o) {
  const qOf = x => o.q === 'open' ? x.qtyOpen : o.q === 'pending' ? x.qtyPending : o.q === 'nr' ? x.qtyNR : x.qtyOrig;
  let rows = X.map(x => Object.assign({}, x, { q: r3(qOf(x)) })); if (o.skipZero) rows = rows.filter(x => x.q > EPS);
  if (!rows.length) return toast('All quantities are zero for this choice', 'warn');
  const hb = D.batchesSorted.slice().reverse().find(b => b.header && b.header.filter(Boolean).length >= 10);
  const header = hb ? hb.header.map(h => h || '') : REQ_HEADER_DEFAULT.slice();
  while (header.length && !header[header.length - 1]) header.pop();
  const cm = colMap(header, REQ_ALIASES); const keyAt = {}; for (const k in cm) keyAt[cm[k]] = k;
  const extraH = o.extra ? ['Original Qty', 'Issued Qty', 'Approved Qty', 'Pending PE Qty', 'Not Raised Qty', 'Tracker Status', 'Flags (detail)'] : [];
  const flagShort = fl => uniq((fl || []).filter(f => f.sev >= 1).map(f => f.code === 'ALREADY_REQ' ? 'ALREADY REQUESTED - earlier STO open' : FLAGS[f.code].label.toUpperCase())).join('; ');
  const val = (x, k, i) => {
    switch (k) {
      case 'sr': return i + 1; case 'material': return xNum(x.material); case 'desc': return x.desc; case 'uom': return x.uom; case 'reqQty': return x.q;
      case 'sapQty': return x.sapQty == null ? '' : x.sapQty; case 'wellId': return xNum(x.wellId); case 'dept': return x.dept;
      case 'stoPO': return o.sto ? x.stoPO : ''; case 'postingStatus': return o.ps ? x.postingStatus : ''; case 'col1': return o.c1 ? flagShort(x.flags) : '';
      default: return x[k] == null ? '' : x[k];
    }
  };
  const groups = o.perWell ? [...groupBy(rows, x => x.wellId)] : [['All', rows]];
  const wb = XL.utils.book_new();
  for (const [w, rs] of groups) {
    rs.sort((a, b) => a.dept.localeCompare(b.dept) || a.material.localeCompare(b.material));
    const aoa = [header.concat(extraH)].concat(rs.map((x, i) => header.map((h, c) => keyAt[c] ? val(x, keyAt[c], i) : '').concat(o.extra ? [x.qtyOrig, x.issued, x.approved, x.pendingPE, x.notRaised, x.postingStatus, (x.flags || []).map(f => f.text).join(' | ')] : [])));
    const widths = header.map((h, c) => ({ desc: 42, docHeader: 30, constWBS: 26, procWBS: 26, col1: 34, postingStatus: 26, stoPO: 22 }[keyAt[c]] || Math.max(8, Math.min(16, String(h).length + 2)))).concat(extraH.map((h, i) => i === 6 ? 60 : 14));
    const ws = styledSheet(aoa, { widths, rowFill: i => o.hl ? flagFill(rs[i].flags) : null, numCols: header.map((h, c) => keyAt[c] === 'reqQty' || keyAt[c] === 'sapQty').concat(extraH.map((h, i) => i < 5)) });
    XL.utils.book_append_sheet(wb, ws, sheetName(o.perWell ? String(w) : 'MTO'));
  }
  const wl = uniq(rows.map(x => x.wellId)); const qn = { open: 'Open', pending: 'Pending', nr: 'Not Raised', orig: 'Requested' }[o.q];
  saveWB(wb, `${S.settings.exportPrefix} - MTO ${qn} - ${wl.length === 1 ? 'Well ' + wl[0] : wl.length + ' wells'} - ${todayISO()}.xlsx`);
}

/* ---------------- export: engineering MTO (ABJ layout) ---------------- */
function openEngExport(X) {
  X = X.filter(x => x.qtyOpen > EPS || x.qtyOrig > EPS);
  if (!X.length) return toast('Nothing to export', 'warn');
  const wells = uniq(X.map(x => x.wellId)); const w = D.W.get(wells[0]) || { wbs: new Set(), names: new Set(), ramz: new Set() }; const dm = (w.design && w.design.meta) || {};
  const one = wells.length === 1;
  openModal({
    title: 'Export engineering MTO format', body: `<p class="muted small">${fmtI(X.length)} line(s), ${wells.length} well(s). Layout follows the M.T.O. SUMMARY sheet (job block, SR / DESCRIPTION / QTY / UNIT / M.E.S.C. / SAP NO. / REMARKS, revision block), grouped by discipline.${one ? '' : ' Header values are filled per well from its data.'}</p>
    <div class="form2">
      <label class="fld span2"><span>Quantity</span><select id="eq"><option value="open">Open qty (requested - issued)</option><option value="nr">Not raised in SAP only</option><option value="orig">Required qty</option></select></label>
      ${one ? `<label class="fld"><span>Job no.</span><input id="ej" value="${esc(dm.jobNo || '')}"></label>
      <label class="fld"><span>Project ID</span><input id="ep" value="${esc(dm.projectId || [...w.ramz][0] || '')}"></label>
      <label class="fld"><span>WBS no.</span><input id="ew" value="${esc(dm.wbs || [...w.wbs][0] || '')}"></label>
      <label class="fld"><span>Doc. no.</span><input id="ed" value="${esc(dm.docNo || '')}"></label>
      <label class="fld span2"><span>Job title</span><input id="et" value="${esc(dm.jobTitle || ('PENDING MATERIALS - WELL ' + wells[0] + (w.name ? ' - ' + w.name : '')))}"></label>
      <label class="fld"><span>Area</span><input id="ea" value="${esc(dm.area || w.loc || 'NIMR')}"></label>` : ''}
      <label class="fld"><span>Prepared by</span><input id="eb" value=""></label>
    </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Export .xlsx', primary: true, onClick: () => { const meta = one ? { jobNo: $('#ej').value, projectId: $('#ep').value, wbs: $('#ew').value, docNo: $('#ed').value, jobTitle: $('#et').value, area: $('#ea').value } : null; exportEng(X, $('#eq').value, meta, $('#eb').value); } }]
  });
}
function exportEng(X, qm, meta1, prepared) {
  const wb = XL.utils.book_new(); const NC = 23; let made = 0;
  for (const [wid, rs0] of groupBy(X, x => x.wellId)) {
    const rs = rs0.map(x => Object.assign({}, x, { q: r3(qm === 'open' ? x.qtyOpen : qm === 'nr' ? x.qtyNR : x.qtyOrig) })).filter(x => x.q > EPS);
    if (!rs.length) continue; made++;
    const w = D.W.get(wid) || { wbs: new Set(), ramz: new Set(), names: new Set() }; const dm = (w.design && w.design.meta) || {};
    const m = meta1 || { jobNo: dm.jobNo || '', projectId: dm.projectId || [...w.ramz][0] || '', wbs: dm.wbs || [...w.wbs][0] || '', docNo: dm.docNo || '', jobTitle: dm.jobTitle || ('PENDING MATERIALS - WELL ' + wid + (w.name ? ' - ' + w.name : '')), area: dm.area || w.loc || 'NIMR' };
    const aoa = []; const merges = []; const styles = {}; const blank = () => new Array(NC).fill('');
    const put = (r, c, v, s) => { while (aoa.length <= r) aoa.push(blank()); aoa[r][c] = v; if (s) styles[r + ',' + c] = s; };
    const mg = (r1, c1, r2, c2) => merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
    const B = { font: { bold: true, sz: 10, name: 'Calibri' } };
    [['JOB NO.:', m.jobNo], ['PROJECT ID:', m.projectId], ['WBS.NO. :', m.wbs], ['DOC. NO.:', m.docNo]].forEach(([l, v], i) => { put(i, 0, l, B); put(i, 1, v); mg(i, 1, i, 5); });
    put(0, 6, 'M.T.O. SUMMARY', { font: { bold: true, sz: 18, name: 'Calibri', color: { rgb: '204393' } }, alignment: { horizontal: 'center', vertical: 'center' } }); mg(0, 6, 3, 16);
    put(0, 17, S.settings.title, { font: { sz: 9, name: 'Calibri', color: { rgb: '595959' } }, alignment: { wrapText: true, vertical: 'top' } }); mg(0, 17, 3, 22);
    put(4, 0, 'JOB TITLE:', B); put(4, 1, m.jobTitle, B); mg(4, 1, 4, 13); put(4, 14, 'Area : ' + m.area, B); mg(4, 14, 4, 22);
    put(5, 0, `Outstanding materials as per SAP STO report ${D.latest ? fmtDate(D.latest.date) : ''} - quantity: ${qm === 'open' ? 'open (requested - issued)' : qm === 'nr' ? 'not raised in SAP' : 'required'}`, { font: { italic: true, sz: 9, name: 'Calibri' } }); mg(5, 0, 5, 22);
    const H = 6; const HS = { font: { bold: true, sz: 10, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: 'D9E1F2' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BORDER };
    [[0, 0, 'SR. No.'], [1, 9, 'DESCRIPTION'], [10, 10, 'QTY.'], [11, 11, 'UNIT'], [12, 13, 'M.E.S.C.'], [14, 15, 'SAP NO.'], [16, 22, 'REMARKS']].forEach(([a, b, t]) => { for (let c = a; c <= b; c++) put(H, c, c === a ? t : '', HS); if (b > a) mg(H, a, H, b); });
    let r = H + 1; let sr = 1; const CS = { font: { sz: 10, name: 'Calibri' }, border: BORDER, alignment: { vertical: 'top', wrapText: true } };
    for (const [dept, ls] of [...groupBy(rs, x => x.dept)].sort((a, b) => a[0].localeCompare(b[0]))) {
      for (let c = 0; c < NC; c++) put(r, c, c === 0 ? dept.toUpperCase() + ' MATERIALS' : '', { font: { bold: true, sz: 10, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } }, border: BORDER }); mg(r, 0, r, 22); r++;
      for (const x of ls) {
        const rem = [x.stoPO ? 'STO ' + x.stoPO : '', x.postingStatus, (x.flags || []).some(f => f.code === 'ALREADY_REQ') ? 'ALREADY REQUESTED' : '', (x.flags || []).some(f => ['SAP_DOUBLE', 'SAME_DAY', 'DUP_OPEN', 'OVER_RAISED'].includes(f.code)) ? 'CHECK DOUBLE ENTRY' : ''].filter(Boolean).join(' · ');
        const fill = flagFill(x.flags); const cs = fill ? Object.assign({}, CS, { fill: { patternType: 'solid', fgColor: { rgb: fill } } }) : CS;
        for (let c = 0; c < NC; c++) put(r, c, '', cs);
        put(r, 0, sr++, Object.assign({}, cs, { alignment: { horizontal: 'center', vertical: 'top' } })); put(r, 1, x.desc, cs); mg(r, 1, r, 9);
        put(r, 10, x.q, Object.assign({}, cs, { alignment: { horizontal: 'right', vertical: 'top' } })); put(r, 11, x.uom === 'M' ? 'MTR' : x.uom, Object.assign({}, cs, { alignment: { horizontal: 'center', vertical: 'top' } }));
        put(r, 12, x.mesc || '', cs); mg(r, 12, r, 13); put(r, 14, xNum(x.material), cs); mg(r, 14, r, 15); put(r, 16, rem, cs); mg(r, 16, r, 22); r++;
      }
    }
    r++; put(r, 0, 'NOTE:      1) UTILIZE SURPLUS MATERIALS      2) Items marked ALREADY REQUESTED are open in an earlier STO - do not raise again.', { font: { bold: true, sz: 9, name: 'Calibri' } }); mg(r, 0, r, 22); r += 2;
    put(r, 0, 'PROJECT DRAWING REVISION', B); mg(r, 0, r, 22); r++;
    const RV = [[0, 0, 'REV'], [1, 1, 'DATE'], [2, 3, 'PREPARED BY'], [4, 5, 'CHECKED BY'], [6, 7, 'APPROVED BY'], [8, 14, 'DESCRIPTION'], [15, 16, 'REF. IND.'], [17, 22, 'SIGNATURE']];
    RV.forEach(([a, b, t]) => { for (let c = a; c <= b; c++) put(r, c, c === a ? t : '', HS); if (b > a) mg(r, a, r, b); }); r++;
    const rv = ['01', fmtDate(todayISO()), prepared || '', '', '', 'PENDING MATERIAL RE-REQUEST', '', '']; RV.forEach(([a, b], i) => { for (let c = a; c <= b; c++) put(r, c, c === a ? rv[i] : '', CS); if (b > a) mg(r, a, r, b); });
    const ws = XL.utils.aoa_to_sheet(aoa);
    for (const k in styles) { const [rr, cc] = k.split(',').map(Number); const a = XL.utils.encode_cell({ r: rr, c: cc }); if (!ws[a]) ws[a] = { t: 's', v: '' }; ws[a].s = styles[k]; }
    ws['!merges'] = merges; ws['!cols'] = [6].concat(new Array(9).fill(6.5), [9, 7, 7, 7, 8, 8], new Array(7).fill(4.5)).map(w => ({ wch: w }));
    XL.utils.book_append_sheet(wb, ws, sheetName('MTO ' + wid));
  }
  if (!made) return toast('All quantities are zero for this choice', 'warn');
  saveWB(wb, `${S.settings.exportPrefix} - Engineering MTO - ${made === 1 ? 'Well ' + X[0].wellId : made + ' wells'} - ${todayISO()}.xlsx`);
}

/* ---------------- export: well inventory & full workbook ---------------- */
function exportWellInventory(w) {
  const all = D.AG.filter(a => a.wellId === w.id); const cols = agCols(false); const wb = XL.utils.book_new();
  const sumA = [['Well ID', w.id], ['Name', w.name], ['WBS', [...w.wbs].join(', ')], ['Service PO', [...w.pos].join(', ')], ['Location', w.loc], ['SAP report', D.latest ? fmtDate(D.latest.date) : ''], ['Exported', fmtDate(todayISO())], [], ['Discipline', 'Materials', 'Complete', 'Outstanding', 'Not raised', 'Pending PE', 'Flagged']];
  for (const d of DEPTS) { const r = all.filter(a => a.dept === d); if (r.length) sumA.push([d, r.length, r.filter(a => a.balance <= EPS).length, r.filter(a => a.balance > EPS).length, r.filter(a => a.notRaised > EPS).length, r.filter(a => a.pendingPE > EPS).length, r.filter(a => a.flags.some(f => f.sev >= 2)).length]); }
  const ws0 = styledSheet(sumA, { hdrRow: 8, widths: [16, 40, 12, 12, 12, 12, 12] }); XL.utils.book_append_sheet(wb, ws0, 'Summary');
  const add = (name, rows) => { if (rows.length) XL.utils.book_append_sheet(wb, styledSheet(colsToAoa(cols, rows), { widths: cols.map(c => c.xw || (c.num ? 12 : 16)), numCols: cols.map(c => !!c.num), rowFill: i => flagFill(rows[i].flags) }), sheetName(name)); };
  add('All materials', all); for (const d of DEPTS) add(d, all.filter(a => a.dept === d));
  const sc = stoExportCols(); const sl = D.STO.filter(l => l.wellId === w.id); if (sl.length) XL.utils.book_append_sheet(wb, styledSheet(colsToAoa(sc, sl), { widths: sc.map(c => c.xw || 14) }), 'STO lines');
  saveWB(wb, `${S.settings.exportPrefix} - Well ${w.id} Inventory - ${todayISO()}.xlsx`);
}
const stoExportCols = () => [['sto', 'Request STO'], ['item', 'Item'], ['reqOn', 'Requested on'], ['age', 'Age (days)'], ['wellId', 'Well'], ['tgtWBS', 'Target WBS'], ['tgtWBSDesc', 'Target WBS descr.'], ['dept', 'Discipline'], ['material', 'Material'], ['desc', 'Description'], ['qty', 'Qty'], ['uom', 'UoM'], ['recv', 'Received'], ['status', 'SAP status'], ['stageL', 'Tracker stage'], ['flagsT', 'Flags'], ['reqBy', 'Requested by'], ['poT', 'Service PO'], ['batchNo', 'Batch'], ['remarks', 'Request remarks'], ['note', 'Note']]
  .map(([k, label]) => ({ k, label, val: l => k === 'stageL' ? STAGES[l.stage].label : k === 'flagsT' ? l.flags.map(f => f.text).join(' | ') : k === 'poT' ? l.po + '/' + l.poItem : k === 'material' ? xNum(l.material) : l[k], xw: { desc: 40, tgtWBSDesc: 30, flagsT: 60, remarks: 28, stageL: 24, status: 24 }[k] || 12 }));
function exportFull() {
  const wb = XL.utils.book_new(); const sc = (cols, rows, name, fill) => XL.utils.book_append_sheet(wb, styledSheet(colsToAoa(cols, rows), { widths: cols.map(c => c.xw || (c.num ? 12 : 14)), numCols: cols.map(c => !!c.num), rowFill: fill ? i => flagFill(rows[i].flags) : null }), sheetName(name));
  const sm = [['Item', 'Value'], ['Tracker', S.settings.title], ['Exported', fmtDate(todayISO())], ['Latest SAP report', D.latest ? fmtDate(D.latest.date) + ' (' + D.latest.file + ')' : '-'], ['MTO request files', S.batches.length], ['Wells', D.W.size], ['MTO lines', D.REC.length], ['SAP STO lines', D.STO.length], ['Open STO lines', D.STO.filter(l => l.open).length], ['Pending PE lines', D.STO.filter(l => l.group === 'pending').length], ['Well x material lines', D.AG.length], ['Outstanding', D.AG.filter(a => a.balance > EPS).length], ['Not raised in SAP', D.AG.filter(a => a.notRaised > EPS).length], ['High-severity flags', D.FL.filter(f => f.sev >= 3).length]];
  XL.utils.book_append_sheet(wb, styledSheet(sm, { widths: [28, 60] }), 'Summary');
  sc(recCols().map(c => c.k === 'material' ? Object.assign({}, c, { xval: r => xNum(r.material) }) : c), D.REC, 'MTO Reconciliation', true);
  sc(agCols(), D.AG.filter(a => a.balance > EPS || a.pendingPE + a.approved > EPS), 'Pending Register', true);
  sc(agCols(), D.AG, 'Well Ledger (all)', true);
  sc(stoExportCols(), D.STO, 'SAP STO Register', true);
  const fc = [['sev', 'Severity'], ['code', 'Flag'], ['wellId', 'Well'], ['dept', 'Discipline'], ['material', 'Material'], ['desc', 'Description'], ['text', 'Detail'], ['src', 'Source'], ['ref', 'Reference']].map(([k, label]) => ({ k, label, val: f => k === 'sev' ? ['Info', 'Low', 'Medium', 'High'][f.sev] : k === 'code' ? FLAGS[f.code].label : f[k], xw: { desc: 40, text: 80, code: 30 }[k] || 12 }));
  sc(fc, D.FL, 'Flags');
  const wc = [['id', 'Well'], ['name', 'Name'], ['wbsT', 'WBS'], ['loc', 'Location'], ['mto', 'MTO files'], ['stos', 'STOs'], ['materials', 'Materials'], ['balanceLines', 'Outstanding'], ['notRaisedLines', 'Not raised'], ['flagLines', 'Flagged'], ['pct', '% complete']].map(([k, label]) => ({ k, label, val: w => k === 'wbsT' ? [...w.wbs].join(', ') : k === 'mto' ? w.batches.length : k === 'stos' ? w.stoNos.size : w[k], xw: { name: 40, wbsT: 30 }[k] || 12 }));
  sc(wc, [...D.W.values()], 'Wells');
  saveWB(wb, `${S.settings.exportPrefix} - Full Tracker Export - ${todayISO()}.xlsx`);
}

/* ---------------- exports view ---------------- */
V.exports = el => {
  const bs = D.batchesSorted; const last = bs[bs.length - 1];
  const card = (t, d, btns) => `<section class="card xcard"><h2>${t}</h2><p class="muted small">${d}</p><div class="row-btns">${btns}</div></section>`;
  el.innerHTML = `<div class="asof">${icon('info')} Exports follow the scope selected at the top (<b>${esc(scopeLabel())}</b>).</div><div class="cards c2">
    ${card('Pending of last MTO - MTO request format', `Same 22 columns as the STO PO REQUEST file. ${last ? 'Last MTO: ' + fmtDate(last.date) + ' (' + esc(last.file) + ')' : 'No MTO loaded.'} Flags go in Column1.`, `<button class="btn primary" data-x="last">${icon('download')}Export</button>`)}
    ${card('All outstanding - MTO request format', 'Every well and material with a balance (net required - issued), one sheet per well. Use "Not raised" quantity to build the next STO request without duplicates.', `<button class="btn primary" data-x="pend">${icon('download')}Export</button>`)}
    ${card('Engineering MTO format', 'M.T.O. SUMMARY layout (job block, SR / DESCRIPTION / QTY / UNIT / M.E.S.C. / SAP NO. / REMARKS, revision block) for outstanding items, grouped by discipline.', `<button class="btn" data-x="eng">${icon('file')}Export</button>`)}
    ${card('Double entries & already-requested', 'All flags (duplicates in SAP, repeated lines in MTO, items already open in an earlier STO, aged pending) with detail text.', `<button class="btn" data-x="flags">${icon('download')}Export</button>`)}
    ${card('Full tracker workbook', 'Summary, MTO reconciliation, pending register, well ledger, SAP STO register, flags and wells in one workbook (whole database, ignores scope).', `<button class="btn" data-x="full">${icon('download')}Export</button>`)}
    ${card('Database backup (.json)', 'Everything incl. edits, settings and SAP snapshots. Save it to Google Drive / GitHub; restore it on any PC from Settings & Admin.', `<button class="btn" data-x="json">${icon('download')}Backup</button>`)}
  </div>`;
  el.onclick = e => {
    const b = e.target.closest('[data-x]'); if (!b) return; const k = b.dataset.x;
    if (k === 'last') { if (!last) return toast('No MTO loaded', 'warn'); openMtoExport({ rows: D.REC.filter(r => r.batchId === last.id && inScope(r)), kind: 'rec', title: 'Last MTO ' + fmtDate(last.date) }); }
    if (k === 'pend') openMtoExport({ rows: D.AG.filter(a => inScope(a) && a.balance > EPS), kind: 'ag', title: 'All outstanding' });
    if (k === 'eng') openEngExport(D.AG.filter(a => inScope(a) && a.balance > EPS).map(agToX));
    if (k === 'flags') { const rows = D.FL.filter(inScope); const fc = [['Severity', f => ['Info', 'Low', 'Medium', 'High'][f.sev]], ['Flag', f => FLAGS[f.code].label], ['Well', f => f.wellId], ['Discipline', f => f.dept], ['Material', f => xNum(f.material)], ['Description', f => f.desc], ['Detail', f => f.text], ['Source', f => f.src], ['Reference', f => f.ref]]; const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, styledSheet([fc.map(c => c[0])].concat(rows.map(f => fc.map(c => c[1](f)))), { widths: [9, 30, 9, 12, 12, 40, 80, 14, 16], rowFill: i => rows[i].sev >= 3 ? FILLS.bad : rows[i].sev === 2 ? FILLS.warn : null }), 'Flags'); saveWB(wb, `${S.settings.exportPrefix} - Flags and Duplicates - ${todayISO()}.xlsx`); }
    if (k === 'full') exportFull();
    if (k === 'json') backup();
  };
};

/* ---------------- data sources ---------------- */
V.sources = el => {
  const adm = isAdmin(); const canImp = adm || S.settings.viewerImport;
  el.innerHTML = `<section class="card"><div class="drop" data-drop>${icon('upload', 'big')}<b>Drop Excel files from the VPS folder here</b><span>MTO requests, SAP STO reports, engineering MTOs, P.O with work orders - or a .json backup</span>
    <div class="row-btns"><button class="btn primary" data-import-folder ${canImp ? '' : 'disabled'}>${icon('folder')}Load VPS folder</button><button class="btn" data-import ${canImp ? '' : 'disabled'}>${icon('file')}Choose files</button>${window.showDirectoryPicker ? `<button class="btn" data-link ${canImp ? '' : 'disabled'}>${icon('refresh')}Link folder & scan for new files</button>` : ''}</div></div></section>
  <section class="card"><div class="card-h"><h2>MTO / STO PO requests</h2><small>${S.batches.length} file(s)</small></div>${tbl(['Date', 'File', 'Wells', 'Lines', 'Disciplines', 'Imported', ''], D.batchesSorted.map(b => [fmtDate(b.date), esc(b.file), esc(uniq(b.lines.map(l => l.wellId)).join(', ')), b.lines.length, esc(uniq(b.lines.map(l => l.dept)).join(', ')), fmtDate((b.imported || '').slice(0, 10)), adm ? `<button class="btn sm" data-bdate="${esc(b.id)}">Change date</button> <button class="btn sm danger" data-bdel="${esc(b.id)}">${icon('trash')}</button>` : '']))}</section>
  <section class="card"><div class="card-h"><h2>SAP STO reports</h2><small>latest = current status</small></div>${tbl(['Report date', 'File', 'Lines', 'STOs', 'Imported', ''], D.snaps.slice().reverse().map((s, i) => [fmtDate(s.date) + (i === 0 ? ' <span class="badge s-received">latest</span>' : ''), esc(s.file), fmtI(s.count), fmtI(s.stos || 0), fmtDate((s.imported || '').slice(0, 10)), adm ? `<button class="btn sm danger" data-sdel="${esc(s.id)}">${icon('trash')}</button>` : '']))}</section>
  <div class="cards c2"><section class="card"><div class="card-h"><h2>Engineering MTOs</h2></div>${tbl(['Well', 'WBS', 'Doc no.', 'Lines', ''], S.design.map(d => [esc(d.wellId), esc(d.meta.wbs), esc(d.meta.docNo), d.lines.length, adm ? `<button class="btn sm danger" data-edel="${esc(d.id)}">${icon('trash')}</button>` : '']))}</section>
  <section class="card"><div class="card-h"><h2>P.O / work-order lookup</h2></div>${S.poMeta ? `<p>${esc(S.poMeta.file)} · ${fmtI(S.poMeta.count)} PO lines · ${fmtDate(S.poMeta.imported.slice(0, 10))}</p>${adm ? '<button class="btn sm danger" data-podel>Remove</button>' : ''}` : '<p class="muted">Not loaded. Optional: adds location and work-order text to wells via Service PO.</p>'}</section></div>`;
  bindDrop(el);
  el.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.bdel) return confirmBox('Delete MTO file', 'Remove this MTO request and its manual edits from the database?', 'Delete', () => { const b = S.batches.find(x => x.id === t.dataset.bdel); S.batches = S.batches.filter(x => x !== b); for (const l of b.lines) delete S.edits.req[l.id]; audit('Delete MTO file', b.file); commit(); });
    if (t.dataset.bdate) { const b = S.batches.find(x => x.id === t.dataset.bdate); return openModal({ title: 'MTO date', body: `<label class="fld"><span>Date of ${esc(b.file)}</span><input type="date" id="nd" value="${b.date}"></label>`, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { b.date = $('#nd').value || b.date; b.modified = Date.now(); audit('Change MTO date', b.file + ' -> ' + b.date); commit(); } }] }); }
    if (t.dataset.sdel) return confirmBox('Delete SAP report', 'Remove this SAP report snapshot?', 'Delete', async () => { const id = t.dataset.sdel; const s = S.snapshots.find(x => x.id === id); S.snapshots = S.snapshots.filter(x => x.id !== id); delete SNAP[id]; await idb.del('snap:' + id); Sync.deleteSnap(id); audit('Delete SAP report', s.file); commit(); });
    if (t.dataset.edel) { S.design = S.design.filter(x => x.id !== t.dataset.edel); audit('Delete engineering MTO', t.dataset.edel); return commit(); }
    if (t.hasAttribute('data-podel')) { PO = null; S.poMeta = null; await idb.del('po'); Sync.poUnsent = false; audit('Remove PO lookup', ''); return commit(); }
    if (t.hasAttribute('data-link')) return linkFolder();
  };
};
const tbl = (h, rows) => rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">None.</p>';
async function linkFolder() {
  try {
    let h = await idb.get('dirHandle');
    if (h) { const p = await h.requestPermission({ mode: 'read' }); if (p !== 'granted') h = null; }
    if (!h) { h = await window.showDirectoryPicker({ mode: 'read' }); await idb.set('dirHandle', h); }
    const files = []; for await (const [name, fh] of h.entries()) if (fh.kind === 'file' && /\.(xlsx|xlsm|xls)$/i.test(name) && !/^~\$/.test(name)) files.push(await fh.getFile());
    if (!files.length) return toast('No Excel files in ' + h.name, 'warn');
    toast(`Scanning ${files.length} file(s) in ${h.name}`); handleFiles(files);
  } catch (e) { if (e.name !== 'AbortError') toast('Folder access not available here: ' + e.message, 'warn', 6000); }
}

/* ---------------- settings & admin ---------------- */
V.settings = el => {
  const st = S.settings; const adm = isAdmin(); const dis = adm ? '' : 'disabled';
  const statuses = uniq(Object.values(SNAP).flat().map(l => l.status)).filter(Boolean).sort();
  el.innerHTML = `${adm ? '' : `<div class="callout warn">${icon('lock')}<div>Viewer mode: settings are read-only. <a href="#" data-admin>Unlock admin</a>.</div></div>`}
  <div class="cards c2">
  <section class="card"><div class="card-h"><h2>Appearance</h2></div><div class="form2">
    <label class="fld span2"><span>Tracker name (header, browser tab, Excel title)</span><input id="sTitle" value="${esc(st.title)}" ${dis}></label>
    <label class="fld span2"><span>Subtitle</span><input id="sSub" value="${esc(st.subtitle)}" ${dis}></label>
    <label class="fld span2"><span>Export file name prefix</span><input id="sPre" value="${esc(st.exportPrefix)}" ${dis}></label>
    <label class="fld"><span>Theme</span><select id="sTheme" ${dis}>${['system', 'light', 'dark'].map(t => `<option ${st.theme === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="fld"><span>Density</span><select id="sDen" ${dis}>${['comfortable', 'compact'].map(t => `<option ${st.density === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="fld"><span>Brand colour</span><input type="color" id="sAcc" value="${esc(st.accent)}" ${dis}></label>
    <div class="fld"><span>Presets</span><div class="row-btns">${[['#204393', 'Al Tasnim blue'], ['#F48323', 'Al Tasnim orange'], ['#495053', 'Graphite'], ['#0f766e', 'Teal']].map(([c, n]) => `<button class="swatch" style="background:${c}" data-acc="${c}" title="${n}" ${dis}></button>`).join('')}</div></div>
    <div class="fld span2"><span>Company logo</span><div class="logo-row">${st.logo ? `<img src="${st.logo}" alt="Logo preview">` : '<em class="muted">No logo</em>'}
      <label class="btn sm ${adm ? '' : 'disabled'}">${icon('upload')}Upload<input type="file" accept="image/*" id="sLogo" hidden ${dis}></label>
      <button class="btn sm" data-logodef ${dis}>Default logo</button><button class="btn sm" data-logodel ${dis}>Remove</button>
      <label class="chk"><input type="checkbox" id="sShow" ${st.showLogo ? 'checked' : ''} ${dis}> Show logo</label></div></div>
  </div>${adm ? '<div class="row-btns"><button class="btn primary" data-saveapp>Save appearance</button></div>' : ''}</section>

  <section class="card"><div class="card-h"><h2>Admin access</h2></div>
    <p class="small">${hasPin() ? 'An admin PIN is set. Viewers can browse and export; import, edit, delete and settings need the PIN.' : '<b>No admin PIN set.</b> Anyone with this file can edit. Set a PIN to lock editing.'}</p>
    <div class="form2"><label class="fld"><span>${hasPin() ? 'New PIN / password' : 'Set PIN / password'}</span><input type="password" id="p1" autocomplete="new-password" ${dis}></label><label class="fld"><span>Repeat</span><input type="password" id="p2" autocomplete="new-password" ${dis}></label>
    <label class="chk span2"><input type="checkbox" id="sVI" ${st.viewerImport ? 'checked' : ''} ${dis}> Allow viewers to import new Excel files</label></div>
    ${adm ? `<div class="row-btns"><button class="btn primary" data-setpin>Save PIN</button>${hasPin() ? '<button class="btn" data-rmpin>Remove PIN</button><button class="btn" data-lock>Lock now</button>' : ''}</div>` : ''}
    <p class="muted small">The PIN is stored as a SHA-256 hash inside this browser's data. It is a convenience lock for a shared file, not server-grade security.</p></section>

  <section class="card"><div class="card-h"><h2>Matching & status logic</h2></div><div class="form2">
    <label class="fld"><span>STO may be raised up to N days before the MTO date</span><input type="number" id="lWin" min="0" max="30" value="${st.windowBefore}" ${dis}></label>
    <label class="fld"><span>"Aged pending" after N days</span><input type="number" id="lAge" min="1" value="${st.agedDays}" ${dis}></label>
    <label class="fld span2"><span>MTO lines not found in the SAP report are</span><select id="lMiss" ${dis}><option value="pending" ${st.missing === 'pending' ? 'selected' : ''}>Pending - not raised in SAP (safe default)</option><option value="issued" ${st.missing === 'issued' ? 'selected' : ''}>Assumed issued (use only if the SAP report lists open lines only and was complete)</option></select></label>
    <label class="chk span2"><input type="checkbox" id="lDrop" ${st.dropAsClosed ? 'checked' : ''} ${dis}> STO lines present in an older SAP report but missing from the latest one count as Closed / issued</label>
    <label class="chk span2"><input type="checkbox" id="lDed" ${st.dedupe ? 'checked' : ''} ${dis}> Re-requests of still-open items in a later MTO do not add to the net requirement</label>
  </div>
  <h3 class="mt">SAP status mapping</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>SAP "STO Status"</th><th>Tracker stage</th></tr></thead><tbody>${(statuses.length ? statuses : DEFAULT_STATUS_MAP.map(x => x[0])).map(s => `<tr><td>${esc(s)}</td><td><select data-smap="${esc(s)}" ${dis}>${Object.entries(STAGES).filter(([k]) => !['NOT_RAISED', 'PRIOR_PENDING', 'ASSUMED_ISSUED'].includes(k)).map(([k, v]) => `<option value="${k}" ${mapStatus(s) === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
  ${adm ? '<div class="row-btns"><button class="btn primary" data-savelogic>Save logic</button></div>' : ''}</section>

  <section class="card"><div class="card-h"><h2>Team database (Google Drive)</h2><span class="sync-chip sc-${Sync.status}">${icon('cloud')}<span>${Sync.on() ? (Sync.status === 'error' ? 'Offline' : 'Connected') : 'Not connected'}</span></span></div>
    <p class="small">Saves to a Drive folder through your Google Apps Script Web App (see <code>apps-script/SETUP.md</code>). Everyone with the Web App URL and team key shares one database; changes sync every minute and are merged if two people save at once. Connection details stay in this browser only.</p>
    <div class="form2">
      <label class="fld span2"><span>Web App URL (ends with /exec)</span><input id="cUrl" value="${esc(Sync.cfg().url || '')}" placeholder="https://script.google.com/macros/s/.../exec"></label>
      <label class="fld"><span>Team key</span><input id="cKey" type="password" value="${esc(Sync.cfg().key || '')}" autocomplete="off"></label>
      <label class="fld"><span>Your name (shown in the activity log)</span><input id="cName" value="${esc(Sync.cfg().name || '')}" placeholder="e.g. Ayaz"></label>
    </div>
    <div class="row-btns"><button class="btn primary" data-cconnect>${icon('cloud')}${Sync.on() ? 'Save & reconnect' : 'Connect'}</button>${Sync.on() ? '<button class="btn" data-csync>Sync now</button><button class="btn" data-cdisc>Disconnect</button>' : ''}</div>
    ${Sync.on() ? `<p class="muted small">Revision ${Sync.rev} · last sync ${Sync.last ? Sync.last.toLocaleTimeString() : '-'}${Sync.msg ? ' · ' + esc(Sync.msg) : ''}</p>` : ''}</section>

  <section class="card"><div class="card-h"><h2>Backup, restore, reset</h2></div>
    <p class="small">Data lives in this browser only (IndexedDB, per PC and per browser). Take a backup after each update and keep it next to the HTML on Google Drive / GitHub. Restoring replaces the current data.</p>
    <div class="row-btns"><button class="btn primary" data-backup>${icon('download')}Download backup (.json)</button><label class="btn ${adm ? '' : 'disabled'}">${icon('upload')}Restore backup<input type="file" accept=".json" id="rIn" hidden ${dis}></label>${adm ? `<button class="btn danger" data-reset>${icon('trash')}Reset database</button>` : ''}</div>
    <h3 class="mt">Activity log</h3><div class="audit">${S.audit.slice(0, 120).map(a => `<div><time>${esc(a.ts.slice(0, 16).replace('T', ' '))}</time><b>${esc(a.action)}</b><span>${esc(a.detail)}</span><em>${esc(a.who)}</em></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div></section>
  </div>
  <section class="card about"><h2>How the tracker reads your files</h2><ol class="small">
    <li><b>MTO request</b>: each line = well (Well ID / WBS), material, requested qty, discipline (Department). The file date comes from the name (e.g. <code>_19.10.26</code>).</li>
    <li><b>SAP STO report</b>: each line = STO / item, target WBS (well), material, qty, STO status. "Pending WBS to WBS Transfer" = waiting for the PE; "STO Created" / "Pending Delivery" = approved; "Pending Goods Receipt", received qty or GR doc = issued.</li>
    <li><b>Matching</b>: an STO line belongs to the latest MTO of the same well dated on or before the STO date (+ tolerance). Quantities are allocated issued → approved → pending; the rest is <b>not raised</b>.</li>
    <li><b>Already requested</b>: the same well + material is still open in an STO raised before this MTO. <b>Double entry</b>: raised in more than one STO, on the same day, or above the requested qty.</li>
    <li><b>Net required</b> per well + material avoids counting re-requests twice; <b>Balance</b> = net required - issued; <b>Excess in SAP</b> = open STO qty above the balance.</li></ol></section>`;
  el.querySelector('[data-cconnect]').onclick = async () => {
    const url = $('#cUrl').value.trim(), key = $('#cKey').value.trim(), name = $('#cName').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return toast('Paste the Apps Script Web App URL (https://script.google.com/.../exec)', 'warn', 6000);
    if (!key) return toast('Enter the team key', 'warn');
    Sync.saveCfg({ url, key, name, enabled: true });
    const done = showBusy('Connecting to the team database...');
    try { const info = await Sync.connect(); done(); audit('Connected to team database', info.folder || ''); persist(true); toast('Connected. Team database revision ' + Sync.rev, 'ok', 5000); if (!Sync.started) { Sync.started = true; Sync.start(); } render(); }
    catch (e) { done(); Sync.setStatus('error', e.message); toast('Connection failed: ' + e.message, 'bad', 8000); }
  };
  const cs = el.querySelector('[data-csync]'); if (cs) cs.onclick = async () => { await Sync.pull({ verbose: true }); if (Sync.dirty) await Sync.push(); render(); toast('Sync done', 'ok'); };
  const cd = el.querySelector('[data-cdisc]'); if (cd) cd.onclick = () => confirmBox('Disconnect', 'Stop syncing this browser? Data stays here and in Drive.', 'Disconnect', () => { const c = Sync.cfg(); c.enabled = false; Sync.saveCfg(c); Sync.setStatus('off'); render(); }, false);
  if (!adm) return;
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { $('#sAcc').value = b.dataset.acc; });
  const lf = $('#sLogo'); if (lf) lf.onchange = () => { const f = lf.files[0]; if (!f) return; if (f.size > 1.5e6) return toast('Logo too large (max 1.5 MB)', 'warn'); const r = new FileReader(); r.onload = () => { st.logo = r.result; st.showLogo = true; audit('Logo uploaded', f.name); persist(); render(); }; r.readAsDataURL(f); };
  el.querySelector('[data-logodef]').onclick = () => { st.logo = DEFAULT_LOGO; st.showLogo = true; persist(); render(); };
  el.querySelector('[data-logodel]').onclick = () => { st.logo = ''; audit('Logo removed', ''); persist(); render(); };
  el.querySelector('[data-saveapp]').onclick = () => { Object.assign(st, { title: $('#sTitle').value.trim() || DEFAULT_TITLE, subtitle: $('#sSub').value.trim(), exportPrefix: $('#sPre').value.trim() || 'Tracker', theme: $('#sTheme').value, density: $('#sDen').value, accent: $('#sAcc').value, showLogo: $('#sShow').checked }); audit('Appearance saved', st.title); persist(); render(); toast('Appearance saved', 'ok'); };
  el.querySelector('[data-setpin]').onclick = () => { const a = $('#p1').value, b = $('#p2').value; if (a.length < 4) return toast('Use at least 4 characters', 'warn'); if (a !== b) return toast('PINs do not match', 'warn'); st.adminHash = sha256('atnm|' + a); st.viewerImport = $('#sVI').checked; ADMIN = true; try { sessionStorage.setItem('atnm_admin', st.adminHash); } catch (e) { } audit('Admin PIN set', ''); persist(); render(); toast('PIN saved. You stay unlocked in this session.', 'ok'); };
  const rm = el.querySelector('[data-rmpin]'); if (rm) rm.onclick = () => confirmBox('Remove PIN', 'Everyone will be able to edit. Continue?', 'Remove PIN', () => { st.adminHash = ''; audit('Admin PIN removed', ''); persist(); render(); });
  const lk = el.querySelector('[data-lock]'); if (lk) lk.onclick = () => { ADMIN = false; try { sessionStorage.removeItem('atnm_admin'); } catch (e) { } render(); };
  el.querySelector('[data-savelogic]').onclick = () => {
    Object.assign(st, { windowBefore: Math.max(0, +$('#lWin').value || 0), agedDays: Math.max(1, +$('#lAge').value || 30), missing: $('#lMiss').value, dropAsClosed: $('#lDrop').checked, dedupe: $('#lDed').checked });
    const map = st.statusMap.filter(([k]) => !$$('[data-smap]', el).some(s => norm(s.dataset.smap) === norm(k)));
    $$('[data-smap]', el).forEach(s => map.unshift([norm(s.dataset.smap), s.value])); st.statusMap = map;
    audit('Logic saved', JSON.stringify({ w: st.windowBefore, a: st.agedDays, m: st.missing, d: st.dropAsClosed, dd: st.dedupe })); commit(); toast('Logic saved and data recalculated', 'ok');
  };
  el.querySelector('[data-reset]').onclick = () => confirmBox('Reset database', Sync.on() ? 'Clear this browser copy and download a fresh copy from the team database on Drive? The team database is not changed.' : 'Delete ALL imported files, edits and settings stored in this browser? Download a backup first. This cannot be undone.', Sync.on() ? 'Clear and reload' : 'Reset everything', async () => { const cloud = Sync.on(); await idb.clear(); const ui = S.ui; S = blankState(); S.ui = ui; SNAP = {}; PO = null; ADMIN = false; Sync.rev = -1; Sync.base = null; Sync.dirty = false; Sync.unsentSnaps.clear(); Sync.poUnsent = false; await Sync.saveMeta(); rebuild(); persist(true); if (cloud) await Sync.pull({ verbose: true }); render(); toast(cloud ? 'Reloaded from the team database' : 'Database reset'); });
  $('#rIn').onchange = e => { const f = e.target.files[0]; if (f) restoreBackup(f); };
};
function backup() {
  const data = { app: 'atnm-mto-sto-tracker', version: VERSION, exported: new Date().toISOString(), state: S, snaps: SNAP, po: PO };
  download(`${S.settings.exportPrefix} - Tracker Backup - ${todayISO()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
  audit('Backup downloaded', ''); persist(); toast('Backup downloaded', 'ok');
}
async function restoreBackup(file) {
  if (!needAdmin(() => restoreBackup(file))) return;
  try {
    const d = JSON.parse(await file.text()); if (d.app !== 'atnm-mto-sto-tracker' || !d.state) throw new Error('not a tracker backup');
    confirmBox('Restore backup', `${Sync.on() ? 'This will also replace the TEAM database on Drive. ' : ''}Replace the current database with the backup from ${esc((d.exported || '').slice(0, 10))} (${(d.state.batches || []).length} MTO files, ${(d.state.snapshots || []).length} SAP reports)?`, 'Restore', async () => {
      await idb.clear(); S = Object.assign(blankState(), d.state); S.settings = Object.assign(defaultSettings(), d.state.settings || {}); SNAP = d.snaps || {}; PO = d.po || null;
      for (const k in SNAP) { await idb.set('snap:' + k, SNAP[k]); Sync.queueSnap(k); } if (PO) { await idb.set('po', PO); Sync.queuePo(); }
      audit('Backup restored', file.name); rebuild(); persist(); render(); toast('Backup restored', 'ok');
    }, false);
  } catch (e) { toast('Restore failed: ' + e.message, 'bad', 6000); }
}

/* ---------------- init ---------------- */
async function init() {
  STORAGE_OK = await idb.open();
  if (STORAGE_OK) {
    const s = await idb.get('state');
    if (s) { S = Object.assign(blankState(), s); S.settings = Object.assign(defaultSettings(), s.settings || {}); S.edits = Object.assign({ req: {}, sto: {}, mat: {} }, s.edits || {}); S.ui = Object.assign(blankState().ui, s.ui || {}); }
    for (const sp of S.snapshots) SNAP[sp.id] = (await idb.get('snap:' + sp.id)) || [];
    PO = (await idb.get('po')) || null;
  } else toast('Browser storage is blocked: data will not be kept after closing. Use backups.', 'warn', 9000);
  try { const u = JSON.parse(localStorage.getItem('atnm_ui') || 'null'); if (u) S.ui = Object.assign(blankState().ui, u); } catch (e) { }
  await Sync.loadMeta();
  try { if (S.settings.adminHash && sessionStorage.getItem('atnm_admin') === S.settings.adminHash) ADMIN = true; } catch (e) { }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'system') applyAppearance(); });
  rebuild(); render();
  if (Sync.on()) { Sync.started = true; Sync.start(); }
  window.ATNM = { get state() { return S; }, get data() { return D; }, handleFiles, commitImport, analyzeWorkbook, rebuild, render, Sync, mergeStates };
}
init();
