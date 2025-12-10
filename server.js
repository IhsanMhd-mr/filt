const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const cors = require('cors');
const db = require('./db');

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

// API: save reconciled data to PostgreSQL database
app.post('/api/reconcile/save-db', express.json(), async (req, res) => {
  const { data, tableName } = req.body;

  if (!Array.isArray(data) || !tableName) {
    return res.status(400).json({ error: 'Invalid data or table name' });
  }

  if (data.length === 0) {
    return res.status(400).json({ error: 'No data to insert' });
  }

  try {
    // Get column names from first row
    const columns = Object.keys(data[0]);
    const columnsStr = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    // Insert all rows
    let insertedCount = 0;
    for (const row of data) {
      const values = columns.map(col => row[col] ?? null);
      const query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${placeholders})`;
      
      try {
        await db.query(query, values);
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row:`, err.message);
        // Continue with next row
      }
    }

    res.json({ ok: true, inserted: insertedCount, total: data.length });
  } catch (err) {
    console.error('Database save error:', err);
    res.status(500).json({ error: 'Failed to save to database: ' + err.message });
  }
});

// API: get list of tables in database
app.get('/api/reconcile/tables', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = result.rows.map(r => r.table_name);
    res.json({ tables });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// API: upload old data to database (initial insert)
app.post('/api/reconcile/init-db', express.json(), async (req, res) => {
  const { tableName } = req.body;

  if (!tableName || !oldDataStore.length) {
    return res.status(400).json({ error: 'Invalid table name or no data' });
  }

  try {
    // Get column names from first row
    const columns = Object.keys(oldDataStore[0]).filter(k => !k.startsWith('_'));
    
    // Create table if it doesn't exist with TEXT columns for all data
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableQuery);
    
    // Insert all old data rows
    const columnsStr = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    let insertedCount = 0;
    for (const row of oldDataStore) {
      const values = columns.map(col => row[col] ?? null);
      const query = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders}) RETURNING *`;
      
      try {
        const result = await db.query(query, values);
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row:`, err.message);
      }
    }

    res.json({ ok: true, inserted: insertedCount, total: oldDataStore.length });
  } catch (err) {
    console.error('Database init error:', err);
    res.status(500).json({ error: 'Failed to upload to database: ' + err.message });
  }
});

// API: update single record's FK (match made)
app.post('/api/reconcile/update-fk', express.json(), async (req, res) => {
  const { rowIndex, tableName, pkValue, oldData } = req.body;

  if (!tableName || pkValue === undefined) {
    return res.status(400).json({ error: 'Invalid table name or PK value' });
  }

  try {
    // Find the record by matching old data columns and update FK
    // Assuming old data columns + FK column exist in the table
    const oldColumns = Object.keys(oldData).filter(k => !k.startsWith('_'));
    
    // Build WHERE clause to match the original row with quoted column names
    let whereClause = '';
    let whereValues = [];
    oldColumns.forEach((col, idx) => {
      if (idx > 0) whereClause += ' AND ';
      whereClause += `"${col}" = $${idx + 1}`;
      whereValues.push(oldData[col]);
    });

    // Add FK value
    whereValues.push(pkValue);
    const updateQuery = `UPDATE "${tableName}" SET FK = $${whereValues.length} WHERE ${whereClause} RETURNING *`;

    const result = await db.query(updateQuery, whereValues);

    if (result.rowCount > 0) {
      res.json({ ok: true, updated: result.rowCount, row: result.rows[0] });
    } else {
      res.status(404).json({ error: 'Record not found' });
    }
  } catch (err) {
    console.error('Update FK error:', err);
    res.status(500).json({ error: 'Failed to update FK: ' + err.message });
  }
});

// API: download old/messy data as JSON
app.get('/api/reconcile/download-old-json', (req, res) => {
  if (!oldDataStore.length) {
    return res.status(400).json({ error: 'No old data loaded' });
  }
  
  const cleanData = oldDataStore.map(row => {
    const cleaned = { ...row };
    delete cleaned._rowIndex;
    delete cleaned._matched;
    return cleaned;
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=old_data.json');
  res.json(cleanData);
});

// API: download template data as JSON
app.get('/api/reconcile/download-template-json', (req, res) => {
  if (!templateRows.length) {
    return res.status(400).json({ error: 'No template data loaded' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=template_data.json');
  res.json(templateRows);
});

// All other routes serve index.html so SPA routes work on refresh
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
