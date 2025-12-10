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

        <div id="matchingArea" style="display:none">
          <h3>Step 3: Match Records</h3>
          <p>For each record, search and select a matching template row. FK updates live in the database.</p>
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
  const matchingArea = document.getElementById('matchingArea');
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

  // Display reconcile table from uploaded data
  function showReconcileTableUpload() {
    matchingArea.style.display = 'block';
    reconcileTableArea.style.display = 'block';
    
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
              select.value = tmplIdx;
              const fkCell = document.querySelector(`.fk-value[data-row-index="${rowIdx}"]`);
              
              if (fkCell) {
                const tbl = fkCell.dataset.table;
                const oldRowData = oldRows[rowIdx];
                
                if (tbl) {
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
                      fkCell.textContent = pk;
                      fkCell.style.color = 'green';
                    }
                  } catch (err) {
                    console.error('Update FK error:', err);
                  }
                } else {
                  fkCell.textContent = pk;
                  fkCell.style.color = 'green';
                  oldRows[rowIdx].FK = pk;
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
      const res = await fetch('/api/reconcile/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName })
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
