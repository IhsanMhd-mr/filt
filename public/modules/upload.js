// Upload Module - handles file uploads for template and old data

export async function renderTemplate() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = '<section><h2>Upload Template</h2><div id="templateArea"><form id="templateForm"><label>Choose a template Excel file (.xlsx, .xls)</label><input type="file" name="file" id="templateInput" accept=".xlsx,.xls" required /><div class="controls"><button type="submit" class="btn primary">Upload Template</button><a class="btn" href="#import">Go to Import</a></div></form><div id="templateMsg"></div></div></section>';
  const templateArea = document.getElementById('templateArea');

  const form = document.getElementById('templateForm');
  const msg = document.getElementById('templateMsg');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const file = document.getElementById('templateInput').files[0];
    if (!file) return;

    msg.textContent = 'Uploading template...';
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/reconcile/template', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        msg.textContent = `Template loaded: ${data.rows} rows`;
        msg.style.color = 'green';
      } else {
        msg.textContent = data.error || 'Upload failed';
        msg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Upload error';
      msg.style.color = 'red';
    }
  });
}

export async function renderImport() {
  const appEl = document.getElementById('app');
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
        msg.style.color = 'green';
        location.hash = 'table';
      } else {
        msg.textContent = data.error || 'Upload failed';
        msg.style.color = 'red';
      }
    } catch (err) {
      console.error(err);
      msg.textContent = 'Upload error';
      msg.style.color = 'red';
    }
  });
}
