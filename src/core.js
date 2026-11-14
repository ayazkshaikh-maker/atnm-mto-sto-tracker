/* =====================================================================
   Al Tasnim ODC Nimr - MTO - STO Status Tracker  v2
   core.js : utilities, storage, file detection & parsing, data engine
   ===================================================================== */
'use strict';
const VERSION = '2.0.0';
const DEFAULT_TITLE = 'Al Tasnim ODC Nimr - MTO - STO Status Tracker';
const DEFAULT_LOGO = '__LOGO_DATA_URL__';
const XL = window.XLSX;

/* ---------------- utilities ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const num = v => { if (v == null || v === '') return 0; if (typeof v === 'number') return isFinite(v) ? v : 0; const n = parseFloat(String(v).replace(/,/g, '').trim()); return isNaN(n) ? 0 : n; };
const isNum = v => v != null && v !== '' && !isNaN(parseFloat(String(v).replace(/,/g, '')));
const r3 = n => Math.round((n || 0) * 1000) / 1000;
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const NI = new Intl.NumberFormat('en-US');
const fmt = n => (n == null || n === '') ? '' : NF.format(r3(n));
const fmtI = n => NI.format(Math.round(n || 0));
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sum = (a, f) => { let s = 0; for (const x of a) s += f ? f(x) : x; return s; };
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
  while ((m = re.exec(name))) { let d = +m[1], mo = +m[2], y = +m[3]; if (y < 100) y += 2000; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) best = y + '-' + pad(mo) + '-' + pad(d); }
  return best;
}
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return pad(+d) + '-' + MON[+m - 1] + '-' + String(y).slice(2); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
function normMat(v) { if (v == null) return ''; let s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim(); s = s.replace(/\.0+$/, '').replace(/\s+/g, ''); if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, ''); return s; }
const validMat = m => /^\d{6,12}$/.test(m);
function normWell(v) { if (v == null) return ''; let s = typeof v === 'number' ? String(Math.round(v)) : String(v).trim(); s = s.replace(/\.0+$/, ''); if (/^\d+$/.test(s)) s = String(+s); return s; }
const wellFromWBS = w => { const seg = String(w || '').trim().split('.').pop(); return /^\d{3,6}$/.test(seg) ? normWell(seg) : ''; };
const cellStr = v => v == null ? '' : (typeof v === 'number' ? String(v) : String(v).replace(/\s+/g, ' ').trim());

/* accounts & disciplines */
const ACC = { NIM: 'Greater NIMR', SEF: 'SSFD', OTH: 'Others' };
const ACC_KEYS = ['NIM', 'SEF', 'OTH'];
const accOf = wbs => { const seg = (String(wbs || '').toUpperCase().split('.')[2] || '').trim(); return seg === 'NIM' ? 'NIM' : seg === 'SEF' ? 'SEF' : 'OTH'; };
const DISCS = ['Civil', 'Electrical', 'Instrument', 'Mechanical Flowline', 'Mechanical Hook-up'];
const DISC_SHORT = { 'Civil': 'CIV', 'Electrical': 'ELE', 'Instrument': 'INS', 'Mechanical Flowline': 'M-FL', 'Mechanical Hook-up': 'M-HU', 'Unassigned': '—' };
function discFromText(t) {
  t = String(t || '').toUpperCase();
  if (!t) return '';
  if (/FLOW\s*-?\s*LINE/.test(t)) return 'Mechanical Flowline';
  if (/HOOK\s*-?\s*UP/.test(t)) return 'Mechanical Hook-up';
  if (/ELECT/.test(t)) return 'Electrical';
  if (/INSTR|C\s*&\s*A|CONTROL\s*&/.test(t)) return 'Instrument';
  if (/CIVIL/.test(t)) return 'Civil';
  return '';
}
function discOf(jobTitle, sheet, file, docNo) {
  return discFromText(jobTitle) || discFromText(sheet) || discFromFile(file) || discFromDoc(docNo) || discFromDoc(file) || 'Unassigned';
}
function discFromFile(f) {
  const t = String(f || '').toUpperCase();
  if (/(^|[^A-Z])FL([^A-Z]|$)/.test(t) || /FLOW/.test(t)) return 'Mechanical Flowline';
  if (/HOOK|(^|[^A-Z])HU([^A-Z]|$)|(^|[^A-Z])MECH([^A-Z]|$)/.test(t)) return 'Mechanical Hook-up';
  if (/ELEC/.test(t)) return 'Electrical';
  if (/C&A|INSTR/.test(t)) return 'Instrument';
  if (/CIVIL|(^|[^A-Z])CIV([^A-Z]|$)/.test(t)) return 'Civil';
  return '';
}
function discFromDoc(d) {
  const m = String(d || '').toUpperCase().match(/-\d{6}-([A-Z]{2})-/); if (!m) return '';
  return { EA: 'Electrical', EL: 'Electrical', IN: 'Instrument', IC: 'Instrument', LA: 'Mechanical Flowline', FL: 'Mechanical Flowline', MP: 'Mechanical Hook-up', MH: 'Mechanical Hook-up', CV: 'Civil', CE: 'Civil', CS: 'Civil' }[m[1]] || '';
}
const UOM_MAP = { MTR: 'M', MTRS: 'M', METER: 'M', METRE: 'M', MT: 'M', PCE: 'EA', PCS: 'EA', PC: 'EA', NOS: 'EA', NO: 'EA', EACH: 'EA', SETS: 'SET', ROLL: 'RO', ROLLS: 'RO', PKT: 'PK', PACK: 'PK' };
const normUom = u => { const s = String(u || '').trim().toUpperCase().replace(/\.$/, ''); return UOM_MAP[s] || s; };

/* tiny SHA-256 (file:// safe) */
function sha256(str) {
  const s = unescape(encodeURIComponent(str)); const K = []; const H = []; let p = 0;
  const isP = n => { for (let f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
  for (let c = 2; p < 64; c++) if (isP(c)) { if (p < 8) H[p] = (Math.pow(c, .5) * 4294967296) | 0; K[p++] = (Math.pow(c, 1 / 3) * 4294967296) | 0; }
  const words = []; const bl = s.length * 8;
  for (let i = 0; i < s.length; i++) words[i >> 2] |= s.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[s.length >> 2] |= 0x80 << (24 - (s.length % 4) * 8);
  words[((s.length + 8) >> 6) * 16 + 15] = bl;
  const rr = (v, n) => (v >>> n) | (v << (32 - n)); let h = H.slice();
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

/* ---------------- statuses ---------------- */
const STAGES = {
  NOT_RAISED:    { label: 'Not raised in SAP', short: 'Not raised', group: 'open', css: 'nr', order: 0 },
  PENDING_PE:    { label: 'Pending PE approval (WBS to WBS transfer)', short: 'Pending PE', group: 'open', css: 'pe', order: 1 },
  ON_HOLD:       { label: 'On hold', short: 'On hold', group: 'open', css: 'pe', order: 2 },
  APPROVED:      { label: 'Approved - STO created', short: 'STO created', group: 'approved', css: 'ap', order: 3 },
  AWAIT_DELIVERY:{ label: 'Approved - pending delivery', short: 'Pending delivery', group: 'approved', css: 'ap', order: 4 },
  IN_TRANSIT:    { label: 'Issued - pending goods receipt', short: 'Pending GR', group: 'approved', css: 'tr', order: 5 },
  PART_RECEIVED: { label: 'Partly received (VPS)', short: 'Part received', group: 'received', css: 'pr', order: 6 },
  RECEIVED:      { label: 'Received (VPS doc posted)', short: 'Received', group: 'received', css: 'rc', order: 7 },
  CANCELLED:     { label: 'Cancelled / not required', short: 'Cancelled', group: 'cancelled', css: 'cx', order: 8 }
};
const DEFAULT_STATUS_MAP = [['pending wbs to wbs transfer', 'PENDING_PE'], ['sto created', 'APPROVED'], ['pending delivery', 'AWAIT_DELIVERY'], ['pending goods receipt', 'IN_TRANSIT'], ['cancel', 'CANCELLED'], ['reject', 'CANCELLED'], ['delet', 'CANCELLED']];
function mapStoStatus(s) {
  const n = norm(s); const sm = (S && S.settings && S.settings.statusMap) || DEFAULT_STATUS_MAP;
  for (const [k, v] of sm) if (n === norm(k)) return STAGES[v] ? v : 'PENDING_PE';
  for (const [k, v] of sm) if (k && n.includes(norm(k))) return STAGES[v] ? v : 'PENDING_PE';
  return 'PENDING_PE';
}
const FLAGS = {
  REQ_GT_AVAIL: { label: 'Request > available stock', tone: 'bad' },
  NO_STOCK:     { label: 'Not in STOCK file', tone: 'warn' },
  NO_PO:        { label: 'No FLH service PO for well', tone: 'warn' },
  DUP_MTO:      { label: 'Material repeated for well', tone: 'warn' },
  STO_MULTI:    { label: 'Raised in several STOs', tone: 'bad' },
  STO_OVER:     { label: 'STO qty above MTO qty', tone: 'bad' },
  STO_SHORT:    { label: 'STO qty below MTO qty', tone: 'warn' },
  UOM:          { label: 'UoM differs (MTO vs SAP)', tone: 'info' },
  NO_WELL:      { label: 'Well ID not found in WBS', tone: 'bad' }
};

/* ---------------- template (STO PO Standard request) ---------------- */
// band: where the column is filled from - G = MTO (green), Y = STOCK (yellow), P = PO (gold), B = STO (light blue), N = tracker
const TEMPLATE_COLS = [
  ['sr', 'Sr No', 'N'], ['material', 'Material', 'G'], ['desc', 'Description', 'G'], ['uom', 'UoM', 'G'], ['qty', 'Request Qty', 'G'], ['sapQty', 'SAP QTY', 'Y'],
  ['plant', 'Plant', 'Y'], ['sloc', 'Sloc', 'Y'], ['slocDesc', 'Sloc Description', 'Y'], ['batch', 'Batch', 'Y'], ['valType', 'Val.Type', 'Y'],
  ['wbs', 'Consturction WBS Element', 'G'], ['wellType', 'Well Type', 'G'], ['wellId', 'Well ID', 'G'], ['procWBS', 'Procurement WBS', 'Y'],
  ['docHeader', 'Document header text', 'G'], ['ramz', 'RAMZ ID', 'G'], ['servicePO', 'Service PO', 'P'], ['stoNo', 'STO PO NO', 'B'], ['stoStatus', 'POSTING STATUS', 'B'],
  ['col1', 'Column1', 'N'], ['disc', 'Department', 'N']
];
// template header colour as found in "STO PO Standard request template.xlsx"
const TEMPLATE_FILL = { G: 'C5E0B3', Y: 'FFFF00', P: 'FFE699', B: 'D9E1F2', N: null };
const BAND_LABEL = { G: 'from MTO', Y: 'from STOCK', P: 'from PO', B: 'from STO', N: 'tracker' };
const TPL_ALIASES = {
  sr: ['sr no', 'sr', 's no'], material: ['material', 'material number', 'sap no'], desc: ['description', 'material description'], uom: ['uom', 'unit'],
  qty: ['request qty', 'requested qty', 'qty'], sapQty: ['sap qty', 'available qty', 'stock qty'], plant: ['plant'], sloc: ['sloc'], slocDesc: ['sloc description'],
  batch: ['batch'], valType: ['val type', 'valuation type'], wbs: ['consturction wbs element', 'construction wbs element', 'construction wbs', 'wbs element'],
  wellType: ['well type'], wellId: ['well id'], procWBS: ['procurement wbs'], docHeader: ['document header text'], ramz: ['ramz id', 'project id'],
  servicePO: ['service po'], stoNo: ['sto po no', 'request sto', 'sto no'], stoStatus: ['posting status', 'sto status'], col1: ['column1', 'remarks'], disc: ['department', 'discipline']
};

/* ---------------- state ---------------- */
function defaultSettings() {
  return {
    title: DEFAULT_TITLE, subtitle: 'MTO · STO · Stock · Inventory', exportPrefix: 'ATNM ODC Nimr', logo: DEFAULT_LOGO, showLogo: true,
    theme: 'system', accent: '#204393', density: 'comfortable', adminHash: '', viewerImport: false, dropAsClosed: true,
    statusMap: DEFAULT_STATUS_MAP.map(x => x.slice()), navPinned: false
  };
}
function blankState() {
  return { v: 2, created: new Date().toISOString(), settings: defaultSettings(), mto: [], snapshots: [], poMeta: null, template: null, fileSigs: {},
    edits: { row: {}, mat: {} }, audit: [], ui: { view: 'dashboard', acc: '', well: '', disc: '', wellOpen: '', cols: {} }, batches: [], design: [] };
}

let S = blankState();
let SNAP = {};   // blob id -> rows (STO lines or STOCK rows)
let PO = null;   // { file, imported, rows: [...] }
let D = null;    // derived data
let ADMIN = false;
let STORAGE_OK = false;

let saveTimer = null;
function persist(localOnly) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { S.updated = new Date().toISOString(); idb.set('state', S); }, 250);
  try { localStorage.setItem('atnm_ui', JSON.stringify(S.ui)); } catch (e) { }
  if (!localOnly && typeof Sync !== 'undefined') Sync.markDirty();
}
function audit(action, detail) {
  const nm = (typeof Sync !== 'undefined' && Sync.cfg().name) ? Sync.cfg().name + (ADMIN ? ' (admin)' : '') : (ADMIN ? 'admin' : (hasPin() ? 'viewer' : 'user'));
  S.audit.unshift({ ts: new Date().toISOString(), who: nm, action, detail: String(detail || '').slice(0, 400) }); if (S.audit.length > 800) S.audit.length = 800;
}
const hasPin = () => !!S.settings.adminHash;
const isAdmin = () => !hasPin() || ADMIN;

/* =====================================================================
   STRIKE-THROUGH DETECTION (read raw font formatting, SheetJS CE drops it)
   returns { sheetName: Map(row -> Set(col)) } of struck cells that hold a value
   ===================================================================== */
function struckCells(u8) {
  try { return (u8[0] === 0x50 && u8[1] === 0x4B) ? struckXlsx(u8) : struckXls(u8); }
  catch (e) { console.warn('strike detection failed', e); return {}; }
}
function struckXls(u8) {
  const cfb = XL.CFB.read(u8, { type: 'array' });
  const ent = XL.CFB.find(cfb, 'Workbook') || XL.CFB.find(cfb, 'Book'); if (!ent) return {};
  const b = ent.content instanceof Uint8Array ? ent.content : Uint8Array.from(ent.content);
  const u16 = p => b[p] | (b[p + 1] << 8);
  const fonts = [], xfFont = [], byPos = {}, out = {}; let cur = null, pos = 0;
  const struck = ixfe => { const f = xfFont[ixfe]; if (f == null) return false; return !!fonts[f >= 4 ? f - 1 : f]; };
  const mark = (row, col) => { let s = cur.get(row); if (!s) cur.set(row, s = new Set()); s.add(col); };
  while (pos + 4 <= b.length) {
    const type = u16(pos), len = u16(pos + 2), p = pos + 4;
    switch (type) {
      case 0x0031: fonts.push(!!(u16(p + 2) & 0x0008)); break;                                   // FONT: fStrikeOut
      case 0x00E0: xfFont.push(u16(p)); break;                                                       // XF: ifnt
      case 0x0085: { const off = (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; const cch = b[p + 6], hi = b[p + 7] & 1; let nm = ''; for (let i = 0; i < cch; i++) nm += String.fromCharCode(hi ? u16(p + 8 + 2 * i) : b[p + 8 + i]); byPos[off] = nm; break; }
      case 0x0809: cur = byPos[pos] !== undefined ? (out[byPos[pos]] = new Map()) : (pos === 0 ? null : cur); break;
      case 0x00FD: case 0x0204: case 0x0203: case 0x027E: case 0x0006: case 0x0205:
        if (cur && struck(u16(p + 4))) mark(u16(p), u16(p + 2)); break;
      case 0x00BD: if (cur) { const row = u16(p), c0 = u16(p + 2), n = (len - 6) / 6; for (let i = 0; i < n; i++) if (struck(u16(p + 4 + i * 6))) mark(row, c0 + i); } break;
    }
    pos = p + len;
  }
  return out;
}
function struckXlsx(u8) {
  const zip = XL.CFB.read(u8, { type: 'array' }); const td = new TextDecoder();
  const get = n => { const e = XL.CFB.find(zip, n) || XL.CFB.find(zip, '/' + n); return e ? td.decode(e.content instanceof Uint8Array ? e.content : Uint8Array.from(e.content)) : ''; };
  const styles = get('xl/styles.xml');
  const fontsXml = (styles.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/) || [])[1] || '';
  const fonts = (fontsXml.match(/<font\b[\s\S]*?<\/font>|<font\b[^>]*\/>/g) || []).map(f => /<strike(?![^>]*val="(0|false)")/.test(f));
  const xfsXml = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
  const xfStruck = (xfsXml.match(/<xf\b[^>]*>/g) || []).map(x => { const m = x.match(/fontId="(\d+)"/); return m ? !!fonts[+m[1]] : false; });
  const sst = (get('xl/sharedStrings.xml').match(/<si>[\s\S]*?<\/si>/g) || []).map(si => { const runs = si.match(/<r>[\s\S]*?<\/r>/g); return runs ? runs.every(r => /<strike(?![^>]*val="(0|false)")/.test(r) || !/<t[^>]*>[^<]*\S/.test(r)) && runs.some(r => /<strike/.test(r)) : false; });
  const wbx = get('xl/workbook.xml'), rels = get('xl/_rels/workbook.xml.rels'); const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2].replace(/^\/?xl\//, '').replace(/^\//, '');
  const out = {};
  for (const m of wbx.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const name = m[1].replace(/&amp;/g, '&'); const xml = get('xl/' + (relMap[m[2]] || '')); if (!xml) continue;
    const map = new Map(); out[name] = map;
    for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      if (!c[4] || !/<v>|<is>/.test(c[4])) continue;
      const s = (c[3].match(/\bs="(\d+)"/) || [])[1], t = (c[3].match(/\bt="(\w+)"/) || [])[1];
      let st = s != null && xfStruck[+s];
      if (!st && t === 's') { const v = (c[4].match(/<v>(\d+)<\/v>/) || [])[1]; if (v != null && sst[+v]) st = true; }
      if (st) { const row = +c[2] - 1; const col = XL.utils.decode_col(c[1]); let set = map.get(row); if (!set) map.set(row, set = new Set()); set.add(col); }
    }
  }
  return out;
}

/* =====================================================================
   FILE DETECTION & PARSERS
   ===================================================================== */
function sheetRows(ws) {
  const rows = XL.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: true });
  const off = ws['!ref'] ? XL.utils.decode_range(ws['!ref']).s.r : 0;
  return { rows, off };
}
function findHeader(rows, pred, max = 40) { for (let i = 0; i < Math.min(rows.length, max); i++) { const h = (rows[i] || []).map(norm); if (pred(h, rows[i] || [])) return i; } return -1; }
function colMap(hdr, aliases) {
  const h = hdr.map(norm); const used = new Set(); const m = {};
  for (const k in aliases) for (const a of aliases[k]) { const i = h.indexOf(norm(a)); if (i >= 0 && !used.has(i)) { m[k] = i; used.add(i); break; } }
  for (const k in aliases) { if (m[k] != null) continue; for (const a of aliases[k]) { const na = norm(a); if (na.length < 4) continue; const i = h.findIndex((x, j) => !used.has(j) && x && (x.startsWith(na) || x.includes(na))); if (i >= 0) { m[k] = i; used.add(i); break; } } }
  return m;
}
/* dedupe rows that are identical except for available-qty columns: keep the highest available qty (req 3.2) */
function dedupeByAvail(rows, availKey, ignore = []) {
  const best = new Map(); let dropped = 0;
  for (const r of rows) {
    const k = Object.keys(r).filter(x => x !== availKey && !ignore.includes(x)).sort().map(x => r[x]).join('\u0001');
    const p = best.get(k);
    if (!p) best.set(k, r); else { dropped++; if (r[availKey] > p[availKey]) best.set(k, r); }
  }
  return { rows: [...best.values()], dropped };
}

/* Detect every recognised dataset inside a workbook */
function analyzeWorkbook(wb, file, u8) {
  const out = []; const fileDate = dateFromName(file.name); let struck = null;
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]; if (!ws || !ws['!ref']) continue;
    const { rows, off } = sheetRows(ws); if (!rows.length) continue;
    let hi;
    if ((hi = findHeader(rows, h => h.includes('request sto') && h.includes('sto status'))) >= 0) { out.push(parseSTO(rows, hi, file, sn, fileDate)); continue; }
    if ((hi = findHeader(rows, h => h.includes('sap po') && h.includes('description') && (h.includes('l no') || h.includes('line'))) ) >= 0) { out.push(parsePO(rows, hi, file, sn)); continue; }
    if ((hi = findHeader(rows, h => h.includes('material') && (h.includes('available qty') || h.includes('unrestricted qty') || h.includes('sap qty')) && (h.includes('batch') || h.includes('sloc')) && !h.includes('request sto'))) >= 0 && findHeaderTemplate(rows) === false) { const st = parseStock(rows, hi, file, sn, fileDate); st.cols = (rows[hi] || []).filter(v => v != null && v !== '').length; const prev = out.find(o => o.kind === 'stock'); if (!prev) out.push(st); else if (st.cols > prev.cols || (st.cols === prev.cols && st.lines.length > prev.lines.length)) out[out.indexOf(prev)] = Object.assign(st, { otherSheets: (prev.otherSheets || []).concat(prev.sheet) }); else prev.otherSheets = (prev.otherSheets || []).concat(sn); continue; }
    if ((hi = findHeaderTemplate(rows)) !== false) { out.push({ kind: 'template', file: file.name, sig: file.sig, sheet: sn, header: rows[hi].map(cellStr), rowsWithData: rows.slice(hi + 1).filter(r => r && r.some(v => v != null && v !== '')).length }); continue; }
    if ((hi = findHeader(rows, h => h.includes('description') && h.some(x => /^qty/.test(x)) && h.some(x => x.startsWith('sap no') || x === 'mesc' || x === 'm e s c'))) >= 0) {
      if (!struck) struck = u8 ? struckCells(u8) : {};
      out.push(parseMTO(rows, off, hi, file, sn, struck[sn] || new Map())); continue;
    }
  }
  return out;
}
function findHeaderTemplate(rows) {
  const i = findHeader(rows, h => h.includes('material') && h.includes('request qty') && (h.includes('consturction wbs element') || h.includes('construction wbs element') || h.includes('procurement wbs')) && !h.includes('request sto'), 15);
  return i >= 0 ? i : false;
}

/* --- MTO (engineering material take-off) --- */
function parseMTO(rows, off, hi, file, sn, struckMap) {
  const lab = (re, scanAll) => {
    const lim = scanAll ? rows.length : hi;
    for (let i = 0; i < lim; i++) { const r = rows[i] || []; for (let j = 0; j < r.length; j++) { const c = cellStr(r[j]); if (re.test(c)) { const after = c.split(':').slice(1).join(':').trim(); if (after) return after; for (let k = j + 1; k < r.length; k++) if (cellStr(r[k])) return cellStr(r[k]); } } }
    return '';
  };
  const meta = { jobNo: lab(/^\s*job\s*no/i), projectId: lab(/^\s*project\s*id/i), wbs: lab(/^\s*wbs\.?\s*no/i), site: lab(/^\s*site\s*:?$/i), docNo: lab(/^\s*doc\.?\s*no/i), jobTitle: lab(/^\s*job\s*title/i), area: lab(/^\s*area\b/i) };
  if (!/^C\.[A-Z]{2}\./i.test(meta.wbs)) {   // WBS sometimes only in the revision block, or missing
    meta.wbs = '';
    outer: for (const r of rows) for (const v of (r || [])) { const m = cellStr(v).match(/\bC\.[A-Z]{2}\.[A-Z]{3}\.[A-Z]{2}\.\d{2}\.[A-Z]{3}\.\w+/i); if (m) { meta.wbs = m[0].toUpperCase(); break outer; } }
  }
  const h = rows[hi].map(norm); const fi = f => h.findIndex(f);
  const c = { sr: fi(x => x.startsWith('sr')), desc: fi(x => x === 'description'), qty: fi(x => x.startsWith('qty')), unit: fi(x => x.startsWith('unit')), mesc: fi(x => x === 'mesc' || x === 'm e s c' || x.includes('mesc')), sap: fi(x => x.startsWith('sap no')), rem: fi(x => x.startsWith('remark')) };
  const lines = [], dumped = []; let section = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const first = cellStr(r[0]);
    if (/^(notes?\b|rev\b|project drawing)/i.test(first)) break;
    const desc = c.desc >= 0 ? cellStr(r[c.desc]) : ''; const qv = c.qty >= 0 ? r[c.qty] : null;
    if (!desc && !isNum(qv)) { if (first && !/^\d+(\.0+)?$/.test(first)) section = first; continue; }
    if (!desc) continue;
    if (!isNum(qv) && !first) { section = desc; continue; }
    const rowNo = i + off; const st = struckMap.get(rowNo);
    const material = c.sap >= 0 ? normMat(r[c.sap]) : '';
    const rec = { sr: c.sr >= 0 ? cellStr(r[c.sr]).replace(/\.0+$/, '') : '', desc, qty: num(qv), unit: c.unit >= 0 ? cellStr(r[c.unit]) : '', mesc: c.mesc >= 0 ? normMat(r[c.mesc]) : '', material, remarks: [c.rem >= 0 ? cellStr(r[c.rem]) : '', ...r.slice(Math.max(c.rem, c.sap) + 1).map(cellStr)].filter(Boolean).join(' · '), section, row: rowNo + 1 };
    if (!/^[\d.]+$/.test(rec.mesc)) rec.mesc = '';
    const struckRow = st && (st.has(c.desc) || (c.sap >= 0 && st.has(c.sap)) || st.size >= 2);
    if (struckRow) { dumped.push(Object.assign(rec, { reason: 'Struck out' })); continue; }
    if (!validMat(material)) { dumped.push(Object.assign(rec, { reason: material ? 'Invalid material code (' + cellStr(r[c.sap]) + ')' : 'No material code' })); continue; }
    lines.push(rec);
  }
  const disc = discOf(meta.jobTitle, sn, file.name, meta.docNo);
  const wellType = (meta.jobTitle.toUpperCase().match(/\b(PCP|ESP|SRP|BP|GL|WI|INJ|HOIST|ROD PUMP|BEAM PUMP)\b/) || [])[1] || '';
  return { kind: 'mto', file: file.name, sig: file.sig, sheet: sn, meta, wellId: wellFromWBS(meta.wbs), acc: accOf(meta.wbs), disc, wellType, lines, dumped, date: dateFromName(file.name) };
}

/* --- STOCK (SAP stock list with available qty) --- */
const STOCK_ALIASES = { material: ['material'], desc: ['description', 'material description'], plant: ['plant'], sloc: ['sloc', 'storage location'], slocDesc: ['sloc description'], bin: ['bin number'], batch: ['batch'], valType: ['val type', 'valuation type'], wbs: ['wbs element', 'procurement wbs', 'wbs'], wbsDesc: ['source wbs desc', 'wbs description'], unres: ['unrestricted qty'], avail: ['available qty', 'sap qty'], uom: ['uom', 'base unit'], lastMove: ['last move'], nonMov: ['non mov days'] };
function parseStock(rows, hi, file, sn, fileDate) {
  const m = colMap(rows[hi].map(cellStr), STOCK_ALIASES); const g = (r, k) => m[k] == null ? null : r[m[k]];
  const raw = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const material = normMat(g(r, 'material')); if (!validMat(material)) continue;
    raw.push({ material, desc: cellStr(g(r, 'desc')), plant: cellStr(g(r, 'plant')), sloc: cellStr(g(r, 'sloc')), slocDesc: cellStr(g(r, 'slocDesc')), batch: cellStr(g(r, 'batch')), valType: cellStr(g(r, 'valType')), wbs: cellStr(g(r, 'wbs')), uom: cellStr(g(r, 'uom')), avail: num(g(r, m.avail != null ? 'avail' : 'unres')), unres: num(g(r, 'unres')) });
  }
  const dd = dedupeByAvail(raw, 'avail', ['unres']);
  return { kind: 'stock', file: file.name, sig: file.sig, sheet: sn, date: fileDate || todayISO(), dateSrc: fileDate ? 'file name' : 'today', lines: dd.rows, dupDropped: dd.dropped };
}

/* --- STO report (SAP) --- */
const STO_ALIASES = { status0: ['status'], sto: ['request sto', 'sto number'], item: ['item'], type: ['sto type descr', 'sto type'], status: ['sto status'], material: ['material number', 'material'], desc: ['material description', 'description'], srcWBS: ['source wbs'], batchNo: ['batch number', 'batch'], qty: ['request qty'], uom: ['uom'], tgtWBS: ['target wbs'], tgtWBSDesc: ['target wbs descr'], po: ['service po'], poItem: ['service po item'], ramz: ['ramz id'], recv: ['received qty'], consumed: ['qty consumed'], ret: ['return qty'], avail: ['available qty'], remarks: ['request remarks'], reqBy: ['requested by'], reqOn: ['request on', 'requested on', 'request date'], tfDoc: ['tf document'], delivery: ['delivery'], pgiDoc: ['pgi doc'], grDoc: ['gr doc'], vpsDoc: ['convert vps mat doc', 'vps mat doc'], vpsYear: ['convert vps year'] };
function parseSTO(rows, hi, file, sn, fileDate) {
  const m = colMap(rows[hi].map(cellStr), STO_ALIASES); const g = (r, k) => m[k] == null ? null : r[m[k]];
  const raw = []; let maxD = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const sto = cellStr(g(r, 'sto')).replace(/\.0+$/, ''); if (!sto) continue;
    const reqOn = anyToISO(g(r, 'reqOn'), false); if (reqOn > maxD) maxD = reqOn;
    const tgtWBS = cellStr(g(r, 'tgtWBS')); let vps = cellStr(g(r, 'vpsDoc')).replace(/\.0+$/, ''); if (/^0+$/.test(vps)) vps = '';
    raw.push({ sto, item: String(num(g(r, 'item')) || cellStr(g(r, 'item'))), status: cellStr(g(r, 'status')) || cellStr(g(r, 'status0')), material: normMat(g(r, 'material')), desc: cellStr(g(r, 'desc')),
      qty: num(g(r, 'qty')), uom: cellStr(g(r, 'uom')), srcWBS: cellStr(g(r, 'srcWBS')), batchNo: cellStr(g(r, 'batchNo')), tgtWBS, tgtWBSDesc: cellStr(g(r, 'tgtWBSDesc')), wellId: wellFromWBS(tgtWBS) || '',
      po: cellStr(g(r, 'po')), poItem: cellStr(g(r, 'poItem')), ramz: cellStr(g(r, 'ramz')), recv: num(g(r, 'recv')), avail: num(g(r, 'avail')), remarks: cellStr(g(r, 'remarks')), reqBy: cellStr(g(r, 'reqBy')), reqOn,
      tfDoc: cellStr(g(r, 'tfDoc')), delivery: cellStr(g(r, 'delivery')), pgiDoc: cellStr(g(r, 'pgiDoc')), grDoc: cellStr(g(r, 'grDoc')), vpsDoc: vps });
  }
  const dd = dedupeByAvail(raw, 'avail');
  return { kind: 'sto', file: file.name, sig: file.sig, sheet: sn, date: fileDate || maxD || todayISO(), dateSrc: fileDate ? 'file name' : 'latest request date', lines: dd.rows, dupDropped: dd.dropped };
}

/* --- P.O with work orders --- */
function parsePO(rows, hi, file, sn) {
  const h = rows[hi].map(norm); const fi = f => h.findIndex(f);
  const c = { po: fi(x => x === 'sap po'), line: fi(x => x === 'l no' || x === 'line'), date: fi(x => x.startsWith('p o issued') || x.includes('issued')), loc: fi(x => x === 'loc' || x === 'location'), desc: fi(x => x === 'description'), orig: fi(x => x === 'origr'), cla: fi(x => x === 'cla') };
  const list = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; const po = cellStr(r[c.po]).replace(/\.0+$/, ''); if (!/^\d{6,}$/.test(po)) continue;
    const desc = cellStr(r[c.desc]); const wells = uniq([...desc.matchAll(/(?:ID[-\s]?|_|\.|\b)(\d{3,6})\b/gi)].map(m => normWell(m[1]))).filter(w => w.length >= 3);
    list.push({ po, line: String(num(r[c.line])), date: anyToISO(r[c.date], true), loc: cellStr(r[c.loc]), desc: desc.slice(0, 240), cla: c.cla >= 0 ? cellStr(r[c.cla]).toUpperCase() : '', sheet: sn, wells });
  }
  return { kind: 'po', file: file.name, sig: file.sig, sheet: sn, rows: list, count: list.length };
}

/* =====================================================================
   ENGINE: build the MTO register (template rows) and all indexes
   ===================================================================== */
function latestBlob(kind) { return S.snapshots.filter(s => (s.kind || 'sto') === kind).sort((a, b) => a.date.localeCompare(b.date) || String(a.imported).localeCompare(String(b.imported))).pop() || null; }

function rebuild() {
  const t0 = performance.now();
  const stoSnaps = S.snapshots.filter(s => (s.kind || 'sto') === 'sto').sort((a, b) => a.date.localeCompare(b.date) || String(a.imported).localeCompare(String(b.imported)));
  const latestSto = stoSnaps[stoSnaps.length - 1] || null; const stockBlob = latestBlob('stock');

  /* STO ledger merged across reports (lines missing from the newest report = closed) */
  const M = new Map();
  for (const sp of stoSnaps) for (const x of (SNAP[sp.id] || [])) { const k = x.sto + '|' + x.item; const p = M.get(k); M.set(k, Object.assign({}, x, { key: k, firstSeen: p ? p.firstSeen : sp.date, lastSeen: sp.date })); }
  const STO = [];
  for (const l of M.values()) {
    let stage;
    if (l.vpsDoc) stage = 'RECEIVED';
    else if (S.settings.dropAsClosed && latestSto && l.lastSeen < latestSto.date) stage = 'RECEIVED';
    else stage = mapStoStatus(l.status);
    if (!l.wellId) { const mm = l.remarks.match(/^\s*(?:WELL\s*ID\s*)?(\d{3,6})\b/i); if (mm) l.wellId = normWell(mm[1]); }
    STO.push(Object.assign(l, { stage, received: stage === 'RECEIVED' ? l.qty : 0 }));
  }
  STO.sort((a, b) => (b.reqOn || '').localeCompare(a.reqOn || '') || b.sto.localeCompare(a.sto));
  const stoByMW = groupBy(STO, l => l.material + '|' + l.wellId);
  const stoByNo = groupBy(STO, l => l.sto);

  /* STOCK index */
  const stockRows = stockBlob ? (SNAP[stockBlob.id] || []) : [];
  const stockByMat = groupBy(stockRows, r => r.material);
  const pickStock = (mat, acc) => { const rs = stockByMat.get(mat); if (!rs) return null; const same = rs.filter(r => accOf(r.wbs) === acc); const pool = same.length ? same : rs; return pool.reduce((a, b) => (b.avail > a.avail ? b : a)); };

  /* PO index: well -> PO lines; service PO = CLA FLH line */
  const poByWell = new Map();
  if (PO && PO.rows) for (const r of PO.rows) for (const w of r.wells) { let a = poByWell.get(w); if (!a) poByWell.set(w, a = []); a.push(r); }
  const sheetRank = r => /TASNIM/i.test(r.sheet || '') ? 0 : /CLOSED/i.test(r.sheet || '') ? 2 : 1;
  const flhOf = w => { const a = (poByWell.get(w) || []).filter(r => r.cla === 'FLH'); return a.sort((x, y) => sheetRank(x) - sheetRank(y) || (y.po + y.line.padStart(5, '0')).localeCompare(x.po + x.line.padStart(5, '0')))[0] || null; };

  /* MTO register rows */
  const ROWS = []; const DUMP = [];
  const wellNameFromSto = new Map(); for (const l of STO) if (l.wellId && l.tgtWBSDesc && !wellNameFromSto.has(l.wellId)) wellNameFromSto.set(l.wellId, l.tgtWBSDesc.replace(/^\s*\d+\s*-\s*/, '').trim());
  for (const f of S.mto) {
    for (const d of (f.dumped || [])) DUMP.push(Object.assign({}, d, { fileId: f.id, file: f.file, wellId: f.wellId, acc: f.acc, disc: f.disc }));
    const ed = S.edits.row;
    for (const l of f.lines) {
      const id = f.id + '#' + l.row; const e = ed[id] || {};
      const qty = e.qty != null && e.qty !== '' ? num(e.qty) : l.qty;
      const st = pickStock(l.material, f.acc); const flh = f.wellId ? flhOf(f.wellId) : null;
      const docHeader = e.docHeader || wellNameFromSto.get(f.wellId) || (flh ? flh.desc.replace(/^(PCP\s+)?FL\s*&\s*HUP\s+/i, '').replace(/\s*WO\/NT.*$/i, '').trim() : '') || f.meta.jobTitle;
      ROWS.push({
        id, fileId: f.id, file: f.file, row: l.row, sr: l.sr, section: l.section, disc: e.disc || f.disc, acc: f.acc, wellId: f.wellId, wbs: f.meta.wbs, wellType: e.wellType || f.wellType, ramz: f.meta.projectId,
        jobTitle: f.meta.jobTitle, docNo: f.meta.docNo, area: f.meta.area, material: l.material, mtoDesc: l.desc, desc: l.desc, mtoUom: l.unit, uom: normUom(st && st.uom ? st.uom : l.unit), mesc: l.mesc, qty, mtoQty: l.qty, remarks: e.remarks || l.remarks,
        stock: st, sapQty: st ? st.avail : null, plant: st ? st.plant : '', sloc: st ? st.sloc : '', slocDesc: st ? st.slocDesc : '', batch: st ? st.batch : '', valType: st ? st.valType : '', procWBS: st ? st.wbs : '',
        po: flh, servicePO: flh ? flh.po + '/' + flh.line : '', docHeader, manual: !!Object.keys(e).length, note: e.note || ''
      });
    }
  }
  /* allocate STO lines across MTO rows of the same material + well */
  for (const [k, rows] of groupBy(ROWS, r => r.material + '|' + r.wellId)) {
    const lines = (stoByMW.get(k) || []).filter(x => x.stage !== 'CANCELLED');
    const latest = lines[0] || null; const stos = uniq(lines.map(x => x.sto));
    let poolRaised = sum(lines, x => x.qty), poolRecv = sum(lines, x => x.received);
    const mtoTot = sum(rows, r => r.qty);
    rows.sort((a, b) => a.fileId.localeCompare(b.fileId) || a.row - b.row);
    rows.forEach((r, i) => {
      const raised = i === rows.length - 1 ? poolRaised : Math.min(r.qty, poolRaised); poolRaised -= raised;
      const recv = i === rows.length - 1 ? poolRecv : Math.min(r.qty, poolRecv); poolRecv -= recv;
      Object.assign(r, { stoLines: lines, stoCount: stos.length, stoNo: latest ? latest.sto : '', stoItem: latest ? latest.item : '', stoStatus: latest ? latest.status : '', stoReqOn: latest ? latest.reqOn : '', stoQty: raised, stoQtyAll: sum(lines, x => x.qty), received: Math.max(0, recv), vpsDoc: (lines.find(x => x.vpsDoc) || {}).vpsDoc || '', mtoTotForWell: mtoTot, dupCount: rows.length });
    });
  }
  /* status, flags */
  const stockLoaded = !!stockBlob, poLoaded = !!(PO && PO.rows && PO.rows.length);
  for (const r of ROWS) {
    const e = S.edits.row[r.id] || {};
    let stage;
    if (e.stage && STAGES[e.stage]) stage = e.stage;
    else if (r.qty > EPS && r.received >= r.qty - EPS) stage = 'RECEIVED';
    else if (r.received > EPS) stage = 'PART_RECEIVED';
    else if (!r.stoLines.length) stage = 'NOT_RAISED';
    else stage = r.stoLines.map(x => x.stage).filter(s => s !== 'RECEIVED').sort((a, b) => STAGES[a].order - STAGES[b].order)[0] || 'RECEIVED';
    r.stage = stage; r.group = STAGES[stage].group;
    r.balance = r.group === 'cancelled' ? 0 : Math.max(0, r.qty - r.received);
    r.fill = r.qty > EPS ? Math.min(1, r.received / r.qty) : (r.group === 'received' ? 1 : 0);
    const fl = [];
    if (!r.wellId) fl.push({ code: 'NO_WELL', text: `WBS "${r.wbs || 'missing'}" has no numeric well ID` });
    if (stockLoaded && !r.stock) fl.push({ code: 'NO_STOCK', text: `Material ${r.material} not found in the STOCK file` });
    if (r.stock && r.qty > r.sapQty + EPS) fl.push({ code: 'REQ_GT_AVAIL', text: `Request ${fmt(r.qty)} > available ${fmt(r.sapQty)} ${r.uom} (${r.stock.wbs})` });
    if (poLoaded && r.wellId && !r.po) fl.push({ code: 'NO_PO', text: `No PO line with CLA FLH found for well ${r.wellId}` });
    if (r.dupCount > 1) fl.push({ code: 'DUP_MTO', text: `Material listed ${r.dupCount}x for well ${r.wellId} (total ${fmt(r.mtoTotForWell)})` });
    if (r.stoCount > 1) fl.push({ code: 'STO_MULTI', text: `Raised in ${r.stoCount} STOs: ${uniq(r.stoLines.map(x => x.sto)).join(', ')}` });
    if (r.stoLines.length && r.stoQtyAll > r.mtoTotForWell + EPS) fl.push({ code: 'STO_OVER', text: `STO total ${fmt(r.stoQtyAll)} > MTO total ${fmt(r.mtoTotForWell)}` });
    else if (r.stoLines.length && r.stoQtyAll < r.mtoTotForWell - EPS) fl.push({ code: 'STO_SHORT', text: `STO total ${fmt(r.stoQtyAll)} < MTO total ${fmt(r.mtoTotForWell)}` });
    if (r.stock && r.stock.uom && normUom(r.mtoUom) && normUom(r.mtoUom) !== normUom(r.stock.uom)) fl.push({ code: 'UOM', text: `MTO unit ${r.mtoUom} vs SAP ${r.stock.uom}` });
    r.flags = fl; r.reqGtAvail = fl.some(f => f.code === 'REQ_GT_AVAIL');
    r.col1 = e.col1 != null ? e.col1 : fl.filter(f => FLAGS[f.code].tone !== 'info').map(f => FLAGS[f.code].label.toUpperCase()).join('; ');
  }
  ROWS.sort((a, b) => a.acc.localeCompare(b.acc) || a.wellId.localeCompare(b.wellId, undefined, { numeric: true }) || DISCS.indexOf(a.disc) - DISCS.indexOf(b.disc) || a.fileId.localeCompare(b.fileId) || a.row - b.row);
  ROWS.forEach((r, i) => r.n = i + 1);

  /* wells */
  const W = new Map();
  for (const r of ROWS) {
    let w = W.get(r.wellId);
    if (!w) W.set(r.wellId, w = { id: r.wellId, acc: r.acc, wbs: r.wbs, wellType: r.wellType, ramz: r.ramz, area: r.area, name: r.docHeader, po: r.po, files: new Set(), rows: [], discs: {} });
    w.rows.push(r); w.files.add(r.fileId); (w.discs[r.disc] || (w.discs[r.disc] = [])).push(r);
  }
  for (const w of W.values()) Object.assign(w, kpis(w.rows), { poRows: poByWell.get(w.id) || [], stoNos: uniq(w.rows.flatMap(r => r.stoLines.map(x => x.sto))) });

  D = { ROWS, DUMP, STO, stoByNo, stoByMW, stockRows, stockByMat, stockBlob, latestSto, W, poByWell, flhOf, ms: Math.round(performance.now() - t0) };
  return D;
}
/* KPIs for any list of MTO rows */
function kpis(rows) {
  const live = rows.filter(r => r.group !== 'cancelled');
  const n = live.length, rcv = live.filter(r => r.group === 'received' && r.stage === 'RECEIVED').length, part = live.filter(r => r.stage === 'PART_RECEIVED').length;
  const fillPct = n ? Math.round(sum(live, r => r.fill) / n * 1000) / 10 : 0;
  return { lines: n, receivedLines: rcv, partLines: part, openLines: n - rcv, fillPct, notRaised: live.filter(r => r.stage === 'NOT_RAISED').length, pendingPE: live.filter(r => r.stage === 'PENDING_PE').length, approved: live.filter(r => r.group === 'approved').length, flagged: live.filter(r => r.flags.length).length };
}
