// Reconciliation Module - handles data reconciliation workflow with template matching

let oldRows = [];
let templateRows = [];
let selectedTableName = '';
let loadedTable = '';
let oldDataLoaded = false;
let templateLoaded = false;

export async function renderReconcile() {
  const appEl = document.getElementById('app');
  const escapeHtml = window.escapeHtml || ((str) => str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]));
  
  appEl.innerHTML = `
    <section>
      <h2>Reconcile Data</h2>
      <div id="reconcileArea">
        <h3>Step 1: Select Data Source</h3>
        <div style="margin-bottom:16px;padding:12px;background:#f0f7ff;border-radius:6px">
          <div style="margin-bottom:12px">
            <label><strong>Option A: Select Existing Table</strong></label>
            <select id="dataTableSelect" style="padding:8px;margin-right:8px;font-size:14px;display:block;margin-bottom:8px;width:300px">
              <option value="">-- Select table --</option>
            </select>
            <button id="loadTableBtn" class="btn primary">Load Table Data</button>
            <div id="loadTableMsg" style="margin-top:8px"></div>
          </div>
          <hr style="margin:12px 0;border:none;border-top:1px solid #ccc"/>
          <div>
            <label><strong>Option B: Upload New Old Data</strong></label>
            <form id="oldDataForm" style="display:flex;gap:8px;margin-top:8px">
              <input type="file" id="oldDataFile" accept=".xlsx,.xls" required />
              <button type="submit" class="btn primary">Upload Old Data</button>
            </form>
            <div id="oldMsg"></div>
            <button id="downloadOldJsonBtn" class="btn" style="display:none;margin-top:8px">Download Old Data (JSON)</button>
          </div>
        </div>

        <h3>Step 2: Upload Template</h3>
        <form id="reconcileTemplateForm">
          <input type="file" id="reconcileTemplateFile" accept=".xlsx,.xls" required />
          <button type="submit" class="btn primary">Upload Template</button>
        </form>
        <div id="templateMsg"></div>
        <button id="downloadTemplateJsonBtn" class="btn" style="display:none;margin-top:8px">Download Template (JSON)</button>

        <h3>Step 2b: Add Records Row by Row (Optional)</h3>
        <div style="padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin-bottom:16px">
          <p style="margin-top:0;color:#856404">Manually add records one at a time to the current table</p>
          <div id="rowByRowForm" style="display:none">
            <div id="rowInputFields" style="margin-bottom:12px"></div>
            <button type="button" id="addRowBtn" class="btn primary">Add Row</button>
            <div id="rowMsg" style="margin-top:8px"></div>
          </div>
          <div id="noTableMsg" style="color:#856404">Select or create a table first in Step 1 or 3</div>
        </div>

        <h3>Step 2c: Quick Excel Upload (No Reconciliation)</h3>
        <div style="padding:12px;background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;margin-bottom:16px">
          <p style="margin-top:0;color:#2e7d32">Upload Excel sheets directly to database as-is</p>
          <form id="quickUploadForm" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <input type="file" id="quickExcelFile" accept=".xlsx,.xls" required style="flex:1;min-width:250px"/>
            <input type="text" id="quickTableName" placeholder="Table name (auto from sheet)" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:200px"/>
            <button type="submit" class="btn" style="background:#4caf50;color:#fff">📤 Upload as Table</button>
          </form>
          <div id="quickUploadMsg"></div>
        </div>

        <div id="matchingArea" style="display:none">
          <h3>Step 3: Match Records</h3>
          <p>For each record, search and select a matching template row. FK updates live in the database.</p>
          
          <div id="reconcileSortControls" style="display:none;padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin-bottom:16px">
            <h4 style="margin-top:0">Sort Data</h4>
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
              <div>
                <label style="display:block;margin-bottom:6px"><strong>Sort By:</strong></label>
                <select id="reconcileSortColumn" style="padding:8px;border:1px solid #ddd;border-radius:4px;min-width:150px">
                  <option value="">-- Select column --</option>
                </select>
              </div>
              <div>
                <label style="display:block;margin-bottom:6px"><strong>Order:</strong></label>
                <select id="reconcileSortOrder" style="padding:8px;border:1px solid #ddd;border-radius:4px">
                  <option value="asc">Ascending (A → Z, 1 → 9)</option>
                  <option value="desc">Descending (Z → A, 9 → 1)</option>
                </select>
              </div>
              <button type="button" id="applySortReconcileBtn" class="btn primary">Apply Sort</button>
              <button type="button" id="resetSortReconcileBtn" class="btn">Reset</button>
            </div>
          </div>

          <div id="reconcileTableArea" style="display:none">
            <div id="tableContainer" style="overflow-x:auto"></div>
            
            <h4 style="margin-top:24px">Save to Database</h4>
            <div style="padding:12px;background:#f0fff4;border:1px solid #28a745;border-radius:6px;margin-bottom:16px">
              <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div>
                  <label><strong>Table Name:</strong></label>
                  <input type="text" id="dbTableName" placeholder="e.g., products" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:200px"/>
                </div>
                <button id="saveToDbBtn" class="btn" style="background:#28a745;color:#fff">💾 Save to Database</button>
                <div id="uploadMsg" style="margin-left:8px;font-weight:bold"></div>
              </div>
            </div>
            
            <h4 style="margin-top:24px">Column Management</h4>
            <div style="display:flex;gap:8px;margin-bottom:16px;align-items:flex-end;flex-wrap:wrap">
              <div>
                <label>Column Name:</label>
                <input type="text" id="newColumnName" placeholder="e.g., Status" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:150px"/>
              </div>
              <div>
                <label>Column Type:</label>
                <select id="newColumnType" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:120px">
                  <option value="TEXT">TEXT</option>
                  <option value="INTEGER">INTEGER</option>
                  <option value="DECIMAL">DECIMAL</option>
                  <option value="BOOLEAN">BOOLEAN</option>
                  <option value="DATE">DATE</option>
                  <option value="TIMESTAMP">TIMESTAMP</option>
                </select>
              </div>
              <button id="addColumnBtn" class="btn primary">Add Column</button>
              <div id="addColumnMsg" style="margin-left:8px"></div>
            </div>
            
            <div style="display:flex;gap:8px;margin-bottom:16px;align-items:flex-end">
              <div>
                <label>Remove Column:</label>
                <select id="removeColumnSelect" style="padding:8px;border:1px solid #ddd;border-radius:4px;width:150px">
                  <option value="">-- Select column to remove --</option>
                </select>
              </div>
              <button id="removeColumnBtn" class="btn" style="background:#dc3545;color:#fff">Remove Column</button>
              <div id="removeColumnMsg" style="margin-left:8px"></div>
            </div>
            
            <div class="controls">
              <button id="downloadBtn" class="btn">Download Reconciled Data</button>
              <div id="saveMsg"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Element references
  const dataTableSelect = document.getElementById('dataTableSelect');
  const loadTableBtn = document.getElementById('loadTableBtn');
  const loadTableMsg = document.getElementById('loadTableMsg');
  const oldDataForm = document.getElementById('oldDataForm');
  const oldMsg = document.getElementById('oldMsg');
  const downloadOldJsonBtn = document.getElementById('downloadOldJsonBtn');
  const reconcileTemplateForm = document.getElementById('reconcileTemplateForm');
  const templateMsg = document.getElementById('templateMsg');
  const downloadTemplateJsonBtn = document.getElementById('downloadTemplateJsonBtn');
  const quickUploadForm = document.getElementById('quickUploadForm');
  const quickExcelFile = document.getElementById('quickExcelFile');
  const quickTableName = document.getElementById('quickTableName');
  const quickUploadMsg = document.getElementById('quickUploadMsg');
  const rowByRowForm = document.getElementById('rowByRowForm');
  const rowInputFields = document.getElementById('rowInputFields');
  const addRowBtn = document.getElementById('addRowBtn');
  const rowMsg = document.getElementById('rowMsg');
  const noTableMsg = document.getElementById('noTableMsg');
  const matchingArea = document.getElementById('matchingArea');
  const reconcileSortControls = document.getElementById('reconcileSortControls');
  const reconcileSortColumn = document.getElementById('reconcileSortColumn');
  const reconcileSortOrder = document.getElementById('reconcileSortOrder');
  const applySortReconcileBtn = document.getElementById('applySortReconcileBtn');
  const resetSortReconcileBtn = document.getElementById('resetSortReconcileBtn');
  const reconcileTableArea = document.getElementById('reconcileTableArea');
  const tableContainer = document.getElementById('tableContainer');
  const dbTableName = document.getElementById('dbTableName');
  const saveToDbBtn = document.getElementById('saveToDbBtn');
  const uploadMsg = document.getElementById('uploadMsg');
  const downloadBtn = document.getElementById('downloadBtn');
  const saveMsg = document.getElementById('saveMsg');
  const newColumnName = document.getElementById('newColumnName');
  const newColumnType = document.getElementById('newColumnType');
  const addColumnBtn = document.getElementById('addColumnBtn');
  const addColumnMsg = document.getElementById('addColumnMsg');
  const removeColumnBtn = document.getElementById('removeColumnBtn');
  const removeColumnSelect = document.getElementById('removeColumnSelect');
  const removeColumnMsg = document.getElementById('removeColumnMsg');
  let originalOldRows = []; // For reset functionality

  // Load available tables
  async function loadAvailableTables() {
    try {
      const res = await fetch('/api/reconcile/tables');
      const { tables } = await res.json();
      dataTableSelect.innerHTML = '<option value="">-- Select table --</option>';
      if (tables && tables.length > 0) {
        tables.forEach(tbl => {
          const opt = document.createElement('option');
          opt.value = tbl;
          opt.textContent = tbl;
          dataTableSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error loading tables:', err);
    }
  }

  // Load selected table from database
  loadTableBtn.addEventListener('click', async () => {
    const tableName = dataTableSelect.value;
    if (!tableName) {
      loadTableMsg.textContent = 'Please select a table';
      loadTableMsg.style.color = 'red';
      return;
    }

    selectedTableName = tableName;
    loadTableMsg.textContent = 'Loading table data...';

    try {
      const res = await fetch(`/api/reconcile/table/${tableName}`);
      const data = await res.json();
      if (res.ok) {
        oldRows = data.rows;
        loadTableMsg.textContent = `Loaded ${oldRows.length} records from table "${tableName}"`;
        loadTableMsg.style.color = 'green';
        oldDataLoaded = true;
        
        // Show row-by-row form for loaded table
        showRowByRowForm(tableName);
        
        if (templateRows.length > 0) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'none';
          showReconcileTable(tableName);
        }
      } else {
        loadTableMsg.textContent = data.error || 'Failed to load table';
        loadTableMsg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      loadTableMsg.textContent = 'Error loading table';
      loadTableMsg.style.color = 'red';
    }
  });

  // Show row-by-row form when table is loaded
  function showRowByRowForm(tableName) {
    if (!oldRows.length) {
      noTableMsg.textContent = 'No table data available';
      rowByRowForm.style.display = 'none';
      return;
    }
    
    // Get column names from the first row
    const columns = Object.keys(oldRows[0]).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'created_at');
    
    // Generate input fields
    let fieldsHtml = '';
    columns.forEach(col => {
      fieldsHtml += `
        <div style="margin-bottom:8px">
          <label><strong>${escapeHtml(col)}:</strong></label>
          <input type="text" class="row-input" data-column="${col}" placeholder="Enter ${col}" style="padding:6px;border:1px solid #ddd;border-radius:4px;width:100%;box-sizing:border-box;margin-top:4px"/>
        </div>
      `;
    });
    
    rowInputFields.innerHTML = fieldsHtml;
    noTableMsg.style.display = 'none';
    rowByRowForm.style.display = 'block';
  }

  // Add row event listener
  addRowBtn.addEventListener('click', async () => {
    if (!selectedTableName && !loadedTable) {
      rowMsg.textContent = 'No table selected';
      rowMsg.style.color = 'red';
      return;
    }

    const tableName = loadedTable || selectedTableName;
    const inputs = document.querySelectorAll('.row-input');
    const rowData = {};
    let hasValue = false;

    // Collect input values
    inputs.forEach(input => {
      const col = input.dataset.column;
      const val = input.value.trim();
      rowData[col] = val;
      if (val) hasValue = true;
    });

    if (!hasValue) {
      rowMsg.textContent = 'Please fill in at least one field';
      rowMsg.style.color = 'orange';
      return;
    }

    rowMsg.textContent = 'Adding row...';
    rowMsg.style.color = '#666';

    try {
      const res = await fetch('/api/reconcile/add-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, rowData })
      });
      const result = await res.json();

      if (res.ok) {
        rowMsg.textContent = `✓ Row added successfully (ID: ${result.id})`;
        rowMsg.style.color = 'green';
        
        // Clear inputs
        inputs.forEach(input => input.value = '');
        
        // Add to oldRows
        oldRows.push(rowData);
        
        // Refresh table if displayed
        if (loadedTable === tableName) {
          showReconcileTable(tableName);
        }
      } else {
        rowMsg.textContent = `✗ Error: ${result.error}`;
        rowMsg.style.color = 'red';
      }
    } catch (err) {
      console.error('Add row error:', err);
      rowMsg.textContent = `✗ Error: ${err.message}`;
      rowMsg.style.color = 'red';
    }
  });

  // Upload old data handler
  oldDataForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const file = document.getElementById('oldDataFile').files[0];
    if (!file) return;

    oldMsg.textContent = 'Uploading...';
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/reconcile/old', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        oldMsg.textContent = `Loaded ${data.rows} old records.`;
        oldMsg.style.color = 'green';
        downloadOldJsonBtn.style.display = 'inline-block';
        oldDataLoaded = true;
        
        // Fetch the uploaded old data from server
        const oldDataRes = await fetch('/api/reconcile/data');
        const oldDataResponse = await oldDataRes.json();
        oldRows = oldDataResponse.rows;
        console.log('Fetched uploaded old rows:', oldRows.length);
        
        // Show the table with the uploaded data (before saving to database)
        selectedTableName = '';
        if (templateRows.length > 0 && oldRows.length > 0) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'block';
          showReconcileTableUpload();
        }
      } else {
        oldMsg.textContent = data.error || 'Upload failed';
        oldMsg.style.color = 'red';
        downloadOldJsonBtn.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      oldMsg.textContent = 'Upload error';
      oldMsg.style.color = 'red';
      downloadOldJsonBtn.style.display = 'none';
    }
  });

  // Upload template handler
  reconcileTemplateForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const file = document.getElementById('reconcileTemplateFile').files[0];
    if (!file) return;

    templateMsg.textContent = 'Uploading...';
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/reconcile/template', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        templateMsg.textContent = `Loaded ${data.rows} template rows.`;
        templateMsg.style.color = 'green';
        downloadTemplateJsonBtn.style.display = 'inline-block';
        
        const tmplRes = await fetch('/api/reconcile/template-rows');
        const { rows: fetchedTemplateRows } = await tmplRes.json();
        templateRows = fetchedTemplateRows;
        console.log('Fetched template rows:', templateRows.length);
        
        if (oldDataLoaded && selectedTableName) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'none';
          showReconcileTable(selectedTableName);
        }
      } else {
        templateMsg.textContent = data.error || 'Upload failed';
        templateMsg.style.color = 'red';
        downloadTemplateJsonBtn.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      templateMsg.textContent = 'Upload error';
      templateMsg.style.color = 'red';
      downloadTemplateJsonBtn.style.display = 'none';
    }
  });

  // Quick Excel upload - upload as-is without reconciliation
  quickUploadForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const file = quickExcelFile.files[0];
    if (!file) return;

    quickUploadMsg.textContent = 'Processing Excel file...';
    quickUploadMsg.style.color = '#666';

    try {
      // Parse Excel file using XLSX
      const arrayBuffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get sheet names
      const sheetNames = workbook.SheetNames;
      let tableName = quickTableName.value.trim();
      
      if (!tableName) {
        // Use first sheet name if no table name provided
        tableName = sheetNames[0];
      }

      if (!tableName) {
        quickUploadMsg.textContent = 'Please provide a table name';
        quickUploadMsg.style.color = 'red';
        return;
      }

      // Process first sheet
      const worksheet = workbook.Sheets[sheetNames[0]];
      const data = window.XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        quickUploadMsg.textContent = 'No data found in Excel file';
        quickUploadMsg.style.color = 'orange';
        return;
      }

      // Send to server
      const res = await fetch('/api/quick-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tableName, 
          data,
          sheetName: sheetNames[0]
        })
      });

      const result = await res.json();

      if (res.ok) {
        quickUploadMsg.textContent = `✓ Created table "${tableName}" with ${result.inserted} records from "${sheetNames[0]}"`;
        quickUploadMsg.style.color = 'green';
        
        // Reset form
        quickExcelFile.value = '';
        quickTableName.value = '';
        
        // Reload table list
        loadAvailableTables();
      } else {
        quickUploadMsg.textContent = `✗ Error: ${result.error}`;
        quickUploadMsg.style.color = 'red';
      }
    } catch (err) {
      console.error('Quick upload error:', err);
      quickUploadMsg.textContent = `✗ Error: ${err.message}`;
      quickUploadMsg.style.color = 'red';
    }
  });

  // Display reconcile table from uploaded data
  function showReconcileTableUpload() {
    matchingArea.style.display = 'block';
    reconcileTableArea.style.display = 'block';
    
    const oldColumns = oldRows.length > 0 ? Object.keys(oldRows[0]).filter(k => !k.startsWith('_')) : [];
    // Filter out only system columns, keep FK as a regular data column
    const filteredColumns = oldColumns.filter(k => k !== 'id' && k !== 'created_at');
    
    let tableHtml = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
    filteredColumns.forEach(col => {
      tableHtml += `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${escapeHtml(col)}</th>`;
    });
    tableHtml += '<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left;min-width:250px">Match</th>';
    tableHtml += '</tr></thead><tbody>';

    oldRows.forEach((row, idx) => {
      tableHtml += '<tr>';
      filteredColumns.forEach(col => {
        const val = String(row[col] ?? '');
        tableHtml += `<td style="padding:8px;border:1px solid #ddd">${escapeHtml(val)}</td>`;
      });
      tableHtml += `<td style="padding:8px;border:1px solid #ddd">
        <div class="match-cell" data-row-index="${idx}">
          <input type="text" class="match-search" placeholder="Search..." data-row-index="${idx}" style="width:100%;padding:4px;margin-bottom:4px"/>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="match-select" data-row-index="${idx}" style="flex:1;padding:4px">
              <option value="">-- No match --</option>
            </select>
            <span class="selected-pk" data-row-index="${idx}" style="min-width:60px;padding:4px;background:#f0f0f0;border-radius:3px;font-size:12px;white-space:nowrap;color:#666"></span>
          </div>
          <div class="match-results" data-row-index="${idx}" style="max-height:150px;overflow-y:auto;border:1px solid #ccc;background:#fff;margin-top:4px;display:none"></div>
        </div>
      </td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;

    // Setup search handlers
    setupSearchHandlers();
    setupEditHandlers();
    populateRemoveColumnSelect();
  }

  // Display reconcile table from database
  function showReconcileTable(tableName) {
    loadedTable = tableName;
    matchingArea.style.display = 'block';
    reconcileTableArea.style.display = 'block';
    
    // Save original data for reset
    originalOldRows = JSON.parse(JSON.stringify(oldRows));
    
    const oldColumns = oldRows.length > 0 ? Object.keys(oldRows[0]).filter(k => !k.startsWith('_')) : [];
    // Filter out only system columns, keep FK as a regular data column
    const filteredColumns = oldColumns.filter(k => k !== 'id' && k !== 'created_at');
    
    // Populate sort column dropdown
    reconcileSortColumn.innerHTML = '<option value="">-- Select column --</option>';
    filteredColumns.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      reconcileSortColumn.appendChild(opt);
    });
    reconcileSortControls.style.display = 'block';
    
    let tableHtml = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
    filteredColumns.forEach(col => {
      tableHtml += `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${escapeHtml(col)}</th>`;
    });
    tableHtml += '<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left;min-width:250px">Match</th>';
    tableHtml += '</tr></thead><tbody>';

    oldRows.forEach((row, idx) => {
      tableHtml += '<tr>';
      filteredColumns.forEach(col => {
        const val = String(row[col] ?? '');
        tableHtml += `<td style="padding:8px;border:1px solid #ddd;cursor:pointer;position:relative" class="editable-cell" data-row-index="${idx}" data-column="${col}" title="Click to edit">
          <span class="cell-value">${escapeHtml(val)}</span>
          <button class="edit-btn" style="display:none;position:absolute;right:4px;top:4px;padding:2px 6px;font-size:12px;background:#007bff;color:#fff;border:none;border-radius:3px;cursor:pointer">✎</button>
        </td>`;
      });
      tableHtml += `<td style="padding:8px;border:1px solid #ddd">
        <div class="match-cell" data-row-index="${idx}">
          <input type="text" class="match-search" placeholder="Search..." data-row-index="${idx}" style="width:100%;padding:4px;margin-bottom:4px"/>
          <div style="display:flex;gap:8px;align-items:center">
            <select class="match-select" data-row-index="${idx}" style="flex:1;padding:4px">
              <option value="">-- No match --</option>
            </select>
            <span class="selected-pk" data-row-index="${idx}" style="min-width:60px;padding:4px;background:#f0f0f0;border-radius:3px;font-size:12px;white-space:nowrap;color:#666"></span>
          </div>
          <div class="match-results" data-row-index="${idx}" style="max-height:150px;overflow-y:auto;border:1px solid #ccc;background:#fff;margin-top:4px;display:none"></div>
        </div>
      </td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;

    // Setup handlers
    setupSearchHandlers();
    setupEditHandlers();
    setupColumnHandlers();
    populateRemoveColumnSelect();
  }

  function setupSearchHandlers() {
    document.querySelectorAll('.match-search').forEach(input => {
      input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        const rowIdx = e.target.dataset.rowIndex;
        const resultsDiv = document.querySelector(`.match-results[data-row-index="${rowIdx}"]`);
        const select = document.querySelector(`.match-select[data-row-index="${rowIdx}"]`);

        if (!query) {
          resultsDiv.style.display = 'none';
          return;
        }

        try {
          const res = await fetch('/api/reconcile/search?q=' + encodeURIComponent(query));
          const { results } = await res.json();

          let html = '';
          results.forEach((tmplRow, tmplIdx) => {
            const pk = tmplRow.PK || '?';
            const display = Object.values(tmplRow).filter(v => v !== pk).slice(0, 2).join(' | ');
            html += `<div class="result-item" data-template-index="${tmplIdx}" data-pk="${pk}" style="padding:6px;border-bottom:1px solid #eee;cursor:pointer;background:#f9f9f9" onmouseover="this.style.background='#e8f4ff'" onmouseout="this.style.background='#f9f9f9'">
              [PK: ${escapeHtml(String(pk))}] ${escapeHtml(display)}
            </div>`;
          });

          resultsDiv.innerHTML = html || '<div style="padding:6px;color:#666">No results</div>';
          resultsDiv.style.display = 'block';

          resultsDiv.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', async () => {
              const tmplIdx = item.dataset.templateIndex;
              const pk = item.dataset.pk;
              
              // Update the select dropdown to show the selected template index
              select.value = tmplIdx;
              
              // Update the selected PK display
              const selectedPkSpan = document.querySelector(`.selected-pk[data-row-index="${rowIdx}"]`);
              if (selectedPkSpan) {
                selectedPkSpan.textContent = `FK: ${escapeHtml(String(pk))}`;
                selectedPkSpan.style.backgroundColor = '#d4edda';
                selectedPkSpan.style.color = '#155724';
              }
              
              // Update FK in oldRows if we're in loaded table mode
              if (loadedTable) {
                const tbl = loadedTable;
                const oldRowData = oldRows[rowIdx];
                
                try {
                  const updateRes = await fetch('/api/reconcile/update-fk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      rowIndex: rowIdx,
                      tableName: tbl,
                      pkValue: pk,
                      oldData: oldRowData
                    })
                  });
                  if (updateRes.ok) {
                    // Update FK value in the table if FK column exists
                    const fkCell = document.querySelector(`.editable-cell[data-row-index="${rowIdx}"][data-column="FK"]`);
                    if (fkCell) {
                      const cellValue = fkCell.querySelector('.cell-value');
                      if (cellValue) cellValue.textContent = pk;
                    }
                    oldRows[rowIdx].FK = pk;
                  }
                } catch (err) {
                  console.error('Update FK error:', err);
                }
              } else {
                // In upload mode, just update oldRows
                oldRows[rowIdx].FK = pk;
              }
              
              // Clear search
              e.target.value = '';
              resultsDiv.style.display = 'none';
            });
          });
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  function setupEditHandlers() {
    document.querySelectorAll('.editable-cell').forEach(cell => {
      const editBtn = cell.querySelector('.edit-btn');
      
      cell.addEventListener('mouseover', () => {
        if (editBtn) editBtn.style.display = 'block';
      });
      
      cell.addEventListener('mouseout', () => {
        if (editBtn) editBtn.style.display = 'none';
      });
      
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rowIdx = parseInt(cell.dataset.rowIndex);
          const column = cell.dataset.column;
          const currentValue = cell.querySelector('.cell-value').textContent;
          
          const input = document.createElement('input');
          input.type = 'text';
          input.value = currentValue;
          input.style.cssText = 'width:100%;padding:4px;border:2px solid #007bff;box-sizing:border-box';
          
          const saveBtn = document.createElement('button');
          saveBtn.textContent = 'Save';
          saveBtn.style.cssText = 'margin-left:4px;padding:4px 8px;background:#28a745;color:#fff;border:none;border-radius:3px;cursor:pointer';
          
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Cancel';
          cancelBtn.style.cssText = 'margin-left:4px;padding:4px 8px;background:#6c757d;color:#fff;border:none;border-radius:3px;cursor:pointer';
          
          const editorDiv = document.createElement('div');
          editorDiv.style.cssText = 'display:flex;align-items:center;gap:4px';
          editorDiv.appendChild(input);
          editorDiv.appendChild(saveBtn);
          editorDiv.appendChild(cancelBtn);
          
          const originalHtml = cell.innerHTML;
          cell.innerHTML = '';
          cell.appendChild(editorDiv);
          input.focus();
          
          const saveEdit = async () => {
            const newValue = input.value;
            if (newValue !== currentValue) {
              try {
                const oldRowData = oldRows[rowIdx];
                const res = await fetch('/api/reconcile/update-cell', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tableName: loadedTable,
                    rowIndex: rowIdx,
                    column,
                    newValue,
                    oldData: oldRowData
                  })
                });
                
                if (res.ok) {
                  oldRows[rowIdx][column] = newValue;
                  cell.innerHTML = originalHtml;
                  cell.querySelector('.cell-value').textContent = newValue;
                } else {
                  alert('Update failed');
                  cell.innerHTML = originalHtml;
                }
              } catch (err) {
                alert('Update error: ' + err.message);
                cell.innerHTML = originalHtml;
              }
            } else {
              cell.innerHTML = originalHtml;
            }
          };
          
          saveBtn.addEventListener('click', saveEdit);
          cancelBtn.addEventListener('click', () => { cell.innerHTML = originalHtml; });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { cell.innerHTML = originalHtml; }
          });
        });
      }
    });
  }

  // Save uploaded data to database
  saveToDbBtn.addEventListener('click', async () => {
    if (!oldRows.length) {
      uploadMsg.textContent = 'No data loaded to save';
      uploadMsg.style.color = 'red';
      return;
    }

    const tableName = dbTableName.value.trim();
    if (!tableName) {
      uploadMsg.textContent = 'Please enter a table name';
      uploadMsg.style.color = 'red';
      return;
    }

    uploadMsg.textContent = 'Creating table and inserting data...';
    uploadMsg.style.color = '#666';

    try {
      // Send the actual oldRows data with all columns including FK
      const res = await fetch('/api/reconcile/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, data: oldRows })
      });
      const data = await res.json();

      if (res.ok) {
        uploadMsg.textContent = `✓ Saved ${data.inserted}/${data.total} records to table "${tableName}"`;
        uploadMsg.style.color = 'green';
        selectedTableName = tableName;
        loadedTable = tableName;
        
        // Reload table to show it's now in the database
        setTimeout(() => {
          showReconcileTable(tableName);
        }, 1500);
      } else {
        uploadMsg.textContent = `✗ Error: ${data.error}`;
        uploadMsg.style.color = 'red';
      }
    } catch (err) {
      console.error('Save to DB error:', err);
      uploadMsg.textContent = `✗ Error: ${err.message}`;
      uploadMsg.style.color = 'red';
    }
  });

  function setupColumnHandlers() {
    addColumnBtn.addEventListener('click', async () => {
      const colName = newColumnName.value.trim();
      const colType = newColumnType.value;
      
      if (!colName) {
        addColumnMsg.textContent = 'Please enter column name';
        addColumnMsg.style.color = 'red';
        return;
      }

      if (!selectedTableName && !loadedTable) {
        addColumnMsg.textContent = 'No table selected';
        addColumnMsg.style.color = 'red';
        return;
      }

      addColumnMsg.textContent = 'Adding column...';
      addColumnMsg.style.color = '#666';

      try {
        const res = await fetch('/api/reconcile/add-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableName: selectedTableName || loadedTable,
            columnName: colName,
            columnType: colType
          })
        });
        const data = await res.json();
        if (res.ok) {
          addColumnMsg.textContent = `✓ Column "${colName}" added successfully`;
          addColumnMsg.style.color = 'green';
          newColumnName.value = '';
          newColumnType.value = 'TEXT';
          
          setTimeout(async () => {
            if (oldDataLoaded && (selectedTableName || loadedTable)) {
              try {
                const tableRes = await fetch(`/api/reconcile/table/${selectedTableName || loadedTable}`);
                const tableData = await tableRes.json();
                if (tableRes.ok) {
                  oldRows = tableData.rows;
                  showReconcileTable(selectedTableName || loadedTable);
                }
              } catch (err) {
                console.error('Error reloading table:', err);
              }
            }
          }, 1000);
        } else {
          addColumnMsg.textContent = data.error || 'Failed to add column';
          addColumnMsg.style.color = 'red';
        }
      } catch (err) {
        addColumnMsg.textContent = 'Error adding column';
        addColumnMsg.style.color = 'red';
      }
    });

    removeColumnBtn.addEventListener('click', async () => {
      const columnName = removeColumnSelect.value;
      if (!columnName) {
        removeColumnMsg.textContent = 'Please select a column to remove';
        removeColumnMsg.style.color = '#ff6b6b';
        return;
      }
      
      const confirmed = confirm(`Delete column "${columnName}"? This cannot be undone.`);
      if (!confirmed) return;
      
      try {
        removeColumnMsg.textContent = 'Removing column...';
        removeColumnMsg.style.color = '#666';
        
        const res = await fetch('/api/reconcile/remove-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableName: loadedTable,
            columnName
          })
        });
        
        if (res.ok) {
          removeColumnMsg.textContent = `Column "${columnName}" removed successfully!`;
          removeColumnMsg.style.color = 'green';
          removeColumnSelect.value = '';
          
          await showReconcileTable(loadedTable);
        } else {
          const data = await res.json();
          removeColumnMsg.textContent = 'Error: ' + (data.error || 'Failed to remove column');
          removeColumnMsg.style.color = 'red';
        }
      } catch (err) {
        removeColumnMsg.textContent = 'Error: ' + err.message;
        removeColumnMsg.style.color = 'red';
      }
    });
  }

  function populateRemoveColumnSelect() {
    if (oldRows.length === 0) {
      removeColumnSelect.innerHTML = '<option value="">-- No columns available --</option>';
      return;
    }
    
    const firstRow = oldRows[0];
    const columns = Object.keys(firstRow).filter(col => 
      col !== 'id' && col !== 'created_at' && col !== 'FK'
    );
    
    let html = '<option value="">-- Select column to remove --</option>';
    columns.forEach(col => {
      html += `<option value="${escapeHtml(col)}">${escapeHtml(col)}</option>`;
    });
    removeColumnSelect.innerHTML = html;
  }

  // Download handler
  downloadBtn.addEventListener('click', async () => {
    const matches = [];
    document.querySelectorAll('.match-select').forEach(sel => {
      const oldIdx = parseInt(sel.dataset.rowIndex);
      const tmplIdx = sel.value ? parseInt(sel.value) : null;
      matches.push({ oldIndex: oldIdx, templateIndex: tmplIdx });
    });

    saveMsg.textContent = 'Preparing...';
    saveMsg.style.color = '#666';

    try {
      const res = await fetch('/api/reconcile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches })
      });
      const data = await res.json();
      if (res.ok) {
        // Use window.XLSX (loaded from CDN)
        const XLSX = window.XLSX;
        if (!XLSX) throw new Error('XLSX library not loaded');
        
        const ws = XLSX.utils.json_to_sheet(data.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reconciled');
        XLSX.writeFile(wb, 'reconciled_data.xlsx');
        saveMsg.textContent = 'Reconciled data downloaded!';
        saveMsg.style.color = 'green';
      } else {
        saveMsg.textContent = data.error || 'Download failed';
        saveMsg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      saveMsg.textContent = 'Download error';
      saveMsg.style.color = 'red';
    }
  });

  // Reconcile table sorting
  applySortReconcileBtn.addEventListener('click', () => {
    const column = reconcileSortColumn.value;
    const order = reconcileSortOrder.value;

    if (!column) {
      uploadMsg.textContent = 'Please select a column to sort by';
      uploadMsg.style.color = 'orange';
      return;
    }

    // Create sorted copy of data
    const sorted = JSON.parse(JSON.stringify(oldRows));
    
    sorted.sort((a, b) => {
      let valA = String(a[column] ?? '').trim().toLowerCase();
      let valB = String(b[column] ?? '').trim().toLowerCase();

      // Try numeric comparison if both look like numbers
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return order === 'asc' ? numA - numB : numB - numA;
      }

      // String comparison
      if (order === 'asc') {
        return valA.localeCompare(valB);
      } else {
        return valB.localeCompare(valA);
      }
    });

    oldRows = sorted;
    showReconcileTable(loadedTable);
    uploadMsg.textContent = `✓ Sorted by "${column}" (${order === 'asc' ? 'Ascending' : 'Descending'})`;
    uploadMsg.style.color = 'green';
  });

  // Reset reconcile table sorting
  resetSortReconcileBtn.addEventListener('click', () => {
    oldRows = JSON.parse(JSON.stringify(originalOldRows));
    reconcileSortColumn.value = '';
    reconcileSortOrder.value = 'asc';
    showReconcileTable(loadedTable);
    uploadMsg.textContent = '✓ Sorting reset to original order';
    uploadMsg.style.color = 'green';
  });

  // JSON download handlers
  downloadOldJsonBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/reconcile/download-old-json');
      if (!res.ok) {
        alert('No old data loaded');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'old_data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Download failed');
    }
  });

  downloadTemplateJsonBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/reconcile/download-template-json');
      if (!res.ok) {
        alert('No template data loaded');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Download failed');
    }
  });

  // Initialize
  loadAvailableTables();
}
