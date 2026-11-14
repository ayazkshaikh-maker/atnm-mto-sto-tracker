/**
 * Al Tasnim ODC Nimr - MTO - STO Status Tracker
 * Google Drive database (Google Apps Script Web App)
 *
 * Stores everything in one Drive folder "MTO-STO Tracker DB":
 *   state.json              shared tracker state (MTO files, edits, settings, activity log)
 *   po.json                 P.O / work-order lookup
 *   snapshots/<id>.json     SAP STO report lines, one file per report
 *   backups/state-<date>.json  first save of each day (automatic daily backup)
 *
 * Setup: run setup() once from the editor, copy the TEAM KEY from the log,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */
const DB_FOLDER = 'MTO-STO Tracker DB';
const TZ = 'Asia/Muscat';
const P = () => PropertiesService.getScriptProperties();

function setup() {
  const p = P();
  if (!p.getProperty('TEAM_KEY')) p.setProperty('TEAM_KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 24));
  const f = folder_(); sub_('snapshots'); sub_('backups');
  Logger.log('TEAM KEY  : ' + p.getProperty('TEAM_KEY'));
  Logger.log('DB folder : ' + f.getUrl());
}
/** Run to replace the team key (everyone must enter the new key). */
function rotateTeamKey() { P().deleteProperty('TEAM_KEY'); setup(); }

function folder_() {
  const p = P(); const id = p.getProperty('FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  const f = DriveApp.createFolder(DB_FOLDER); p.setProperty('FOLDER_ID', f.getId()); return f;
}
function sub_(name) { const f = folder_(); const it = f.getFoldersByName(name); return it.hasNext() ? it.next() : f.createFolder(name); }
function file_(dir, name) { const it = dir.getFilesByName(name); while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; } return null; }
function read_(dir, name) { const f = file_(dir, name); return f ? JSON.parse(f.getBlob().getDataAsString('UTF-8')) : null; }
function write_(dir, name, obj) { const s = JSON.stringify(obj); const f = file_(dir, name); if (f) f.setContent(s); else dir.createFile(name, s, MimeType.PLAIN_TEXT); }
function del_(dir, name) { const f = file_(dir, name); if (f) f.setTrashed(true); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function safeId_(id) { return String(id || '').replace(/[^A-Za-z0-9_.\-]/g, '_').slice(0, 120); }
function listSnaps_() { const it = sub_('snapshots').getFiles(); const a = []; while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) a.push(f.getName().replace(/\.json$/, '')); } return a; }
function dailyBackup_(state) { const d = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); const dir = sub_('backups'); if (!file_(dir, 'state-' + d + '.json')) write_(dir, 'state-' + d + '.json', state); }

function doGet() { return out_({ ok: true, app: 'atnm-mto-sto-db', note: 'Use POST with the team key.' }); }

function doPost(e) {
  let q;
  try { q = JSON.parse(e.postData.contents); } catch (err) { return out_({ error: 'bad request' }); }
  const key = P().getProperty('TEAM_KEY');
  if (!key) return out_({ error: 'server not set up: run setup() in the Apps Script editor' });
  if (!q || q.key !== key) return out_({ error: 'invalid team key' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const root = folder_(); const rev = +(P().getProperty('REV') || 0);
    switch (q.action) {
      case 'info':
        return out_({ ok: true, rev, updated: P().getProperty('UPDATED') || '', by: P().getProperty('BY') || '', snaps: listSnaps_(), hasPo: !!file_(root, 'po.json'), folder: root.getUrl() });
      case 'pull':
        if (q.haveRev === rev) return out_({ ok: true, rev, same: true });
        return out_({ ok: true, rev, state: read_(root, 'state.json'), updated: P().getProperty('UPDATED') || '', by: P().getProperty('BY') || '' });
      case 'push': {
        if (q.baseRev !== rev) return out_({ ok: false, conflict: true, rev, state: read_(root, 'state.json') });
        if (!q.state || typeof q.state !== 'object') return out_({ error: 'missing state' });
        write_(root, 'state.json', q.state);
        const nrev = rev + 1;
        P().setProperties({ REV: String(nrev), UPDATED: new Date().toISOString(), BY: String(q.by || '').slice(0, 60) });
        dailyBackup_(q.state);
        return out_({ ok: true, rev: nrev });
      }
      case 'putSnap': write_(sub_('snapshots'), safeId_(q.id) + '.json', q.lines || []); return out_({ ok: true });
      case 'getSnap': return out_({ ok: true, lines: read_(sub_('snapshots'), safeId_(q.id) + '.json') });
      case 'delSnap': del_(sub_('snapshots'), safeId_(q.id) + '.json'); return out_({ ok: true });
      case 'putPo': write_(root, 'po.json', q.po || null); return out_({ ok: true });
      case 'getPo': return out_({ ok: true, po: read_(root, 'po.json') });
      default: return out_({ error: 'unknown action' });
    }
  } catch (err) {
    return out_({ error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) { }
  }
}
