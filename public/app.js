// Simple hash-based SPA router and page implementations
const appEl = document.getElementById('app');

function navTo(hash) {
  location.hash = hash;
}

document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => navTo(btn.dataset.href.slice(1)));
});

function renderHome() {
  appEl.innerHTML = `
    <section>
      <h2>Welcome</h2>
      <p>Upload a template, import data, reconcile messy product lists with clean data, or view as a table.</p>
      <div class="controls">
        <a class="btn" href="#template">Upload Template</a>
        <a class="btn" href="#import">Import Excel</a>
        <a class="btn primary" href="#reconcile">Reconcile Data</a>
        <a class="btn" href="#table">View Table</a>
      </div>
    </section>
  `;
}

function renderImport() {
  appEl.innerHTML = `
    <section>
      <h2>Import Excel</h2>
      <form id="uploadForm">
        <label>Choose an Excel file (.xlsx, .xls)</label>
        <input type="file" name="file" id="fileInput" accept=".xlsx,.xls" required />
        <div class="controls">
          <button type="submit" class="btn primary">Upload</button>
          <a class="btn" href="#template">View Template</a>
          <a class="btn" href="#table">View Table</a>
        </div>
      </form>
      <div id="msg"></div>
    </section>
  `;

  const form = document.getElementById('uploadForm');
  const msg = document.getElementById('msg');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fileEl = document.getElementById('fileInput');
    if (!fileEl.files || !fileEl.files[0]) return;

    msg.textContent = 'Uploading...';

    const fd = new FormData();
    fd.append('file', fileEl.files[0]);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        msg.textContent = `Imported ${data.rows} rows.`;
        // navigate to table view automatically
        location.hash = 'table';
      } else {
        msg.textContent = data.error || 'Upload failed';
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Upload error';
    }
  });
}

function buildTable(rows) {
  if (!rows || rows.length === 0) return '<p>No data available. Import an Excel file first.</p>';

  // Collect headers from keys of first row
  const headers = Object.keys(rows[0]);

  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const h of headers) html += `<th>${escapeHtml(h)}</th>`;
  html += '</tr></thead><tbody>';

  for (const r of rows) {
    html += '<tr>';
    for (const h of headers) html += `<td>${escapeHtml(String(r[h] ?? ''))}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}

async function renderTemplate() {
  appEl.innerHTML = '<section><h2>Upload Template</h2><div id="templateArea"><form id="templateForm"><label>Choose a template Excel file (.xlsx, .xls)</label><input type="file" name="file" id="templateInput" accept=".xlsx,.xls" required /><div class="controls"><button type="submit" class="btn primary">Upload Template</button><a class="btn" href="#import">Go to Import</a></div></form><div id="templateMsg"></div></div></section>';
  const templateArea = document.getElementById('templateArea');
  const templateMsg = document.getElementById('templateMsg');
  const templateForm = document.getElementById('templateForm');

  // Load current template info if available
  try {
    const res = await fetch('/api/template');
    const data = await res.json();
    if (data.template) {
      const tmpl = data.template;
      templateMsg.innerHTML = `<h4>Current Template</h4><p><strong>${escapeHtml(tmpl.name)}</strong></p><p>Columns: ${tmpl.columns.map(c => escapeHtml(c)).join(', ')}</p><p>Sample rows: ${tmpl.rowCount}</p>`;
    }
  } catch (err) {
    console.error(err);
  }

  templateForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fileEl = document.getElementById('templateInput');
    if (!fileEl.files || !fileEl.files[0]) return;

    templateMsg.textContent = 'Uploading template...';

    const fd = new FormData();
    fd.append('file', fileEl.files[0]);

    try {
      const res = await fetch('/api/template', { method: 'POST', body: fd });
      const respData = await res.json();
      if (res.ok) {
        const tmpl = respData.template;
        templateMsg.innerHTML = `<h4>Template uploaded!</h4><p><strong>${escapeHtml(tmpl.name)}</strong></p><p>Columns: ${tmpl.columns.map(c => escapeHtml(c)).join(', ')}</p><p>Sample rows: ${tmpl.rowCount}</p>`;
      } else {
        templateMsg.textContent = respData.error || 'Upload failed';
      }
    } catch (err) {
      console.error(err);
      templateMsg.textContent = 'Upload error';
    }
  });
}

async function renderTable() {
  appEl.innerHTML = `
    <section>
      <h2>Table View & Export</h2>
      <div style="padding:12px;background:#f0f7ff;border-radius:6px;margin-bottom:16px">
        <h3>Select Database Table</h3>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label style="display:block;margin-bottom:6px"><strong>Available Tables:</strong></label>
            <select id="exportTableSelect" style="padding:8px;font-size:14px;min-width:250px">
              <option value="">-- Select a table --</option>
            </select>
          </div>
          <button id="loadExportTableBtn" class="btn primary">Load Table</button>
          <button id="exportTableBtn" class="btn" style="background:#28a745;color:#fff;display:none">📥 Export to Excel</button>
        </div>
        <div id="exportMsg" style="margin-top:8px;font-weight:bold"></div>
      </div>
      <div id="tableArea">Select a table to view and export its contents</div>
    </section>
  `;
  
  const tableArea = document.getElementById('tableArea');
  const exportTableSelect = document.getElementById('exportTableSelect');
  const loadExportTableBtn = document.getElementById('loadExportTableBtn');
  const exportTableBtn = document.getElementById('exportTableBtn');
  const exportMsg = document.getElementById('exportMsg');
  let currentTableData = [];
  let currentTableName = '';

  // Load available tables
  async function loadAvailableTables() {
    try {
      const res = await fetch('/api/reconcile/tables');
      const { tables } = await res.json();
      exportTableSelect.innerHTML = '<option value="">-- Select a table --</option>';
      if (tables && tables.length > 0) {
        tables.forEach(tbl => {
          const opt = document.createElement('option');
          opt.value = tbl;
          opt.textContent = tbl;
          exportTableSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error loading tables:', err);
      exportMsg.textContent = 'Error loading tables';
      exportMsg.style.color = 'red';
    }
  }

  // Load selected table data
  loadExportTableBtn.addEventListener('click', async () => {
    const tableName = exportTableSelect.value;
    if (!tableName) {
      exportMsg.textContent = 'Please select a table';
      exportMsg.style.color = 'red';
      return;
    }

    exportMsg.textContent = 'Loading table...';
    exportMsg.style.color = '#666';

    try {
      const res = await fetch(`/api/reconcile/table/${tableName}`);
      const data = await res.json();
      
      if (res.ok) {
        currentTableData = data.rows || [];
        currentTableName = tableName;
        exportTableBtn.style.display = 'inline-block';
        tableArea.innerHTML = buildTable(currentTableData);
        exportMsg.textContent = `✓ Loaded ${currentTableData.length} rows from "${tableName}"`;
        exportMsg.style.color = 'green';
      } else {
        exportMsg.textContent = data.error || 'Failed to load table';
        exportMsg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      exportMsg.textContent = 'Error loading table';
      exportMsg.style.color = 'red';
    }
  });

  // Export table to Excel
  exportTableBtn.addEventListener('click', async () => {
    if (!currentTableData.length || !currentTableName) {
      exportMsg.textContent = 'No table loaded';
      exportMsg.style.color = 'red';
      return;
    }

    exportMsg.textContent = 'Preparing export...';
    exportMsg.style.color = '#666';

    try {
      // Create Excel file from table data
      const ws = xlsx.utils.json_to_sheet(currentTableData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, currentTableName.substring(0, 31)); // Sheet name max 31 chars
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${currentTableName}_${timestamp}.xlsx`;
      
      // Download the file
      xlsx.writeFile(wb, filename);
      exportMsg.textContent = `✓ Exported "${filename}" successfully!`;
      exportMsg.style.color = 'green';
    } catch (err) {
      console.error('Export error:', err);
      exportMsg.textContent = 'Export failed: ' + err.message;
      exportMsg.style.color = 'red';
    }
  });

  // Load tables on page load
  loadAvailableTables();
}

async function renderReconcile() {
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

        <div id="matchingArea" style="display:none">
          <h3>Step 3: Match Records</h3>
          <p>For each record, search and select a matching template row. FK updates live in the database.</p>
          <div id="reconcileTableArea" style="display:none">
            <div id="tableContainer" style="overflow-x:auto"></div>
            
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

  const dataTableSelect = document.getElementById('dataTableSelect');
  const loadTableBtn = document.getElementById('loadTableBtn');
  const loadTableMsg = document.getElementById('loadTableMsg');
  const oldDataForm = document.getElementById('oldDataForm');
  const oldMsg = document.getElementById('oldMsg');
  const downloadOldJsonBtn = document.getElementById('downloadOldJsonBtn');
  const reconcileTemplateForm = document.getElementById('reconcileTemplateForm');
  const matchingArea = document.getElementById('matchingArea');
  const templateMsg = document.getElementById('templateMsg');
  const downloadTemplateJsonBtn = document.getElementById('downloadTemplateJsonBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const reconcileTableArea = document.getElementById('reconcileTableArea');
  const saveMsg = document.getElementById('saveMsg');
  const tableContainer = document.getElementById('tableContainer');
  const addColumnBtn = document.getElementById('addColumnBtn');
  const newColumnName = document.getElementById('newColumnName');
  const newColumnType = document.getElementById('newColumnType');
  const addColumnMsg = document.getElementById('addColumnMsg');
  const removeColumnBtn = document.getElementById('removeColumnBtn');
  const removeColumnSelect = document.getElementById('removeColumnSelect');
  const removeColumnMsg = document.getElementById('removeColumnMsg');
  let templateLoaded = false;
  let oldDataLoaded = false;
  let oldRows = [];
  let templateRows = [];
  let selectedTableName = '';
  let loadedTable = ''; // Track the currently loaded table for editing and column removal

  // Fetch available tables on load
  async function loadAvailableTables() {
    try {
      console.log('Fetching tables...');
      const res = await fetch('/api/reconcile/tables');
      const data = await res.json();
      console.log('Tables response:', data);
      const { tables } = data;
      dataTableSelect.innerHTML = '<option value="">-- Select table --</option>';
      if (tables && tables.length > 0) {
        tables.forEach(tbl => {
          const opt = document.createElement('option');
          opt.value = tbl;
          opt.textContent = tbl;
          dataTableSelect.appendChild(opt);
        });
        console.log('Loaded tables:', tables);
      } else {
        console.log('No tables found');
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  }

  // Load selected table data from database
  loadTableBtn.addEventListener('click', async () => {
    const tableName = dataTableSelect.value;
    if (!tableName) {
      loadTableMsg.textContent = 'Please select a table';
      return;
    }

    selectedTableName = tableName;
    loadTableMsg.textContent = 'Loading table data...';

    try {
      // Fetch table data from database
      const res = await fetch(`/api/reconcile/table/${tableName}`);
      const data = await res.json();
      if (res.ok) {
        oldRows = data.rows;
        loadTableMsg.textContent = `Loaded ${oldRows.length} records from table "${tableName}"`;
        oldDataLoaded = true;
        if (templateRows.length > 0) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'none';
          showReconcileTable(tableName);
        }
      } else {
        loadTableMsg.textContent = data.error || 'Failed to load table';
      }
    } catch (err) {
      console.error(err);
      loadTableMsg.textContent = 'Error loading table';
    }
  });

  // Load tables on render
  loadAvailableTables();

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
        downloadOldJsonBtn.style.display = 'inline-block';
        oldDataLoaded = true;
        
        // Fetch the uploaded old data from server
        const oldDataRes = await fetch('/api/reconcile/data');
        const oldDataResponse = await oldDataRes.json();
        oldRows = oldDataResponse.rows;
        console.log('Fetched uploaded old rows:', oldRows.length);
        
        // Show the table with the uploaded data (before saving to database)
        selectedTableName = ''; // No database table yet
        if (templateRows.length > 0 && oldRows.length > 0) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'block';
          showReconcileTableUpload();  // Show table from memory, not database
        }
      } else {
        oldMsg.textContent = data.error || 'Upload failed';
        downloadOldJsonBtn.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      oldMsg.textContent = 'Upload error';
      downloadOldJsonBtn.style.display = 'none';
    }
  });

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
        downloadTemplateJsonBtn.style.display = 'inline-block';
        
        // Fetch template rows
        const tmplRes = await fetch('/api/reconcile/template-rows');
        const { rows: fetchedTemplateRows } = await tmplRes.json();
        templateRows = fetchedTemplateRows;
        console.log('Fetched template rows:', templateRows.length);
        
        // If a table is already loaded, show reconcile UI
        if (oldDataLoaded && selectedTableName) {
          matchingArea.style.display = 'block';
          reconcileTableArea.style.display = 'none';
          showReconcileTable(selectedTableName);
        }
      } else {
        templateMsg.textContent = data.error || 'Upload failed';
        downloadTemplateJsonBtn.style.display = 'none';
      }
    } catch (err) {
      console.error(err);
      templateMsg.textContent = 'Upload error';
      downloadTemplateJsonBtn.style.display = 'none';
    }
  });

  async function showTableUI() {
    matchingArea.style.display = 'block';
    
    // Fetch old rows and template rows
    const oldRes = await fetch('/api/reconcile/data');
    const { rows: fetchedOldRows } = await oldRes.json();
    oldRows = fetchedOldRows;
    console.log('Fetched old rows:', oldRows.length);

    // Fetch template rows with PK
    const tmplRes = await fetch('/api/reconcile/template-rows');
    const { rows: fetchedTemplateRows } = await tmplRes.json();
    templateRows = fetchedTemplateRows;
    console.log('Fetched template rows:', templateRows.length);

    // Fetch available tables
    try {
      const tablesRes = await fetch('/api/reconcile/tables');
      const { tables } = await tablesRes.json();
      dbTableSelect.innerHTML = '<option value="">-- Select table --</option>';
      tables.forEach(tbl => {
        const opt = document.createElement('option');
        opt.value = tbl;
        opt.textContent = tbl;
        dbTableSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error fetching tables:', err);
    }

    // Upload DB handler
    uploadDbBtn.addEventListener('click', async () => {
      const tableName = dbTableSelect.value || customDbTableName.value;
      if (!tableName.trim()) {
        uploadMsg.textContent = 'Please select or enter a table name';
        return;
      }

      uploadMsg.textContent = 'Uploading to database...';

      try {
        const res = await fetch('/api/reconcile/init-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableName: tableName.trim() })
        });
        const data = await res.json();
        if (res.ok) {
          uploadMsg.innerHTML = `<strong style="color:green">✓ Uploaded ${data.inserted}/${data.total} records to "${tableName}"</strong>`;
          reconcileTableArea.style.display = 'block';
          showReconcileTable(tableName);
        } else {
          uploadMsg.textContent = data.error || 'Upload failed';
        }
      } catch (err) {
        console.error(err);
        uploadMsg.textContent = 'Upload error: ' + err.message;
      }
    });
  }

  // Display reconcile table from uploaded data (before saving to DB)
  function showReconcileTableUpload() {
    // Show the matching area
    matchingArea.style.display = 'block';
    reconcileTableArea.style.display = 'block';
    
    // Build old data table with Match columns (no FK yet since data not in DB)
    const oldColumns = oldRows.length > 0 ? Object.keys(oldRows[0]).filter(k => !k.startsWith('_')) : [];
    const filteredColumns = oldColumns.filter(k => k !== 'FK' && k !== 'id' && k !== 'created_at');
    
    let tableHtml = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
    filteredColumns.forEach(col => {
      tableHtml += `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${escapeHtml(col)}</th>`;
    });
    tableHtml += '<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left;width:80px">FK</th>';
    tableHtml += '<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left;min-width:250px">Match</th>';
    tableHtml += '</tr></thead><tbody>';

    oldRows.forEach((row, idx) => {
      tableHtml += '<tr>';
      filteredColumns.forEach(col => {
        const val = String(row[col] ?? '');
        tableHtml += `<td style="padding:8px;border:1px solid #ddd">${escapeHtml(val)}</td>`;
      });
      tableHtml += `<td style="padding:8px;border:1px solid #ddd"><strong class="fk-value" data-row-index="${idx}" data-table="">-</strong></td>`;
      tableHtml += `<td style="padding:8px;border:1px solid #ddd">
        <div class="match-cell" data-row-index="${idx}">
          <input type="text" class="match-search" placeholder="Search..." data-row-index="${idx}" style="width:100%;padding:4px;margin-bottom:4px"/>
          <select class="match-select" data-row-index="${idx}" style="width:100%;padding:4px">
            <option value="">-- No match --</option>
          </select>
          <div class="match-results" data-row-index="${idx}" style="max-height:150px;overflow-y:auto;border:1px solid #ccc;background:#fff;margin-top:4px;display:none"></div>
        </div>
      </td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;

    // Setup search handlers for each row (same as showReconcileTable)
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

          // Click handler for results
          resultsDiv.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', async () => {
              const tmplIdx = item.dataset.templateIndex;
              const pk = item.dataset.pk;
              select.value = tmplIdx;
              const fkCell = document.querySelector(`.fk-value[data-row-index="${rowIdx}"]`);
              
              if (fkCell) {
                fkCell.textContent = pk;
                fkCell.style.color = 'green';
                oldRows[rowIdx].FK = pk;  // Store FK in memory
              }
              
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

  async function showReconcileTable(tableName) {
    // Track the currently loaded table
    loadedTable = tableName;
    
    // Show the matching area
    matchingArea.style.display = 'block';
    reconcileTableArea.style.display = 'block';
    
    // Build old data table with FK and Match columns
    const oldColumns = oldRows.length > 0 ? Object.keys(oldRows[0]).filter(k => !k.startsWith('_')) : [];
    const filteredColumns = oldColumns.filter(k => k !== 'FK' && k !== 'id' && k !== 'created_at');
    
    let tableHtml = '<table style="width:100%;border-collapse:collapse"><thead><tr>';
    filteredColumns.forEach(col => {
      tableHtml += `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${escapeHtml(col)}</th>`;
    });
    tableHtml += '<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left;width:80px">FK</th>';
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
      tableHtml += `<td style="padding:8px;border:1px solid #ddd"><strong class="fk-value" data-row-index="${idx}" data-table="${tableName}">${row.FK || '-'}</strong></td>`;
      tableHtml += `<td style="padding:8px;border:1px solid #ddd">
        <div class="match-cell" data-row-index="${idx}">
          <input type="text" class="match-search" placeholder="Search..." data-row-index="${idx}" style="width:100%;padding:4px;margin-bottom:4px"/>
          <select class="match-select" data-row-index="${idx}" style="width:100%;padding:4px">
            <option value="">-- No match --</option>
          </select>
          <div class="match-results" data-row-index="${idx}" style="max-height:150px;overflow-y:auto;border:1px solid #ccc;background:#fff;margin-top:4px;display:none"></div>
        </div>
      </td>`;
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;

    // Setup search handlers for each row
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
          console.log('Searching for:', query, 'with templateRows:', templateRows.length);
          const res = await fetch('/api/reconcile/search?q=' + encodeURIComponent(query));
          const { results } = await res.json();
          console.log('Search results:', results.length);

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

          // Click handler for results
          resultsDiv.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', async () => {
              const tmplIdx = item.dataset.templateIndex;
              const pk = item.dataset.pk;
              select.value = tmplIdx;
              const fkCell = document.querySelector(`.fk-value[data-row-index="${rowIdx}"]`);
              
              if (fkCell) {
                const tbl = fkCell.dataset.table;
                const oldRowData = oldRows[rowIdx];
                
                console.log('Updating FK:', { tmplIdx, pk, tbl, oldRowData });
                
                // Call API to update FK in database
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
                  const updateData = await updateRes.json();
                  console.log('Update response:', updateRes.status, updateData);
                  if (updateRes.ok) {
                    fkCell.textContent = pk;
                    fkCell.style.color = 'green';
                  } else {
                    fkCell.textContent = '✗ Error';
                    fkCell.style.color = 'red';
                    console.error('Update error:', updateData.error);
                  }
                } catch (err) {
                  fkCell.textContent = '✗ Error';
                  fkCell.style.color = 'red';
                  console.error('Update FK error:', err);
                }
              }
              
              e.target.value = '';
              resultsDiv.style.display = 'none';
            });
          });
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Setup editable cell handlers
    document.querySelectorAll('.editable-cell').forEach(cell => {
      const editBtn = cell.querySelector('.edit-btn');
      
      cell.addEventListener('mouseover', () => {
        editBtn.style.display = 'block';
      });
      
      cell.addEventListener('mouseout', () => {
        editBtn.style.display = 'none';
      });
      
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rowIdx = parseInt(cell.dataset.rowIndex);
        const column = cell.dataset.column;
        const currentValue = cell.querySelector('.cell-value').textContent;
        
        // Create inline editor
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
          if (newValue === currentValue) {
            cell.innerHTML = originalHtml;
            return;
          }
          
          try {
            const oldRowData = oldRows[rowIdx];
            const tableName = loadedTable;
            
            const res = await fetch('/api/reconcile/update-cell', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tableName,
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
              const data = await res.json();
              alert('Update failed: ' + (data.error || 'Unknown error'));
              cell.innerHTML = originalHtml;
            }
          } catch (err) {
            console.error('Update error:', err);
            alert('Update error: ' + err.message);
            cell.innerHTML = originalHtml;
          }
        };
        
        const cancelEdit = () => {
          cell.innerHTML = originalHtml;
        };
        
        saveBtn.addEventListener('click', saveEdit);
        cancelBtn.addEventListener('click', cancelEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') cancelEdit();
        });
      });
    });

    // Setup remove column handler
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
          
          // Reload table
          await showReconcileTable(loadedTable);
        } else {
          const data = await res.json();
          removeColumnMsg.textContent = 'Error: ' + (data.error || 'Failed to remove column');
          removeColumnMsg.style.color = 'red';
        }
      } catch (err) {
        console.error('Remove column error:', err);
        removeColumnMsg.textContent = 'Error: ' + err.message;
        removeColumnMsg.style.color = 'red';
      }
    });

    // Populate remove column dropdown with available columns
    const populateRemoveColumnSelect = () => {
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
    };
    populateRemoveColumnSelect();

    // Download button
    downloadBtn.addEventListener('click', async () => {
      const matches = [];
      document.querySelectorAll('.match-select').forEach(sel => {
        const oldIdx = parseInt(sel.dataset.rowIndex);
        const tmplIdx = sel.value ? parseInt(sel.value) : null;
        matches.push({ oldIndex: oldIdx, templateIndex: tmplIdx });
      });

      saveMsg.textContent = 'Preparing...';

      try {
        const res = await fetch('/api/reconcile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matches })
        });
        const data = await res.json();
        if (res.ok) {
          const ws = xlsx.utils.json_to_sheet(data.data);
          const wb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(wb, ws, 'Reconciled');
          xlsx.writeFile(wb, 'reconciled_data.xlsx');
          saveMsg.textContent = 'Reconciled data downloaded!';
        } else {
          saveMsg.textContent = data.error || 'Download failed';
        }
      } catch (err) {
        console.error(err);
        saveMsg.textContent = 'Download error';
      }
    });

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

    // Add column handler
    addColumnBtn.addEventListener('click', async () => {
      const colName = newColumnName.value.trim();
      const colType = newColumnType.value;

      if (!colName) {
        addColumnMsg.textContent = 'Please enter column name';
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
            tableName: selectedTableName,
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
          
          // Reload table data from database to show new column
          setTimeout(async () => {
            if (oldDataLoaded && selectedTableName) {
              try {
                // Fetch fresh data from the table
                const tableRes = await fetch(`/api/reconcile/table/${selectedTableName}`);
                const tableData = await tableRes.json();
                if (tableRes.ok) {
                  oldRows = tableData.rows;
                  console.log('Reloaded table data with new column:', oldRows[0]);
                  showReconcileTable(selectedTableName);
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
        console.error(err);
        addColumnMsg.textContent = 'Error adding column';
        addColumnMsg.style.color = 'red';
      }
    });
  }
}

function router() {
  const hash = (location.hash || '#home').replace('#', '');
  if (hash === 'template') renderTemplate();
  else if (hash === 'import') renderImport();
  else if (hash === 'reconcile') renderReconcile();
  else if (hash === 'table') renderTable();
  else renderHome();
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
