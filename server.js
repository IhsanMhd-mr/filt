const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// In-memory store for parsed data (simple for demo)
let dataStore = [];
let templateData = null; // Store template info
let oldDataStore = []; // Store old/messy data
let templateRows = []; // Store all template rows for searching

// Serve frontend static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// API: upload Excel file (field name: file)
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return res.status(400).json({ error: 'No sheets in workbook' });

    const sheet = workbook.Sheets[firstSheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Replace in-memory store
    dataStore = json;

    res.json({ ok: true, rows: dataStore.length });
  } catch (err) {
    console.error('Import error', err);
    res.status(500).json({ error: 'Failed to parse Excel file' });
  }
});

// API: return parsed data
app.get('/api/data', (req, res) => {
  res.json({ rows: dataStore });
});

// API: upload Excel template file
app.post('/api/template', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return res.status(400).json({ error: 'No sheets in workbook' });

    const sheet = workbook.Sheets[firstSheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Store template info
    templateData = {
      name: req.file.originalname,
      columns: Object.keys(json[0] || {}),
      rowCount: json.length
    };

    res.json({ ok: true, template: templateData });
  } catch (err) {
    console.error('Template import error', err);
    res.status(500).json({ error: 'Failed to parse template file' });
  }
});

// API: get template info
app.get('/api/template', (req, res) => {
  res.json({ template: templateData });
});

// RECONCILE ENDPOINTS

// API: upload old/messy data file
app.post('/api/reconcile/old', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return res.status(400).json({ error: 'No sheets in workbook' });

    const sheet = workbook.Sheets[firstSheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    oldDataStore = json.map((row, idx) => ({ 
      ...row, 
      _rowIndex: idx, 
      _matched: null,
      FK: null  // Add FK column for template PK
    }));

    res.json({ ok: true, rows: oldDataStore.length });
  } catch (err) {
    console.error('Old data import error', err);
    res.status(500).json({ error: 'Failed to parse old data file' });
  }
});

// API: upload template file for reconciliation
app.post('/api/reconcile/template', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return res.status(400).json({ error: 'No sheets in workbook' });

    const sheet = workbook.Sheets[firstSheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Add PK column if not present (use index as PK)
    templateRows = json.map((row, idx) => ({
      ...row,
      PK: row.PK !== undefined ? row.PK : idx + 1  // Use PK if exists, else use index
    }));

    res.json({ ok: true, rows: templateRows.length });
  } catch (err) {
    console.error('Template import error', err);
    res.status(500).json({ error: 'Failed to parse template file' });
  }
});

// API: get old data rows
app.get('/api/reconcile/data', (req, res) => {
  res.json({ rows: oldDataStore });
});

// API: get all template rows (with PK)
app.get('/api/reconcile/template-rows', (req, res) => {
  res.json({ rows: templateRows });
});

// API: search template rows by name (case-insensitive substring match)
app.get('/api/reconcile/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json({ results: templateRows });

  const results = templateRows.filter(row => {
    // Search all columns for the query string
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(query)
    );
  });

  res.json({ results });
});

// API: save reconciliation (old row index + matched template row index)
app.post('/api/reconcile/save', express.json(), (req, res) => {
  const { matches } = req.body; // Array of { oldIndex, templateIndex }
  
  if (!Array.isArray(matches)) {
    return res.status(400).json({ error: 'Invalid matches format' });
  }

  // Build reconciled output: old row + FK (template PK) + matched template row side-by-side
  const reconciled = oldDataStore.map((oldRow, idx) => {
    const match = matches.find(m => m.oldIndex === idx);
    const templateRow = match && match.templateIndex !== null ? templateRows[match.templateIndex] : null;

    // Merge: old row + FK column + template row with prefix to distinguish
    const merged = { ...oldRow };
    
    // Add FK (foreign key to template's PK)
    if (templateRow) {
      merged.FK = templateRow.PK;
    } else {
      merged.FK = null;
    }

    // Add template columns with prefix
    if (templateRow) {
      Object.entries(templateRow).forEach(([k, v]) => {
        if (k !== 'PK') { // Don't duplicate PK, it's in FK
          merged['template_' + k] = v;
        }
      });
    }
    
    delete merged._rowIndex;
    delete merged._matched;
    return merged;
  });

  res.json({ ok: true, data: reconciled });
});

// All other routes serve index.html so SPA routes work on refresh
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
