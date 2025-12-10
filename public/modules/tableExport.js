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
