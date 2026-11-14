/* =====================================================================
   Al Tasnim ODC Nimr - MTO - STO Status Tracker
   core.js : utilities, storage, parsing, reconciliation engine
   ===================================================================== */
'use strict';
const VERSION = '1.0.0';
const DEFAULT_TITLE = 'Al Tasnim ODC Nimr - MTO - STO Status Tracker';
const DEFAULT_LOGO = '__LOGO_DATA_URL__';
const XL = window.XLSX;

/* ---------------- small utilities ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return isFinite(v) ? v : 0; const n = parseFloat(String(v).replace(/,/g, '').trim()); return isNaN(n) ? 0 : n; };
const r3 = n => Math.round((n || 0) * 1000) / 1000;
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const NI = new Intl.NumberFormat('en-US');
const fmt = n => (n == null || n === '') ? '' : NF.format(r3(n));
const fmtI = n => NI.format(Math.round(n || 0));
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const uniq = a => [...new Set(a)];
const EPS = 1e-6;
function groupBy(a, f) { const m = new Map(); for (const x of a) { const k = f(x); let g = m.get(k); if (!g) m.set(k, g = []); g.push(x); } return m; }
const pad = n => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayISO = () => isoOf(new Date());
function serialToISO(n) { const d = new Date(Math.round((n - 25569) * 86400000)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function anyToISO(v, dayFirst) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return (v > 20000 && v < 80000) ? serialToISO(Math.floor(v)) : '';
  if (v instanceof Date) return isoOf(v);
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    let d = dayFirst ? a : b, mo = dayFirst ? b : a; if (mo > 12) [d, mo] = [mo, d];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  if ((m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[a-z]*[\s\-,]+(\d{2,4})/))) {
    const mo = MON.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
    if (mo >= 0) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + pad(mo + 1) + '-' + pad(m[1]); }
  }
  const d = new Date(s); return isNaN(d) ? '' : isoOf(d);
}
function dateFromName(name) {
  const re = /(?<!\d)(\d{1,2})[.\-_ ](\d{1,2})[.\-_ ](\d{4}|\d{2})(?!\d)/g; let m, best = '';
  while ((m = re.exec(name))) {
    let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) best = y + '-' + pad(mo) + '-' + pad(d);
  }
  return best;
}
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return pad(+d) + '-' + MON[+m - 1] + '-' + String(y).slice(2); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const addDays = (iso, n) => { const d = new Date(Date.parse(iso) + n * 864e5); return d.toISOString().slice(0, 10); };
function normMat(v) { if (v == null) return ''; let s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim(); s = s.replace(/\.0+$/, ''); if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, ''); return s; }
function normWell(v) { if (v == null) return ''; let s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim(); s = s.replace(/\.0+$/, ''); if (/^\d+$/.test(s)) s = String(+s); return s; }
const wellFromWBS = w => { const seg = String(w || '').trim().split('.').pop(); return seg ? normWell(seg) : ''; };
const DEPTS = ['Electrical', 'Mechanical', 'Instrument', 'Civil', 'Other'];
function normDept(v) {
  const s = String(v || '').trim(); if (!s) return '';
  if (/elec/i.test(s)) return 'Electrical'; if (/mech|pip/i.test(s)) return 'Mechanical';
  if (/inst/i.test(s)) return 'Instrument'; if (/civil/i.test(s)) return 'Civil';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function classify(desc) {
  const d = String(desc || '').toUpperCase().trim();
  if (!d) return 'Other';
  if (/^(GGE|GAUGE|TUBE|TUBING|FLOWMETER|PLC|RTU|TRANSM|XMTR|THERMOW|RTD|SOLENOID|MANIFOLD|ANALY|INSTR)/.test(d) || /INSTR|YOKOGAWA|ROSEMOUNT|TRANSMITTER|GAUGE/.test(d) || /^CBL.*(FIRE|PAIR|TWISTED)/.test(d)) return 'Instrument';
  if (/^(NAME ?PLATE|CBL|CABLE|WIRE|CONN|CONNECTOR|GLAND|GLND|LUG|SHROUD|CNDT|CONDUIT|MARKER|EARTH|DISTR|DISTRIBUTION|BR CONN|CHANNEL|CARRIER|FITT CNDT|LOCKNUT|TERMINAL|SURGE|DISCONNECTOR|CONDUCTOR|POLE|STRAIN|INSULAT|CROSS ARM|ANGLE|TURNBUCKLE|SHACKLE|THIMBLE|STAY|EYE|LINK|BUCKLE|CLIP|TRANSFORMER|SWITCH|CIRCUIT|MOTOR|TWISTED|ELECTRICAL|DRIVING|STOPPING|INTERMEDIATE|JNT|FASTN ELEC|TAPE INS|TAPE,INS|LIGHT|LUMIN|SOCKET|BREAKER|PANEL|JUNCTION|CAT)/.test(d)) return 'Electrical';
  if (/^(PIPE|FLWN|FLG|FLBL|FLSO|SB2N|ELB|GASW|GSKT|GASKET|RECB|REEB|TERB|TEEB|TEE|CAPT|CAP|VBA|VGL|VGA|VCHS|VCHP|VALVE|BFF|BRF|BRFN|BFBR|LINER|STUB|NUT|BLT|BOLT|WASH|SCREW|U-BOLT|CLAMP|SADDLE|SLV|NPT|ADAPT|COUPLING|REDUCER|BALL|GARJ|TRGP|BLD|BEND|SPACER|NIPPLE|SWAGE|OLET|UNION|PLUG|PLATE|BLOCK|COVER|POST|SHOE|SUPPORT|HDPE|RPE|PAP|SHT|ROUND|BAR|SLEEVE)/.test(d)) return 'Mechanical';
  if (/(CEMENT|CONCRETE|REBAR|AGGREGATE|SAND|PAINT)/.test(d)) return 'Civil';
  return 'Other';
}

/* tiny SHA-256 (works on file:// where crypto.subtle may be unavailable) */
function sha256(str) {
  const s = unescape(encodeURIComponent(str)); const K = []; const H = []; let p = 0;
  const isP = n => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
  for (let c = 2; p < 64; c++) if (isP(c)) { if (p < 8) H[p] = (Math.pow(c, .5) * 4294967296) | 0; K[p++] = (Math.pow(c, 1 / 3) * 4294967296) | 0; }
  const words = []; const bl = s.length * 8;
  for (let i = 0; i < s.length; i++) words[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[s.length >> 2] |= 0x80 << (24 - (s.length % 4) * 8);
  words[((s.length + 8) >> 6) * 16 + 15] = bl;
  const rr = (v, n) => (v >>> n) | (v << (32 - n));
  let h = H.slice();
  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16); const o = h.slice();
    for (let i = 0; i < 64; i++) {
      if (i >= 16) { const w15 = w[i - 15], w2 = w[i - 2]; w[i] = (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0; }
      const a = h[0], e = h[4];
      const t1 = h[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & h[5]) ^ (~e & h[6])) + K[i] + (w[i] | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
      h = [(t1 + t2) | 0].concat(h); h[4] = (h[4] + t1) | 0; h.length = 8;
    }
    for (let i = 0; i < 8; i++) h[i] = (h[i] + o[i]) | 0;
  }
  return h.map(v => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
}

/* ---------------- IndexedDB key-value store ---------------- */
const idb = {
  db: null,
  open() { return new Promise(res => { try { const r = indexedDB.open('atnm-mto-sto-tracker', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { idb.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch (e) { res(false); } }); },
  store(mode) { return idb.db.transaction('kv', mode).objectStore('kv'); },
  get(k) { return new Promise(res => { if (!idb.db) return res(undefined); try { const q = idb.store('readonly').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
  set(k, v) { return new Promise(res => { if (!idb.db) return res(false); try { const q = idb.store('readwrite').put(v, k); q.onsuccess = () => res(true); q.onerror = () => { console.error(q.error); res(false); }; } catch (e) { console.error(e); res(false); } }); },
  del(k) { return new Promise(res => { if (!idb.db) return res(false); try { const q = idb.store('readwrite').delete(k); q.onsuccess = () => res(true); q.onerror = () => res(false); } catch (e) { res(false); } }); },
  clear() { return new Promise(res => { if (!idb.db) return res(false); const q = idb.store('readwrite').clear(); q.onsuccess = () => res(true); q.onerror = () => res(false); }); }
};

/* ---------------- stages, flags, defaults ---------------- */
const STAGES = {
  NOT_RAISED:     { label: 'Not raised in SAP', short: 'Not raised', group: 'pending', css: 'notraised', order: 0 },
  PRIOR_PENDING:  { label: 'Pending under an earlier STO', short: 'Earlier STO', group: 'pending', css: 'prior', order: 1 },
  PENDING_PE:     { label: 'Pending PE approval (WBS to WBS transfer)', short: 'Pending PE', group: 'pending', css: 'pending', order: 2 },
  ON_HOLD:        { label: 'On hold', short: 'On hold', group: 'pending', css: 'pending', order: 3 },
  APPROVED:       { label: 'Approved - STO created', short: 'STO created', group: 'approved', css: 'approved', order: 4 },
  AWAIT_DELIVERY: { label: 'Approved - pending delivery', short: 'Pending delivery', group: 'approved', css: 'delivery', order: 5 },
  IN_TRANSIT:     { label: 'Issued - pending goods receipt', short: 'Pending GR', group: 'issued', css: 'transit', order: 6 },
  PART_RECEIVED:  { label: 'Partially received', short: 'Part received', group: 'issued', css: 'transit', order: 7 },
  ISSUED:         { label: 'Issued (manual)', short: 'Issued', group: 'issued', css: 'received', order: 8 },
  RECEIVED:       { label: 'Received', short: 'Received', group: 'issued', css: 'received', order: 9 },
  CLOSED:         { label: 'Closed in SAP (dropped from open report)', short: 'Closed', group: 'issued', css: 'received', order: 9 },
  ASSUMED_ISSUED: { label: 'Not in SAP report - assumed issued', short: 'Assumed issued', group: 'issued', css: 'received', order: 9 },
  CANCELLED:      { label: 'Cancelled / rejected', short: 'Cancelled', group: 'cancelled', css: 'cancel', order: 10 }
};
const GROUPS = {
  pending: { label: 'Pending', css: 'pending' },
  approved: { label: 'Approved (awaiting issue)', css: 'approved' },
  issued: { label: 'Issued / received', css: 'received' },
  cancelled: { label: 'Cancelled', css: 'cancel' }
};
const FLAGS = {
  ALREADY_REQ: { label: 'Already requested (earlier STO open)', tone: 'warn' },
  SAP_DOUBLE: { label: 'Double entry in SAP', tone: 'bad' },
  OVER_RAISED: { label: 'SAP open qty > outstanding', tone: 'bad' },
  DUP_OPEN: { label: 'Open in multiple STOs', tone: 'bad' },
  SAME_DAY: { label: 'Same-day double raise', tone: 'bad' },
  DUP_IN_MTO: { label: 'Duplicate line in MTO', tone: 'warn' },
  DUP_IN_STO: { label: 'Repeated in same STO', tone: 'warn' },
  PART_RAISED: { label: 'Partially raised in SAP', tone: 'warn' },
  CARRY_FWD: { label: 'Carried forward from earlier MTO', tone: 'info' },
  AGED: { label: 'Aged pending', tone: 'warn' },
  LOW_STOCK: { label: 'Low SAP stock at request', tone: 'info' },
  UOM: { label: 'UoM mismatch', tone: 'warn' },
  NOT_IN_MTO: { label: 'Raised outside uploaded MTOs', tone: 'info' }
};
const REASONS = ['Not raised in SAP', 'Covered by earlier open STO', 'Awaiting PE approval / WBS transfer', 'Awaiting delivery', 'Awaiting goods receipt', 'No stock in SAP', 'Awaiting procurement', 'Partially issued', 'On hold by client', 'Wrong material code', 'Other'];
const DEFAULT_STATUS_MAP = [['pending wbs to wbs transfer', 'PENDING_PE'], ['sto created', 'APPROVED'], ['pending delivery', 'AWAIT_DELIVERY'], ['pending goods receipt', 'IN_TRANSIT'], ['completed', 'RECEIVED'], ['complete', 'RECEIVED'], ['received', 'RECEIVED'], ['closed', 'CLOSED'], ['cancel', 'CANCELLED'], ['reject', 'CANCELLED'], ['delet', 'CANCELLED']];
const REQ_HEADER_DEFAULT = ['Sr No', 'Material', 'Description', 'UoM', 'Request Qty', 'SAP QTY', 'Plant', 'Sloc', 'Sloc Description', 'Batch', 'Val.Type', 'Consturction WBS Element', 'Well Type', 'Well ID', 'Procurement WBS', 'Document header text', 'RAMZ ID', 'Service PO', 'STO PO NO', 'POSTING STATUS', 'Column1', 'Department'];
const REQ_ALIASES = {
  sr: ['sr no', 'sr', 's no', 'sl no', 'serial no', 'item no'], material: ['material', 'material number', 'material no', 'sap no', 'sap code', 'sap material'],
  desc: ['description', 'material description', 'short text'], uom: ['uom', 'unit', 'unit of measure', 'bun'],
  reqQty: ['request qty', 'requested qty', 'req qty', 'required qty', 'qty', 'quantity'], sapQty: ['sap qty', 'stock qty', 'sap stock', 'unrestricted'],
  plant: ['plant'], sloc: ['sloc', 'storage location', 's loc'], slocDesc: ['sloc description', 'storage location description'], batch: ['batch'],
  valType: ['val type', 'valuation type'], constWBS: ['consturction wbs element', 'construction wbs element', 'construction wbs', 'wbs element', 'target wbs'],
  wellType: ['well type'], wellId: ['well id', 'well no', 'well'], procWBS: ['procurement wbs', 'source wbs'], docHeader: ['document header text', 'header text', 'doc header'],
  ramzId: ['ramz id', 'ramz'], servicePO: ['service po', 'service po no'], stoPO: ['sto po no', 'sto po', 'sto no'], postingStatus: ['posting status'],
  col1: ['column1', 'remarks', 'remark'], dept: ['department', 'discipline', 'dept']
};
const SAP_ALIASES = {
  status0: ['status'], sto: ['request sto', 'sto number'], item: ['item'], type: ['sto type descr', 'sto type'], status: ['sto status'],
  material: ['material number', 'material'], desc: ['material description', 'description'], srcPlant: ['source plant'], srcSloc: ['source sloc'],
  srcSlocDesc: ['source sloc descr'], srcWBS: ['source wbs'], srcWBSDesc: ['source wbs descr'], batchNo: ['batch number', 'batch'], qty: ['request qty'],
  uom: ['uom'], tgtPlant: ['target plant'], tgtSloc: ['target sloc'], tgtSlocDesc: ['target sloc descr'], tgtWBS: ['target wbs'], tgtWBSDesc: ['target wbs descr'],
  po: ['service po'], poItem: ['service po item'], ramz: ['ramz id'], recv: ['received qty'], consumed: ['qty consumed'], ret: ['return qty'], avail: ['available qty'],
  remarks: ['request remarks'], reqBy: ['requested by'], reqOn: ['request on', 'requested on', 'request date'], tfDoc: ['tf document'], delivery: ['delivery'],
  pgiDoc: ['pgi doc'], grDoc: ['gr doc'], vpsDoc: ['convert vps mat doc']
};

function defaultSettings() {
  return {
    title: DEFAULT_TITLE, subtitle: 'MTO request vs SAP STO status, pending and inventory by well',
    exportPrefix: 'ATNM ODC Nimr', logo: DEFAULT_LOGO, showLogo: true, theme: 'system', accent: '#204393', density: 'comfortable',
    adminHash: '', viewerImport: false, windowBefore: 2, agedDays: 30, dropAsClosed: true, missing: 'pending', dedupe: true,
    statusMap: DEFAULT_STATUS_MAP.map(x => x.slice()), pageSize: 50
  };
}
function blankState() {
  return { v: 1, created: new Date().toISOString(), settings: defaultSettings(), batches: [], snapshots: [], design: [], poMeta: null, fileSigs: {},
    edits: { req: {}, sto: {}, mat: {} }, audit: [], ui: { view: 'dashboard', well: '', dept: '', batch: '', wellOpen: '' } };
}

let S = blankState();   // persisted small state
let SNAP = {};          // snapshot id -> SAP lines (persisted under 'snap:<id>')
let PO = null;          // PO / work-order lookup (persisted under 'po')
let D = null;           // derived data
let ADMIN = false;
let STORAGE_OK = false;

let saveTimer = null;
function persist(localOnly) { clearTimeout(saveTimer); saveTimer = setTimeout(() => { S.updated = new Date().toISOString(); idb.set('state', JSON.parse(JSON.stringify(S))); }, 350); try { localStorage.setItem('atnm_ui', JSON.stringify(S.ui)); } catch (e) { } if (!localOnly && typeof Sync !== 'undefined') Sync.markDirty(); }
function audit(action, detail) { S.audit.unshift({ ts: new Date().toISOString(), who: (typeof Sync !== 'undefined' && Sync.cfg().name) ? Sync.cfg().name + (ADMIN ? ' (admin)' : '') : (ADMIN ? 'admin' : (hasPin() ? 'viewer' : 'user')), action, detail: String(detail || '').slice(0, 400) }); if (S.audit.length > 800) S.audit.length = 800; }
const hasPin = () => !!S.settings.adminHash;
const isAdmin = () => !hasPin() || ADMIN;

/* ---------------- workbook parsing ---------------- */
function findHeader(rows, pred, max = 40) { for (let i = 0; i < Math.min(rows.length, max); i++) { const h = (rows[i] || []).map(norm); if (pred(h)) return i; } return -1; }
function colMap(hdr, aliases) {
  const h = hdr.map(norm); const used = new Set(); const m = {};
  for (const k in aliases) for (const a of aliases[k]) { const i = h.indexOf(norm(a)); if (i >= 0 && !used.has(i)) { m[k] = i; used.add(i); break; } }
  for (const k in aliases) { if (m[k] != null) continue; for (const a of aliases[k]) { const na = norm(a); if (na.length < 4) continue; const i = h.findIndex((x, j) => !used.has(j) && x && (x.startsWith(na) || x.includes(na))); if (i >= 0) { m[k] = i; used.add(i); break; } } }
  return m;
}
const cellStr = v => v == null ? '' : (typeof v === 'number' ? String(v) : String(v).trim());

function analyzeWorkbook(wb, file) {
  const out = []; const fileDate = dateFromName(file.name);
  const req = { kind: 'req', file: file.name, sig: file.sig, date: fileDate, dateSrc: fileDate ? 'file name' : 'today', sheets: [], lines: [], header: null };
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]; if (!ws || !ws['!ref']) continue;
    const rows = XL.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
    if (!rows.length) continue;
    let hi = findHeader(rows, h => h.includes('request sto') && h.includes('sto status'));
    if (hi >= 0) { out.push(parseSAP(rows, hi, file, sn, fileDate)); continue; }
    hi = findHeader(rows, h => h.includes('sap po') && h.includes('description') && (h.includes('l no') || h.includes('line')));
    if (hi >= 0) { out.push(parsePO(rows, hi, file, sn)); continue; }
    hi = findHeader(rows, h => (h.includes('material') || h.includes('material number') || h.includes('sap no')) && h.some(x => /^(request|requested|req|required) qty/.test(x)));
    if (hi >= 0) { parseReqSheet(rows, hi, sn, req); continue; }
    hi = findHeader(rows, h => h.includes('description') && h.some(x => x.startsWith('qty')) && h.some(x => x.startsWith('sap no') || x === 'm e s c' || x.includes('mesc')));
    if (hi >= 0) { out.push(parseDesign(rows, hi, file, sn)); continue; }
  }
  if (req.lines.length) { if (!req.date) req.date = todayISO(); req.wells = uniq(req.lines.map(l => l.wellId)); out.unshift(req); }
  return out;
}

function parseReqSheet(rows, hi, sn, req) {
  const hdr = rows[hi].map(cellStr); const m = colMap(hdr, REQ_ALIASES);
  if (!req.header) req.header = hdr.filter((x, i) => x || i < hdr.length);
  req.sheets.push(sn);
  const g = (r, k) => m[k] == null ? null : r[m[k]];
  const sheetWell = /^\d{2,6}$/.test(String(sn).trim()) ? normWell(sn) : '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const material = normMat(g(r, 'material')); const desc = cellStr(g(r, 'desc'));
    if (!material && !desc) continue;
    if (/^total/i.test(cellStr(r[0])) && !material) continue;
    const constWBS = cellStr(g(r, 'constWBS'));
    let wellId = normWell(g(r, 'wellId')) || wellFromWBS(constWBS) || sheetWell || '(no well)';
    const sapRaw = g(r, 'sapQty');
    req.lines.push({
      idx: req.lines.length, sheet: sn, sr: cellStr(g(r, 'sr')) || String(req.lines.length + 1), material, desc, uom: cellStr(g(r, 'uom')),
      reqQty: num(g(r, 'reqQty')), sapQty: (sapRaw == null || sapRaw === '') ? null : num(sapRaw), plant: cellStr(g(r, 'plant')), sloc: cellStr(g(r, 'sloc')),
      slocDesc: cellStr(g(r, 'slocDesc')), batch: cellStr(g(r, 'batch')), valType: cellStr(g(r, 'valType')), constWBS, wellType: cellStr(g(r, 'wellType')), wellId,
      procWBS: cellStr(g(r, 'procWBS')), docHeader: cellStr(g(r, 'docHeader')), ramzId: cellStr(g(r, 'ramzId')), servicePO: cellStr(g(r, 'servicePO')),
      stoPO: cellStr(g(r, 'stoPO')), postingStatus: cellStr(g(r, 'postingStatus')), col1: cellStr(g(r, 'col1')), dept: normDept(g(r, 'dept'))
    });
  }
}

function parseSAP(rows, hi, file, sn, fileDate) {
  const m = colMap(rows[hi].map(cellStr), SAP_ALIASES); const g = (r, k) => m[k] == null ? null : r[m[k]];
  const lines = []; let maxD = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const sto = cellStr(g(r, 'sto')).replace(/\.0+$/, ''); if (!sto) continue;
    const reqOn = anyToISO(g(r, 'reqOn'), false); if (reqOn > maxD) maxD = reqOn;
    const tgtWBS = cellStr(g(r, 'tgtWBS')); const remarks = cellStr(g(r, 'remarks'));
    let wellId = wellFromWBS(tgtWBS);
    if (!/^\d+$/.test(wellId)) { const mm = remarks.match(/^\s*(\d{3,6})\b/); if (mm) wellId = normWell(mm[1]); }
    lines.push({
      sto, item: String(num(g(r, 'item')) || cellStr(g(r, 'item'))), type: cellStr(g(r, 'type')), status: cellStr(g(r, 'status')) || cellStr(g(r, 'status0')),
      material: normMat(g(r, 'material')), desc: cellStr(g(r, 'desc')), srcPlant: cellStr(g(r, 'srcPlant')), srcSloc: cellStr(g(r, 'srcSloc')),
      srcSlocDesc: cellStr(g(r, 'srcSlocDesc')), srcWBS: cellStr(g(r, 'srcWBS')), batchNo: cellStr(g(r, 'batchNo')), qty: num(g(r, 'qty')), uom: cellStr(g(r, 'uom')),
      tgtPlant: cellStr(g(r, 'tgtPlant')), tgtSloc: cellStr(g(r, 'tgtSloc')), tgtWBS, tgtWBSDesc: cellStr(g(r, 'tgtWBSDesc')), po: cellStr(g(r, 'po')),
      poItem: cellStr(g(r, 'poItem')), ramz: cellStr(g(r, 'ramz')), recv: num(g(r, 'recv')), consumed: num(g(r, 'consumed')), ret: num(g(r, 'ret')),
      avail: num(g(r, 'avail')), remarks, reqBy: cellStr(g(r, 'reqBy')), reqOn, tfDoc: cellStr(g(r, 'tfDoc')), delivery: cellStr(g(r, 'delivery')),
      pgiDoc: cellStr(g(r, 'pgiDoc')), grDoc: cellStr(g(r, 'grDoc')), wellId: wellId || '(no well)'
    });
  }
  const date = fileDate || maxD || todayISO();
  return { kind: 'sap', file: file.name, sig: file.sig, sheet: sn, date, dateSrc: fileDate ? 'file name' : (maxD ? 'latest request date' : 'today'), lines, wells: uniq(lines.map(l => l.wellId)) };
}

function parseDesign(rows, hi, file, sn) {
  const lab = re => { for (let i = 0; i < hi; i++) { const r = rows[i] || []; for (let j = 0; j < r.length; j++) { const c = cellStr(r[j]); if (re.test(c)) { const after = c.split(':').slice(1).join(':').trim(); if (after) return after; for (let k = j + 1; k < r.length; k++) if (cellStr(r[k])) return cellStr(r[k]); } } } return ''; };
  const meta = { jobNo: lab(/^\s*job\s*no/i), projectId: lab(/project\s*id/i), wbs: lab(/^\s*wbs/i), docNo: lab(/^\s*doc\.?\s*no/i), jobTitle: lab(/job\s*title/i), area: lab(/^\s*area\b/i) };
  const h = rows[hi].map(norm); const fi = f => h.findIndex(f);
  const c = { sr: fi(x => x.startsWith('sr')), desc: fi(x => x === 'description'), qty: fi(x => x.startsWith('qty')), unit: fi(x => x.startsWith('unit')), mesc: fi(x => x === 'm e s c' || x.includes('mesc')), sap: fi(x => x.startsWith('sap no')), rem: fi(x => x.startsWith('remark')) };
  const lines = []; let section = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const first = cellStr(r[0]);
    if (/^(note|rev\b|project drawing)/i.test(first)) break;
    const desc = c.desc >= 0 ? cellStr(r[c.desc]) : ''; const q = c.qty >= 0 ? r[c.qty] : null;
    if (!desc && (q == null || q === '') && first && !/^\d+$/.test(first)) { section = first; continue; }
    if (!desc) continue;
    lines.push({ sr: c.sr >= 0 ? cellStr(r[c.sr]) : '', desc, qty: num(q), unit: c.unit >= 0 ? cellStr(r[c.unit]) : '', mesc: c.mesc >= 0 ? cellStr(r[c.mesc]) : '', material: c.sap >= 0 ? normMat(r[c.sap]) : '', remarks: c.rem >= 0 ? cellStr(r[c.rem]) : '', section });
  }
  return { kind: 'design', file: file.name, sig: file.sig, sheet: sn, meta, wellId: wellFromWBS(meta.wbs) || '(no well)', lines, date: dateFromName(file.name) || '' };
}

function parsePO(rows, hi, file, sn) {
  const h = rows[hi].map(norm); const fi = f => h.findIndex(f);
  const c = { po: fi(x => x === 'sap po'), line: fi(x => x === 'l no' || x === 'line'), date: fi(x => x.startsWith('p o issued') || x.includes('issued')), loc: fi(x => x === 'loc' || x === 'location'), desc: fi(x => x === 'description'), cla: fi(x => x === 'cla') };
  const map = {}; let n = 0;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const po = cellStr(r[c.po]).replace(/\.0+$/, ''); if (!/^\d{6,}$/.test(po)) continue;
    const line = String(num(r[c.line])); const desc = cellStr(r[c.desc]).replace(/\s+/g, ' ');
    let well = ''; const mm = desc.match(/ID[- ]?(\d{3,6})/i) || desc.match(/\.(\d{4,6})\b/) || desc.match(/_(\d{4,6})\b/);
    if (mm) well = normWell(mm[1]);
    map[po + '|' + line] = { loc: cellStr(r[c.loc]), desc: desc.slice(0, 220), date: anyToISO(r[c.date], true), cla: c.cla >= 0 ? cellStr(r[c.cla]) : '', well, sheet: sn }; n++;
  }
  return { kind: 'po', file: file.name, sig: file.sig, sheet: sn, map, count: n };
}

/* ---------------- status mapping ---------------- */
function mapStatus(s) {
  const n = norm(s); const sm = S.settings.statusMap || DEFAULT_STATUS_MAP;
  for (const [k, v] of sm) if (n === norm(k)) return STAGES[v] ? v : 'PENDING_PE';
  for (const [k, v] of sm) if (k && n.includes(norm(k))) return STAGES[v] ? v : 'PENDING_PE';
  return 'PENDING_PE';
}
function stageOfSto(l, e, latestDate) {
  if (e && e.stage && STAGES[e.stage]) return e.stage;
  if (S.settings.dropAsClosed && latestDate && l.lastSeen < latestDate) return 'CLOSED';
  if (l.recv > EPS) return l.recv + EPS >= l.qty ? 'RECEIVED' : 'PART_RECEIVED';
  if (l.grDoc) return 'RECEIVED';
  return mapStatus(l.status);
}
const stageOrder = s => STAGES[s] ? STAGES[s].order : 0;
const leastStage = arr => arr.length ? arr.map(x => x.stage).sort((a, b) => stageOrder(a) - stageOrder(b))[0] : null;
const mostStage = arr => arr.length ? arr.map(x => x.stage).sort((a, b) => stageOrder(b) - stageOrder(a))[0] : null;

/* =====================================================================
   REBUILD: merge snapshots, classify, reconcile MTO vs SAP, aggregate
   ===================================================================== */
function rebuild() {
  const st = S.settings; const wb = Math.max(0, +st.windowBefore || 0);
  const snaps = S.snapshots.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.imported).localeCompare(String(b.imported)));
  const latest = snaps[snaps.length - 1] || null; const asOf = latest ? latest.date : todayISO();
  const prevSnap = snaps.length > 1 ? snaps[snaps.length - 2] : null;

  /* merge SAP snapshots into one STO ledger */
  const M = new Map();
  for (const sp of snaps) for (const x of (SNAP[sp.id] || [])) {
    const k = x.sto + '|' + x.item; const p = M.get(k);
    if (p) { const hist = p.history.slice(); if (p.status !== x.status) hist.push({ date: sp.date, status: x.status }); M.set(k, Object.assign({}, x, { key: k, firstSeen: p.firstSeen, lastSeen: sp.date, history: hist })); }
    else M.set(k, Object.assign({}, x, { key: k, firstSeen: sp.date, lastSeen: sp.date, history: [{ date: sp.date, status: x.status }] }));
  }

  /* material master */
  const MAT = new Map();
  const touch = (m, desc, uom, dept, well) => { if (!m) return; let o = MAT.get(m); if (!o) MAT.set(m, o = { material: m, desc: '', uom: '', dc: {}, wells: new Set(), dept: '', deptSrc: '', raised: 0, open: 0, issued: 0, mto: 0 }); if (desc && !o.desc) o.desc = desc; if (uom && !o.uom) o.uom = uom; if (dept) o.dc[dept] = (o.dc[dept] || 0) + 1; if (well) o.wells.add(well); };
  for (const b of S.batches) for (const l of b.lines) touch(l.material, l.desc, l.uom, l.dept, l.wellId);
  for (const d of S.design) for (const l of d.lines) touch(l.material, l.desc, l.unit, '', d.wellId);
  for (const l of M.values()) touch(l.material, l.desc, l.uom, '', l.wellId);
  for (const o of MAT.values()) {
    const e = S.edits.mat[o.material];
    if (e && e.dept) { o.dept = e.dept; o.deptSrc = 'manual'; }
    else { const ks = Object.keys(o.dc); if (ks.length) { o.dept = ks.sort((a, b) => o.dc[b] - o.dc[a])[0]; o.deptSrc = 'MTO'; } else { o.dept = classify(o.desc); o.deptSrc = 'auto'; } }
  }
  const deptOf = m => (MAT.get(m) || {}).dept || 'Other';

  /* STO lines */
  const STO = [];
  for (const l of M.values()) {
    const e = S.edits.sto[l.key] || null; const wellId = (e && e.wellId) || l.wellId;
    const stage = stageOfSto(l, e, latest && latest.date); const group = STAGES[stage].group;
    STO.push(Object.assign({}, l, { wellId, stage, group, open: group === 'pending' || group === 'approved', dept: deptOf(l.material), age: l.reqOn ? daysBetween(l.reqOn, asOf) : null, flags: [], assign: null, note: (e && e.remarks) || '', manual: !!(e && (e.stage || e.wellId)), wellName: '' }));
  }
  STO.sort((a, b) => (a.reqOn || '').localeCompare(b.reqOn || '') || a.sto.localeCompare(b.sto) || (+a.item) - (+b.item));
  const byWM = groupBy(STO, l => l.wellId + '|' + l.material);
  const addF = (o, code, sev, text) => o.flags.push({ code, sev, text });
  for (const [, arr] of byWM) {
    const open = arr.filter(l => l.open); const stos = uniq(open.map(l => l.sto));
    if (stos.length > 1) { const tot = sum(open, l => l.qty); for (const l of open) addF(l, 'DUP_OPEN', 2, `Same material open in ${stos.length} STOs for well ${l.wellId}: ${stos.join(', ')} (total ${fmt(tot)} ${l.uom})`); }
    for (const [d, ar] of groupBy(open, l => l.reqOn)) { const s2 = uniq(ar.map(l => l.sto)); if (s2.length > 1) for (const l of ar) addF(l, 'SAME_DAY', 3, `Raised ${s2.length}x on ${fmtDate(d)} (STOs ${s2.join(', ')})`); }
    for (const [, ar] of groupBy(arr, l => l.sto + '|' + l.batchNo)) if (ar.length > 1) for (const l of ar) addF(l, 'DUP_IN_STO', 2, `Listed ${ar.length}x in STO ${l.sto}, same batch ${l.batchNo} (items ${ar.map(x => x.item).join(', ')}; qty ${ar.map(x => fmt(x.qty)).join(' + ')})`);
  }
  for (const l of STO) if (l.group === 'pending' && l.age != null && l.age > st.agedDays) addF(l, 'AGED', 1, `Pending ${l.age} days since ${fmtDate(l.reqOn)}`);

  /* wells */
  const W = new Map();
  const well = id => { id = id || '(no well)'; let w = W.get(id); if (!w) W.set(id, w = { id, wbs: new Set(), names: new Set(), types: new Set(), pos: new Set(), ramz: new Set(), batches: [], stoNos: new Set(), stoLines: 0, openLines: 0, design: null, loc: '', poDesc: '' }); return w; };
  const batchesSorted = S.batches.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.imported).localeCompare(String(b.imported)));
  for (const b of batchesSorted) for (const l of b.lines) {
    const w = well(l.wellId); if (!w.batches.includes(b.id)) w.batches.push(b.id);
    if (l.constWBS) w.wbs.add(l.constWBS); if (l.docHeader) w.names.add(l.docHeader); if (l.wellType) w.types.add(l.wellType);
    if (l.servicePO) w.pos.add(l.servicePO.replace(/[-\s]+/, '/')); if (l.ramzId) w.ramz.add(l.ramzId);
  }
  for (const l of STO) {
    const w = well(l.wellId); if (l.tgtWBS) w.wbs.add(l.tgtWBS);
    const nm = l.tgtWBSDesc.replace(/^\s*\d+\s*-\s*/, '').trim(); if (nm) w.names.add(nm);
    if (l.po) w.pos.add(l.po + (l.poItem ? '/' + l.poItem : '')); if (l.ramz) w.ramz.add(l.ramz);
    w.stoNos.add(l.sto); w.stoLines++; if (l.open) w.openLines++;
  }
  for (const d of S.design) { const w = well(d.wellId); w.design = d; if (d.meta.wbs) w.wbs.add(d.meta.wbs); if (d.meta.jobTitle) w.names.add(d.meta.jobTitle); }
  if (PO && PO.map) for (const w of W.values()) for (const p of w.pos) { const [po, it] = p.split('/'); const r = PO.map[po + '|' + String(num(it))]; if (r) { w.loc = w.loc || r.loc; w.poDesc = w.poDesc || r.desc; } }
  for (const w of W.values()) w.name = [...w.names][0] || '';
  for (const l of STO) l.wellName = (W.get(l.wellId) || {}).name || '';

  /* assign STO lines to MTO batches (by well and date window) */
  const wellBatches = new Map();
  for (const b of batchesSorted) for (const wid of uniq(b.lines.map(l => l.wellId))) { let a = wellBatches.get(wid); if (!a) wellBatches.set(wid, a = []); a.push(b); }
  for (const l of STO) { const bl = wellBatches.get(l.wellId); if (!bl || !l.reqOn) continue; let pick = null; for (const b of bl) if (b.date <= addDays(l.reqOn, wb)) pick = b; l.assign = pick ? pick.id : null; }

  /* reconcile each MTO line */
  const REC = []; const lastOpen = new Map(); const mtoWM = new Set();
  for (const b of batchesSorted) {
    const groups = groupBy(b.lines, l => l.wellId + '|' + l.material);
    const thisBatchOpen = [];
    for (const [k, lines] of groups) {
      mtoWM.add(k);
      const all = byWM.get(k) || [];
      const stoNos = uniq(lines.map(l => String(l.stoPO || '').trim()).filter(x => /^\d{6,}$/.test(x)));
      let A = stoNos.length ? all.filter(x => stoNos.includes(x.sto)) : all.filter(x => x.assign === b.id);
      A = A.filter(x => x.group !== 'cancelled');
      const P = all.filter(x => x.open && !A.includes(x) && x.reqOn && x.reqOn <= b.date && x.assign !== b.id);
      const pools = { issued: A.filter(x => x.group === 'issued'), approved: A.filter(x => x.group === 'approved'), pending: A.filter(x => x.group === 'pending') };
      let pI = sum(pools.issued, x => x.qty), pA = sum(pools.approved, x => x.qty), pP = sum(pools.pending, x => x.qty);
      const raised = pI + pA + pP; const reqTot = sum(lines, l => l.reqQty);
      const As = uniq(A.map(x => x.sto));
      const sorted = lines.slice().sort((a, c) => a.idx - c.idx);
      const prev = lastOpen.get(k);
      for (const l of sorted) {
        let need = l.reqQty; const take = p => { const t = Math.max(0, Math.min(need, p)); need -= t; return t; };
        const iq = take(pI); pI -= iq; const aq = take(pA); pA -= aq; const pq = take(pP); pP -= pq; const nr = Math.max(0, need);
        let stage;
        if (l.reqQty <= EPS) stage = raised > EPS ? leastStage(A) : 'NOT_RAISED';
        else if (iq >= l.reqQty - EPS) stage = mostStage(pools.issued) || 'RECEIVED';
        else if (nr >= l.reqQty - EPS) stage = P.length ? 'PRIOR_PENDING' : (st.missing === 'issued' ? 'ASSUMED_ISSUED' : 'NOT_RAISED');
        else if (pq > EPS) stage = 'PENDING_PE';
        else if (nr > EPS) stage = 'NOT_RAISED';
        else stage = leastStage(pools.approved) || 'APPROVED';
        const autoStage = stage;
        let issued = iq, approved = aq, pendingPE = pq, notRaised = nr;
        if (stage === 'ASSUMED_ISSUED') { issued = l.reqQty; notRaised = 0; }
        const autoIssued = issued;
        const e = S.edits.req[l.id] || {};
        const hasI = e.issuedQty != null && e.issuedQty !== '', hasA = e.approvedQty != null && e.approvedQty !== '';
        if (e.stage && STAGES[e.stage]) {
          stage = e.stage; const gg = STAGES[stage].group;
          if (!hasI && !hasA) {
            if (gg === 'issued') { issued = l.reqQty; approved = 0; pendingPE = 0; notRaised = 0; }
            else if (gg === 'approved') { approved = Math.max(0, l.reqQty - issued); pendingPE = 0; notRaised = 0; }
            else if (gg === 'cancelled') { approved = 0; pendingPE = 0; notRaised = 0; }
          }
        }
        if (hasI) issued = num(e.issuedQty);
        if (hasA) approved = num(e.approvedQty);
        if (hasI || hasA) {
          const rest = Math.max(0, l.reqQty - issued - approved); pendingPE = Math.min(pq, rest); notRaised = rest - pendingPE;
          if (!e.stage) stage = issued >= l.reqQty - EPS ? 'ISSUED' : (rest <= EPS && approved > 0 ? 'APPROVED' : (pendingPE > EPS ? 'PENDING_PE' : 'NOT_RAISED'));
        }
        const group = STAGES[stage].group; const cancelled = group === 'cancelled';
        const open = cancelled ? 0 : Math.max(0, l.reqQty - issued);
        const pendingQty = cancelled ? 0 : Math.max(0, l.reqQty - issued - approved);
        const flags = [];
        if (P.length) flags.push({ code: 'ALREADY_REQ', sev: 3, text: 'Already requested by Al Tasnim - still open in earlier STO: ' + uniq(P.map(x => `${x.sto} (${fmtDate(x.reqOn)}, ${fmt(x.qty)} ${x.uom}, ${STAGES[x.stage].short})`)).join('; ') });
        if (As.length > 1 || raised > reqTot + EPS) flags.push({ code: 'SAP_DOUBLE', sev: 3, text: `Raised ${As.length > 1 ? As.length + 'x ' : ''}in SAP (STO ${As.join(', ')}): ${fmt(raised)} vs MTO ${fmt(reqTot)} ${l.uom}` + (raised > reqTot + EPS ? ` - excess ${fmt(raised - reqTot)}` : '') });
        if (lines.length > 1) flags.push({ code: 'DUP_IN_MTO', sev: 2, text: `Listed ${lines.length}x in this MTO (Sr ${sorted.map(x => x.sr).join(', ')}) - total ${fmt(reqTot)} ${l.uom}` });
        if (raised > EPS && raised < reqTot - EPS) flags.push({ code: 'PART_RAISED', sev: 2, text: `Only ${fmt(raised)} of ${fmt(reqTot)} ${l.uom} raised in SAP` });
        if (prev && prev.open > EPS) flags.push({ code: 'CARRY_FWD', sev: 1, text: `Also requested in MTO ${fmtDate(prev.date)} - ${fmt(prev.open)} ${l.uom} still open there` });
        if (l.sapQty != null && l.sapQty < l.reqQty - EPS) flags.push({ code: 'LOW_STOCK', sev: 1, text: `SAP stock at request ${fmt(l.sapQty)} < requested ${fmt(l.reqQty)}` });
        if (A.some(x => x.uom && l.uom && norm(x.uom) !== norm(l.uom))) flags.push({ code: 'UOM', sev: 1, text: `UoM in MTO (${l.uom}) differs from SAP (${uniq(A.map(x => x.uom)).join(', ')})` });
        const autoReason = { NOT_RAISED: 'Not raised in SAP', PRIOR_PENDING: 'Covered by earlier open STO', PENDING_PE: 'Awaiting PE approval / WBS transfer', ON_HOLD: 'On hold by client', APPROVED: 'Awaiting delivery', AWAIT_DELIVERY: 'Awaiting delivery', IN_TRANSIT: 'Awaiting goods receipt' }[stage] || '';
        const rec = Object.assign({}, l, {
          batchId: b.id, batchDate: b.date, batchFile: b.file, dept: l.dept || deptOf(l.material), stage, autoStage, group, issued, approved, pendingPE, notRaised, open, pendingQty,
          raised, reqTot, A, P, stoNos: As, flags, manual: !!(e.stage || hasI || hasA), reason: e.reason || autoReason, remarks: e.remarks || '', autoIssued, wellName: (W.get(l.wellId) || {}).name || ''
        });
        REC.push(rec); thisBatchOpen.push([k, rec]);
      }
    }
    for (const [k, rec] of thisBatchOpen) { const o = lastOpen.get(k); if (o && o.date === b.date) o.open += rec.open; else lastOpen.set(k, { date: b.date, open: rec.open }); }
  }
  for (const l of STO) if (wellBatches.has(l.wellId) && !mtoWM.has(l.wellId + '|' + l.material)) addF(l, 'NOT_IN_MTO', 0, 'Material raised in SAP for this well but not found in any uploaded MTO request');

  /* well x material ledger */
  const AG = new Map();
  const ag = (wid, m, desc, uom) => {
    const k = wid + '|' + m; let a = AG.get(k);
    if (!a) { const mi = MAT.get(m) || {}; AG.set(k, a = { key: k, wellId: wid, material: m, desc: mi.desc || desc || '', uom: mi.uom || uom || '', dept: mi.dept || classify(desc), design: null, mesc: '', mtoQty: 0, mtoBatches: new Map(), raised: 0, pendingPE: 0, approved: 0, issued: 0, received: 0, cancelled: 0, stos: new Set(), openStos: new Set(), first: '', oldestAge: null, flagMap: new Map(), recLines: [], stoLines: [], manualExtra: 0 }); }
    return a;
  };
  const mergeFlags = (a, fl) => { for (const f of fl) if (!a.flagMap.has(f.code) || a.flagMap.get(f.code).sev < f.sev) a.flagMap.set(f.code, f); };
  for (const l of STO) {
    const a = ag(l.wellId, l.material, l.desc, l.uom); a.stoLines.push(l); a.stos.add(l.sto);
    if (l.group === 'cancelled') a.cancelled += l.qty; else { a.raised += l.qty; if (l.group === 'pending') a.pendingPE += l.qty; else if (l.group === 'approved') a.approved += l.qty; else a.issued += l.qty; }
    a.received += l.recv; if (l.open) a.openStos.add(l.sto);
    if (l.reqOn && (!a.first || l.reqOn < a.first)) a.first = l.reqOn;
    if (l.group === 'pending' && l.age != null && (a.oldestAge == null || l.age > a.oldestAge)) a.oldestAge = l.age;
    mergeFlags(a, l.flags.filter(f => f.code !== 'NOT_IN_MTO'));
  }
  for (const r of REC) {
    const a = ag(r.wellId, r.material, r.desc, r.uom); a.recLines.push(r); a.mtoQty += r.reqQty;
    a.mtoBatches.set(r.batchDate, (a.mtoBatches.get(r.batchDate) || 0) + r.reqQty);
    a.manualExtra += Math.max(0, r.issued - r.autoIssued) + (r.stage === 'ASSUMED_ISSUED' && !r.manual ? r.reqQty : 0);
    if (r.batchDate && (!a.first || r.batchDate < a.first)) a.first = r.batchDate;
    if (r.dept && a.dept !== r.dept && (MAT.get(r.material) || {}).deptSrc !== 'manual') a.dept = r.dept;
    mergeFlags(a, r.flags);
  }
  for (const d of S.design) for (const l of d.lines) { if (!l.material) continue; const a = ag(d.wellId, l.material, l.desc, l.unit); a.design = (a.design || 0) + l.qty; if (l.mesc) a.mesc = l.mesc; }
  const issuedSto = (a, before) => sum(a.stoLines.filter(x => x.group === 'issued' && (!before || (x.reqOn && x.reqOn < before))), x => x.qty);
  const AGL = [];
  for (const a of AG.values()) {
    const bd = [...a.mtoBatches.entries()].sort((x, y) => x[0].localeCompare(y[0]));
    a.mtoCount = bd.length; a.mtoLatest = bd.length ? bd[bd.length - 1][1] : 0; a.mtoLatestDate = bd.length ? bd[bd.length - 1][0] : '';
    if (bd.length) {
      if (st.dedupe) { let req = 0; for (const [d, q] of bd) { const openBefore = Math.max(0, req - issuedSto(a, d)); req += Math.max(0, q - openBefore); } a.required = req; }
      else a.required = a.mtoQty;
      a.basis = 'MTO';
    } else { a.required = a.raised; a.basis = 'SAP'; }
    a.issuedEff = a.issued + a.manualExtra;
    a.balance = Math.max(0, a.required - a.issuedEff);
    a.notRaised = Math.max(0, a.balance - a.pendingPE - a.approved);
    a.excess = Math.max(0, a.pendingPE + a.approved - a.balance);
    if (a.basis === 'MTO' && a.excess > EPS) mergeFlags(a, [{ code: 'OVER_RAISED', sev: 3, text: `SAP open qty (${fmt(a.pendingPE + a.approved)}) exceeds outstanding (${fmt(a.balance)}) by ${fmt(a.excess)} ${a.uom} - possible double entry` }]);
    a.designBal = a.design != null ? Math.max(0, a.design - a.required) : null;
    a.status = a.balance <= EPS ? (a.required > EPS ? 'Complete' : (a.cancelled > 0 ? 'Cancelled' : 'Complete')) : (a.notRaised > EPS ? 'Not raised' : (a.pendingPE > EPS ? 'Pending PE' : 'Approved'));
    a.flags = [...a.flagMap.values()].sort((x, y) => y.sev - x.sev);
    a.wellName = (W.get(a.wellId) || {}).name || '';
    a.pctIssued = a.required > EPS ? Math.min(100, Math.round(a.issuedEff / a.required * 100)) : 100;
    const mi = MAT.get(a.material); if (mi) { mi.raised += a.raised; mi.open += a.pendingPE + a.approved; mi.issued += a.issuedEff; mi.mto += a.mtoQty; }
    AGL.push(a);
  }
  AGL.sort((x, y) => x.wellId.localeCompare(y.wellId, undefined, { numeric: true }) || x.dept.localeCompare(y.dept) || x.material.localeCompare(y.material));

  /* well stats */
  for (const w of W.values()) {
    const rows = AGL.filter(a => a.wellId === w.id);
    w.materials = rows.length; w.balanceLines = rows.filter(a => a.balance > EPS).length; w.completeLines = rows.filter(a => a.balance <= EPS && a.required > EPS).length;
    w.flagLines = rows.filter(a => a.flags.some(f => f.sev >= 2)).length; w.notRaisedLines = rows.filter(a => a.notRaised > EPS).length;
    w.pct = rows.length ? Math.round(w.completeLines / rows.length * 100) : 0;
    const d = {}; for (const a of rows) { const x = d[a.dept] || (d[a.dept] = { n: 0, done: 0, open: 0 }); x.n++; if (a.balance <= EPS) x.done++; else x.open++; }
    w.depts = d; w.lastMto = w.batches.length ? (S.batches.find(b => b.id === w.batches[w.batches.length - 1]) || {}).date : '';
  }

  /* flags list */
  const FL = [];
  for (const r of REC) for (const f of r.flags) FL.push({ sev: f.sev, code: f.code, wellId: r.wellId, material: r.material, desc: r.desc, dept: r.dept, text: f.text, src: 'MTO ' + fmtDate(r.batchDate), ref: 'Sr ' + r.sr, kind: 'rec', id: r.id });
  for (const l of STO) for (const f of l.flags) FL.push({ sev: f.sev, code: f.code, wellId: l.wellId, material: l.material, desc: l.desc, dept: l.dept, text: f.text, src: 'SAP STO', ref: l.sto + '/' + l.item, kind: 'sto', id: l.key });
  for (const a of AGL) { const f = a.flagMap.get('OVER_RAISED'); if (f) FL.push({ sev: f.sev, code: f.code, wellId: a.wellId, material: a.material, desc: a.desc, dept: a.dept, text: f.text, src: 'Well ledger', ref: '', kind: 'ag', id: a.key }); }
  FL.sort((a, b) => b.sev - a.sev || a.wellId.localeCompare(b.wellId, undefined, { numeric: true }));

  /* snapshot movement */
  let movement = null;
  if (prevSnap && latest) {
    const prevKeys = new Set((SNAP[prevSnap.id] || []).map(x => x.sto + '|' + x.item)); const curKeys = new Set((SNAP[latest.id] || []).map(x => x.sto + '|' + x.item));
    let closed = 0, added = 0; for (const k of prevKeys) if (!curKeys.has(k)) closed++; for (const k of curKeys) if (!prevKeys.has(k)) added++;
    const changed = STO.filter(l => l.history.length > 1 && l.history[l.history.length - 1].date === latest.date).length;
    movement = { from: prevSnap.date, to: latest.date, closed, added, changed };
  }

  D = { asOf, latest, snaps, STO, byWM, MAT, W, REC, AG: AGL, AGmap: AG, FL, batchesSorted, movement };
  return D;
}
