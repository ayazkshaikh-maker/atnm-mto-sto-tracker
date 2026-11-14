# Team database on Google Drive (Apps Script) - setup

Do this once, signed in to the Google account that should own the data.

1. Open https://script.google.com and click **New project**. Name it `MTO-STO Tracker DB`.
2. Delete the sample code, paste the whole of `Code.gs` from this folder, then click **Save**.
3. In the function list at the top, choose `setup` and click **Run**. Google asks for permission to use Drive. Review it and allow it (it is your own script).
4. Open **Execution log**. Copy the **TEAM KEY**. The log also shows the link to the new Drive folder `MTO-STO Tracker DB`.
5. Click **Deploy > New deployment**, then the gear icon and **Web app**.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends with `/exec`).
6. Open the tracker and go to **Settings & Admin > Team database (Google Drive)**. Paste the URL and the team key, add your name, then click **Connect**. Your current data is uploaded.
7. Each team member opens the same tracker link, enters the same URL and key with their own name, and clicks **Connect**.

## Notes
- **Security:** the Web App URL and team key together give read and write access to the tracker data. Share them only with the team. To change the key, run `rotateTeamKey()`; everyone then has to enter the new key.
- **Code changes:** after editing `Code.gs`, use **Deploy > Manage deployments > Edit > Version: New version**. The URL stays the same.
- **Drive contents:** `state.json` holds MTO files, edits, settings and the activity log. `snapshots/` holds one file per SAP report, `po.json` holds the P.O lookup, and `backups/` gets an automatic copy of the state on the first save of each day.
- **Restoring a backup:** to roll back, copy a `backups/state-YYYY-MM-DD.json` over `state.json`. Then every user does **Settings > Reset database > Clear and reload**.
- **Offline:** each browser keeps a local copy. If the connection drops, changes are kept and pushed when it is back. Closing the tab while changes are unsaved shows a warning.
