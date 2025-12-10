const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
// Increase JSON payload limit to handle large datasets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  if (oldDataStore.length === 0) {
    return res.status(400).json({ error: 'No old data available' });
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

    // Add template columns with prefix to avoid conflicts
    if (templateRow) {
      Object.entries(templateRow).forEach(([k, v]) => {
        if (k !== 'PK') { // Don't duplicate PK, it's in FK
          merged['template_' + k] = v;
        }
      });
    }
    
    // Clean up internal fields
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
    console.log('Available tables:', tables);
    res.json({ tables });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// API: fetch data from a specific table
app.get('/api/reconcile/table/:tableName', async (req, res) => {
  const { tableName } = req.params;
  
  if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    const query = `SELECT * FROM "${tableName}" ORDER BY id`;
    const result = await db.query(query);
    res.json({ ok: true, rows: result.rows });
  } catch (err) {
    console.error(`Error fetching table ${tableName}:`, err);
    res.status(500).json({ error: 'Failed to fetch table data' });
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
    
    // Create table if it doesn't exist with TEXT columns for all data + FK column for reconciliation
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        "FK" INTEGER,
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
    // Use id column if available for exact row matching
    const oldId = oldData.id;
    
    if (oldId) {
      // Match by id column for exact row lookup
      const updateQuery = `UPDATE "${tableName}" SET "FK" = $1 WHERE id = $2 RETURNING *`;
      console.log('Update FK by id:', { id: oldId, pkValue, tableName });
      
      const result = await db.query(updateQuery, [pkValue, oldId]);
      
      if (result.rowCount > 0) {
        res.json({ ok: true, updated: result.rowCount, row: result.rows[0] });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    } else {
      // Fall back to matching by data columns
      const oldColumns = Object.keys(oldData)
        .filter(k => !k.startsWith('_') && k !== 'id' && k !== 'created_at' && k !== 'FK');
      
      console.log('Update FK - oldData keys:', Object.keys(oldData));
      console.log('Update FK - filtered columns:', oldColumns);
      
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
      const updateQuery = `UPDATE "${tableName}" SET "FK" = $${whereValues.length} WHERE ${whereClause} RETURNING *`;

      console.log('Update query:', updateQuery);
      console.log('Update values:', whereValues);

      const result = await db.query(updateQuery, whereValues);

      console.log('Update result:', result.rowCount);
      if (result.rowCount > 0) {
        res.json({ ok: true, updated: result.rowCount, row: result.rows[0] });
      } else {
        res.status(404).json({ error: 'Record not found' });
      }
    }
  } catch (err) {
    console.error('Update FK error:', err);
    res.status(500).json({ error: 'Failed to update FK: ' + err.message });
  }
});

// API: add new column to table
app.post('/api/reconcile/add-column', express.json(), async (req, res) => {
  const { tableName, columnName, columnType } = req.body;

  if (!tableName || !columnName || !columnType) {
    return res.status(400).json({ error: 'Missing table name, column name, or type' });
  }

  // Validate column name and type
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
    return res.status(400).json({ error: 'Invalid column name' });
  }

  if (!/^[A-Z]+$/.test(tableName)) {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
  }

  try {
    const validTypes = ['TEXT', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP'];
    if (!validTypes.includes(columnType)) {
      return res.status(400).json({ error: 'Invalid column type' });
    }

    const alterQuery = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;
    console.log('Adding column:', { tableName, columnName, columnType, query: alterQuery });
    
    await db.query(alterQuery);
    res.json({ ok: true, message: `Column "${columnName}" added successfully` });
  } catch (err) {
    console.error('Error adding column:', err);
    res.status(500).json({ error: 'Failed to add column: ' + err.message });
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

// API: update a cell value in the table
app.post('/api/reconcile/update-cell', express.json(), async (req, res) => {
  const { tableName, rowIndex, column, newValue, oldData } = req.body;

  if (!tableName || typeof rowIndex !== 'number' || !column || newValue === undefined) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(column)) {
    return res.status(400).json({ error: 'Invalid table or column name' });
  }

  try {
    // Build WHERE clause to find the row
    let whereClause = '';
    let queryParams = [newValue];
    let paramCount = 2;

    if (oldData && typeof oldData === 'object') {
      const conditions = [];
      Object.entries(oldData).forEach(([key, val]) => {
        if (key !== 'id' && key !== 'created_at' && key !== 'FK') {
          conditions.push(`"${key}" = $${paramCount}`);
          queryParams.push(val);
          paramCount++;
        }
      });
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }

    let updateQuery = `UPDATE "${tableName}" SET "${column}" = $1 ${whereClause}`;
    console.log('Update cell query:', updateQuery, 'params:', queryParams);

    const result = await db.query(updateQuery, queryParams);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Row not found' });
    }

    res.json({ ok: true, message: 'Cell updated successfully', rowsAffected: result.rowCount });
  } catch (err) {
    console.error('Error updating cell:', err);
    res.status(500).json({ error: 'Failed to update cell: ' + err.message });
  }
});

// API: remove a column from the table
app.post('/api/reconcile/remove-column', express.json(), async (req, res) => {
  const { tableName, columnName } = req.body;

  if (!tableName || !columnName) {
    return res.status(400).json({ error: 'Missing tableName or columnName' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(columnName)) {
    return res.status(400).json({ error: 'Invalid table or column name' });
  }

  // Prevent removing system columns
  if (['id', 'created_at', 'FK'].includes(columnName)) {
    return res.status(400).json({ error: 'Cannot remove system columns' });
  }

  try {
    const dropQuery = `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`;
    console.log('Dropping column:', { tableName, columnName, query: dropQuery });
    
    await db.query(dropQuery);
    res.json({ ok: true, message: `Column "${columnName}" removed successfully` });
  } catch (err) {
    console.error('Error removing column:', err);
    res.status(500).json({ error: 'Failed to remove column: ' + err.message });
  }
});

// All other routes serve index.html so SPA routes work on refresh
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
