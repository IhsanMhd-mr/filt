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

// Utility function to convert Excel serial date to proper date
// Excel dates are days since January 1, 1900
function parseExcelDate(excelSerialDate) {
  const serialNum = parseFloat(excelSerialDate);
  if (isNaN(serialNum) || serialNum < 0 || serialNum > 100000) return null;
  
  // Excel serial date epoch is January 1, 1900
  // Days since Dec 30, 1899 (Excel epoch)
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const daysOffset = serialNum - 1;
  
  const resultDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  
  // Validate year is reasonable
  if (resultDate.getFullYear() < 1900 || resultDate.getFullYear() > 2100) return null;
  
  // Format as YYYY-MM-DD HH:MM:SS
  const year = resultDate.getFullYear();
  const month = String(resultDate.getMonth() + 1).padStart(2, '0');
  const day = String(resultDate.getDate()).padStart(2, '0');
  const hours = String(resultDate.getHours()).padStart(2, '0');
  const minutes = String(resultDate.getMinutes()).padStart(2, '0');
  const seconds = String(resultDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Utility function to parse dates only in specific date columns
// Only parse if column name contains 'date', 'time', or matches special format
function parseDateFormat(dateStr, columnName = '') {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  
  dateStr = dateStr.trim();
  if (!dateStr) return dateStr;
  
  // Check if this is a known date column
  const isDateColumn = columnName.toLowerCase().includes('date') || 
                       columnName.toLowerCase().includes('time') ||
                       columnName.toLowerCase().includes('created') ||
                       columnName.toLowerCase().includes('updated');
  
  // Try special time format "HH:MM.S" first (always parse this)
  const timeMatch = dateStr.match(/^(\d{1,2}):(\d{2})\.(\d+)$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const secondsDecimal = timeMatch[3];
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const seconds = secondsDecimal.length === 1 
        ? parseInt(secondsDecimal) * 10 
        : parseInt(secondsDecimal);
      
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.min(seconds, 59)).padStart(2, '0')}`;
      return `${year}-${month}-${day} ${timeStr}`;
    }
  }
  
  // Only parse numbers as Excel dates if it's a known date column
  if (isDateColumn && /^\d+(\.\d+)?$/.test(dateStr)) {
    const parsed = parseExcelDate(dateStr);
    if (parsed) return parsed;
  }
  
  // Try parsing as JavaScript Date (only for known date columns)
  if (isDateColumn) {
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900 && dateObj.getFullYear() < 2100) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }
  
  // Return as-is if not a date
  return dateStr;
}

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
    
    // Get all headers from first row (A1, B1, C1, etc.)
    const headers = [];
    let col = 0;
    while (true) {
      const cellRef = xlsx.utils.encode_col(col) + '1';
      const cell = sheet[cellRef];
      if (!cell) break;
      headers.push(cell.v || '');
      col++;
    }
    
    // Convert to JSON with all headers preserved
    const json = xlsx.utils.sheet_to_json(sheet, { 
      defval: '',
      header: headers.length > 0 ? headers : undefined
    });

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
    
    // Get all headers from first row (A1, B1, C1, etc.)
    const headers = [];
    let col = 0;
    while (true) {
      const cellRef = xlsx.utils.encode_col(col) + '1';
      const cell = sheet[cellRef];
      if (!cell) break;
      headers.push(cell.v || '');
      col++;
    }
    
    // Convert to JSON with all headers preserved
    const json = xlsx.utils.sheet_to_json(sheet, { 
      defval: '',
      header: headers.length > 0 ? headers : undefined
    });

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
  const { tableName, data } = req.body;

  // Use provided data or fall back to oldDataStore
  const dataToInsert = data && data.length > 0 ? data : oldDataStore;

  if (!tableName || !dataToInsert.length) {
    return res.status(400).json({ error: 'Invalid table name or no data' });
  }

  try {
    // Get column names from first row, exclude system columns
    const columns = Object.keys(dataToInsert[0]).filter(k => 
      !k.startsWith('_') && k !== 'created_at' && k !== 'id'
    );
    
    // Create table if it doesn't exist with TEXT columns for all data
    // NOTE: FK column is treated as a regular data column if present
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableQuery);
    
    // Insert all data rows
    const columnsStr = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    let insertedCount = 0;
    for (const row of dataToInsert) {
      const values = columns.map(col => {
        const val = row[col] ?? null;
        // Parse special date format in any column
        return parseDateFormat(val, col);
      });
      const query = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders}) RETURNING *`;
      
      try {
        const result = await db.query(query, values);
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row:`, err.message);
      }
    }

    res.json({ ok: true, inserted: insertedCount, total: dataToInsert.length });
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

// API: Add a single row to the table
app.post('/api/reconcile/add-row', express.json(), async (req, res) => {
  const { tableName, rowData } = req.body;

  if (!tableName || !rowData) {
    return res.status(400).json({ error: 'Missing tableName or rowData' });
  }

  try {
    // Get column names from rowData
    const columns = Object.keys(rowData).filter(k => k && !k.startsWith('_'));
    
    if (columns.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Build query
    const columnsStr = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map(col => rowData[col] ?? null);

    const query = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders}) RETURNING id`;
    const result = await db.query(query, values);
    
    res.json({ ok: true, id: result.rows[0].id, message: 'Row added successfully' });
  } catch (err) {
    console.error('Error adding row:', err);
    res.status(500).json({ error: 'Failed to add row: ' + err.message });
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

// API: Drop a specific table from the database
app.post('/api/drop-table', express.json(), async (req, res) => {
  const { tableName } = req.body;

  if (!tableName) {
    return res.status(400).json({ error: 'Table name is required' });
  }

  // Validate table name to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    // Drop the table
    await db.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
    console.log(`Dropped table: ${tableName}`);
    
    res.json({ 
      ok: true, 
      message: `Table "${tableName}" has been dropped successfully`
    });
  } catch (err) {
    console.error('Error dropping table:', err);
    res.status(500).json({ error: 'Failed to drop table: ' + err.message });
  }
});

// API: Reset database - drop all tables and clear in-memory stores
app.post('/api/reset-db', express.json(), async (req, res) => {
  try {
    // Get all table names from information_schema
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tables = result.rows.map(row => row.table_name);
    
    if (tables.length > 0) {
      // Drop all tables
      for (const tableName of tables) {
        await db.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        console.log(`Dropped table: ${tableName}`);
      }
    }

    // Clear in-memory stores
    dataStore = [];
    templateData = null;
    oldDataStore = [];
    templateRows = [];

    console.log('Database reset complete - all tables dropped and in-memory stores cleared');
    res.json({ 
      ok: true, 
      message: `Reset complete: dropped ${tables.length} table(s)`,
      droppedTables: tables
    });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: 'Failed to reset database: ' + err.message });
  }
});

// API: Quick upload - upload Excel sheet directly to database without reconciliation
app.post('/api/quick-upload', express.json(), async (req, res) => {
  const { tableName, data, sheetName } = req.body;

  if (!tableName || !data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Invalid table name or data' });
  }

  try {
    // Get column names from first row
    const columns = Object.keys(data[0]).filter(k => k && !k.startsWith('_'));
    
    if (columns.length === 0) {
      return res.status(400).json({ error: 'No columns found in data' });
    }

    // Create table if it doesn't exist with TEXT columns
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableQuery);
    
    // Insert all rows
    const columnsStr = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    let insertedCount = 0;
    for (const row of data) {
      const values = columns.map(col => {
        const val = String(row[col] ?? '').trim() || null;
        // Parse special date format in any column
        return parseDateFormat(val, col);
      });
      const query = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders})`;
      
      try {
        await db.query(query, values);
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row:`, err.message);
      }
    }

    res.json({ 
      ok: true, 
      inserted: insertedCount, 
      total: data.length,
      tableName,
      sheetName,
      message: `Successfully created table "${tableName}" with ${insertedCount} records`
    });
  } catch (err) {
    console.error('Quick upload error:', err);
    res.status(500).json({ error: 'Failed to upload data: ' + err.message });
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
