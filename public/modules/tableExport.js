// Table Export Module - handles table selection and Excel export functionality

export async function renderTableExport() {
  const appEl = document.getElementById('app');
  
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
          <button id="dropTableBtn" class="btn" style="background:#dc3545;color:#fff;display:none">🗑️ Drop Table</button>
        </div>
        <div id="exportMsg" style="margin-top:8px;font-weight:bold"></div>
      </div>

      <div id="sortingControls" style="display:none;padding:12px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin-bottom:16px">
        <h4 style="margin-top:0">Sort Data</h4>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label style="display:block;margin-bottom:6px"><strong>Sort By:</strong></label>
            <select id="sortColumn" style="padding:8px;border:1px solid #ddd;border-radius:4px;min-width:150px">
              <option value="">-- Select column --</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px"><strong>Order:</strong></label>
            <select id="sortOrder" style="padding:8px;border:1px solid #ddd;border-radius:4px">
              <option value="asc">Ascending (A → Z, 1 → 9)</option>
              <option value="desc">Descending (Z → A, 9 → 1)</option>
            </select>
          </div>
          <button id="applySortBtn" class="btn primary">Apply Sort</button>
          <button id="resetSortBtn" class="btn">Reset</button>
        </div>
      </div>

      <div id="tableArea">Select a table to view and export its contents</div>
    </section>
  `;
  
  const tableArea = document.getElementById('tableArea');
  const exportTableSelect = document.getElementById('exportTableSelect');
  const loadExportTableBtn = document.getElementById('loadExportTableBtn');
  const exportTableBtn = document.getElementById('exportTableBtn');
  const exportMsg = document.getElementById('exportMsg');
  const sortingControls = document.getElementById('sortingControls');
  const sortColumn = document.getElementById('sortColumn');
  const sortOrder = document.getElementById('sortOrder');
  const applySortBtn = document.getElementById('applySortBtn');
  const resetSortBtn = document.getElementById('resetSortBtn');
  let currentTableData = [];
  let originalTableData = [];
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
  const dropTableBtn = document.getElementById('dropTableBtn');
  
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
        originalTableData = JSON.parse(JSON.stringify(currentTableData)); // Deep copy for reset
        currentTableName = tableName;
        exportTableBtn.style.display = 'inline-block';
        dropTableBtn.style.display = 'inline-block';
        sortingControls.style.display = 'block';
        
        // Populate sort column dropdown
        if (currentTableData.length > 0) {
          const columns = Object.keys(currentTableData[0]).filter(k => !k.startsWith('_') && k !== 'created_at');
          sortColumn.innerHTML = '<option value="">-- Select column --</option>';
          columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            sortColumn.appendChild(opt);
          });
        }
        
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
      // Create Excel file from table data using window.XLSX (global from CDN)
      const XLSX = window.XLSX;
      if (!XLSX) throw new Error('XLSX library not loaded');
      
      const ws = XLSX.utils.json_to_sheet(currentTableData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, currentTableName.substring(0, 31)); // Sheet name max 31 chars
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${currentTableName}_${timestamp}.xlsx`;
      
      // Download the file
      XLSX.writeFile(wb, filename);
      exportMsg.textContent = `✓ Exported "${filename}" successfully!`;
      exportMsg.style.color = 'green';
    } catch (err) {
      console.error('Export error:', err);
      exportMsg.textContent = 'Export failed: ' + err.message;
      exportMsg.style.color = 'red';
    }
  });

  // Drop selected table
  dropTableBtn.addEventListener('click', async () => {
    if (!currentTableName) {
      exportMsg.textContent = 'No table selected';
      exportMsg.style.color = 'red';
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: This will DELETE the entire table "${currentTableName}" and all its data!\n\n` +
      'This cannot be undone. Are you sure?'
    );
    
    if (!confirmed) return;

    exportMsg.textContent = 'Dropping table...';
    exportMsg.style.color = '#666';

    try {
      const res = await fetch('/api/drop-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: currentTableName })
      });
      const data = await res.json();

      if (res.ok) {
        exportMsg.textContent = `✓ Table "${currentTableName}" dropped successfully!`;
        exportMsg.style.color = 'green';
        dropTableBtn.style.display = 'none';
        exportTableBtn.style.display = 'none';
        tableArea.innerHTML = '<p>Table has been deleted. Select another table to continue.</p>';
        exportTableSelect.value = '';
        
        // Reload available tables
        setTimeout(() => {
          loadAvailableTables();
        }, 1500);
      } else {
        exportMsg.textContent = `✗ Error: ${data.error}`;
        exportMsg.style.color = 'red';
      }
    } catch (err) {
      console.error('Drop table error:', err);
      exportMsg.textContent = `✗ Drop failed: ${err.message}`;
      exportMsg.style.color = 'red';
    }
  });

  // Apply sorting
  applySortBtn.addEventListener('click', () => {
    const column = sortColumn.value;
    const order = sortOrder.value;

    if (!column) {
      exportMsg.textContent = 'Please select a column to sort by';
      exportMsg.style.color = 'orange';
      return;
    }

    // Create sorted copy of data
    const sorted = JSON.parse(JSON.stringify(currentTableData));
    
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

    currentTableData = sorted;
    tableArea.innerHTML = buildTable(currentTableData);
    exportMsg.textContent = `✓ Sorted by "${column}" (${order === 'asc' ? 'Ascending' : 'Descending'})`;
    exportMsg.style.color = 'green';
  });

  // Reset sorting
  resetSortBtn.addEventListener('click', () => {
    currentTableData = JSON.parse(JSON.stringify(originalTableData));
    sortColumn.value = '';
    sortOrder.value = 'asc';
    tableArea.innerHTML = buildTable(currentTableData);
    exportMsg.textContent = '✓ Sorting reset to original order';
    exportMsg.style.color = 'green';
  });

  // Load tables on page load
  loadAvailableTables();
}

// Helper function - build table HTML
function buildTable(rows) {
  if (!rows || rows.length === 0) return '<p>No data available.</p>';

  const headers = Object.keys(rows[0]);
  let html = '<div class="table-wrap"><table><thead><tr>';
  
  for (const h of headers) {
    html += `<th>${escapeHtml(h)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const r of rows) {
    html += '<tr>';
    for (const h of headers) {
      html += `<td>${escapeHtml(String(r[h] ?? ''))}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// Helper function - escape HTML
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}
