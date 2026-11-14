# Al Tasnim ODC Nimr - MTO - STO Status Tracker

Single offline HTML file (`dist/Al Tasnim ODC Nimr - MTO - STO Status Tracker.html`, ~620 KB). Open it in Chrome or Edge. No server, no internet needed.

## What it does
- Reads the Excel files from the VPS folder (drop them in, or use **Load VPS folder**). File type is detected from the headers:
  - **MTO / STO PO request** (e.g. `STO PO REQUEST NIMR_37856_19.10.26 - Request.xlsx`). Date taken from the file name.
  - **SAP STO report** (e.g. `STO-13-11-2026 - SAP Report recieved.XLSX`). The latest report is the current status.
  - Optional: **engineering MTO** (M.T.O. SUMMARY layout) and **P.O with work orders** (Service PO to location and work order).
- Matches each MTO line to SAP STO lines with the same well and material. Quantities are split into issued, approved, pending PE approval and not raised in SAP.
- Flags: already requested (earlier STO still open), double entry in SAP (same day / several STOs / above requested qty), duplicate lines in the MTO, partially raised, aged pending, low stock, UoM mismatch.
- Registers: MTO reconciliation, pending register (well x material), SAP STO register, flags, well inventory by discipline, material master.
- Exports: MTO request format (same 22 columns, flags in Column1), engineering MTO format, well inventory, full workbook, JSON backup.
- Admin PIN (client-side lock), editable records with an activity log, title, logo, brand colour, dark/light theme.

## Data storage
Each browser keeps a working copy in IndexedDB, so the tracker also works offline. For a shared team database, deploy `apps-script/Code.gs` as a Google Apps Script Web App (see `apps-script/SETUP.md`). Then enter its URL and the team key in **Settings & Admin > Team database**. Data is stored in a Drive folder and synced every minute; if two people save at once, their changes are merged.

The repository holds no data: Excel and JSON files are ignored by git.

## Live app (GitHub Pages)
Pages serves `docs/index.html` (branch `main`, folder `/docs`).

## Build
```
node build.js [extra output folder]
```
Sources are in `src/` (core.js engine, ui.js components, views.js screens, io.js import/export/settings, styles.css, template.html). `vendor/` holds xlsx-js-style 1.2.0 (Apache-2.0), which is inlined at build time.
