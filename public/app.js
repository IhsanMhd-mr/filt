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
  appEl.innerHTML = '<section><h2>Table View</h2><div id="tableArea">Loading…</div></section>';
  const tableArea = document.getElementById('tableArea');

  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    tableArea.innerHTML = buildTable(data.rows);
  } catch (err) {
    console.error(err);
    tableArea.innerHTML = '<p>Failed to load data.</p>';
  }
}

async function renderReconcile() {
  appEl.innerHTML = `
    <section>
      <h2>Reconcile Data</h2>
      <div id="reconcileArea">
        <h3>Step 1: Upload Old Data</h3>
        <form id="oldDataForm">
          <input type="file" id="oldDataFile" accept=".xlsx,.xls" required />
          <button type="submit" class="btn primary">Upload Old Data</button>
        </form>
        <div id="oldMsg"></div>

        <h3>Step 2: Upload Template</h3>
        <form id="reconcileTemplateForm">
          <input type="file" id="reconcileTemplateFile" accept=".xlsx,.xls" required />
          <button type="submit" class="btn primary">Upload Template</button>
        </form>
        <div id="templateMsg"></div>

        <div id="matchingArea" style="display:none">
          <h3>Step 3: Match Records in Table</h3>
          <p>Click the dropdown in the "Match" column to search and select a template row for each record.</p>
          <div id="tableContainer" style="overflow-x:auto"></div>
          <div class="controls">
            <button id="saveBtn" class="btn primary">Save Reconciled Data</button>
            <div id="saveMsg"></div>
          </div>
        </div>
      </div>
    </section>
  `;

  const oldDataForm = document.getElementById('oldDataForm');
  const reconcileTemplateForm = document.getElementById('reconcileTemplateForm');
  const matchingArea = document.getElementById('matchingArea');
  const oldMsg = document.getElementById('oldMsg');
  const templateMsg = document.getElementById('templateMsg');
  const saveBtn = document.getElementById('saveBtn');
  const saveMsg = document.getElementById('saveMsg');
  const tableContainer = document.getElementById('tableContainer');

  let oldDataLoaded = false;
  let templateLoaded = false;
  let oldRows = [];
  let templateRows = [];

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
        oldDataLoaded = true;
        if (templateLoaded) showTableUI();
      } else {
        oldMsg.textContent = data.error || 'Upload failed';
      }
    } catch (err) {
      console.error(err);
      oldMsg.textContent = 'Upload error';
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
        templateLoaded = true;
        if (oldDataLoaded) showTableUI();
      } else {
        templateMsg.textContent = data.error || 'Upload failed';
      }
    } catch (err) {
      console.error(err);
      templateMsg.textContent = 'Upload error';
    }
  });

  async function showTableUI() {
    matchingArea.style.display = 'block';
    
    // Fetch old rows and template rows
    const oldRes = await fetch('/api/reconcile/data');
    const { rows: fetchedOldRows } = await oldRes.json();
    oldRows = fetchedOldRows;

    // Fetch template rows with PK
    const tmplRes = await fetch('/api/reconcile/template-rows');
    const { rows: fetchedTemplateRows } = await tmplRes.json();
    templateRows = fetchedTemplateRows;

    console.log('Template rows:', templateRows); // Debug: verify PK is present

    // Build old data table with FK and Match columns
    const oldColumns = oldRows.length > 0 ? Object.keys(oldRows[0]).filter(k => !k.startsWith('_')) : [];
    const filteredColumns = oldColumns.filter(k => k !== 'FK'); // Remove FK from default display
    
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
      // FK column (will be populated on match)
      tableHtml += `<td style="padding:8px;border:1px solid #ddd"><strong class="fk-value" data-row-index="${idx}">${row.FK || '-'}</strong></td>`;
      // Match column
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
            item.addEventListener('click', () => {
              const tmplIdx = item.dataset.templateIndex;
              const pk = item.dataset.pk;
              select.value = tmplIdx;
              // Update FK column with template's PK
              const fkCell = document.querySelector(`.fk-value[data-row-index="${rowIdx}"]`);
              if (fkCell) {
                fkCell.textContent = pk;
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

    // Save handler
    saveBtn.addEventListener('click', async () => {
      const matches = [];
      document.querySelectorAll('.match-select').forEach(sel => {
        const oldIdx = parseInt(sel.dataset.rowIndex);
        const tmplIdx = sel.value ? parseInt(sel.value) : null;
        matches.push({ oldIndex: oldIdx, templateIndex: tmplIdx });
      });

      saveMsg.textContent = 'Saving...';

      try {
        const res = await fetch('/api/reconcile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matches })
        });
        const data = await res.json();
        if (res.ok) {
          // Download as Excel
          const ws = xlsx.utils.json_to_sheet(data.data);
          const wb = xlsx.utils.book_new();
          xlsx.utils.book_append_sheet(wb, ws, 'Reconciled');
          xlsx.writeFile(wb, 'reconciled_data.xlsx');
          saveMsg.textContent = 'Reconciled data downloaded!';
        } else {
          saveMsg.textContent = data.error || 'Save failed';
        }
      } catch (err) {
        console.error(err);
        saveMsg.textContent = 'Save error';
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
