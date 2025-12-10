# filt — Excel import + table view + reconcile

Small demo app with frontend SPA and Express backend.

Features
- Frontend single-page app using hash routing (`#home`, `#template`, `#import`, `#reconcile`, `#table`) so pages work on refresh.
- Upload Excel (`.xlsx`/`.xls`) file; backend parses it to JSON and stores in memory.
- **Reconcile tool**: Upload an old/messy product list and a clean template. Manually match each old record with a template row by searching.
- Table view shows parsed rows.
- Export reconciled data as Excel file.

Quick setup (PowerShell)

```powershell
cd c:\Users\ihsan\Documents\GitHub\filt
npm install
npm start
# Open http://localhost:3000 in your browser
```

API
- `POST /api/import` — form upload (field name `file`), returns `{ ok: true, rows: N }` on success
- `GET /api/data` — returns `{ rows: [...] }` with the parsed rows
- `POST /api/reconcile/old` — upload old/messy data file
- `POST /api/reconcile/template` — upload clean template file
- `GET /api/reconcile/data` — fetch loaded old data rows
- `GET /api/reconcile/search?q=...` — search template rows by query (case-insensitive)
- `POST /api/reconcile/save` — save reconciliation matches, returns merged data (old + template columns with `template_` prefix)

Notes
- Data is kept in memory for the demo. For production, persist to a database or file.
- Reconciliation workflow:
  1. Upload old/messy product list
  2. Upload clean template
  3. For each old record, search and select the matching template row from a dropdown
  4. Download reconciled output as Excel file (contains all old columns + matched template columns)
