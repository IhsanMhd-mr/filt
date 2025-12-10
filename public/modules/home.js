// Home Module - welcome page

export function renderHome() {
  const appEl = document.getElementById('app');
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
      
      <div style="margin-top:32px;padding:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px">
        <h4 style="margin-top:0;color:#856404">⚠️ Database Management</h4>
        <p style="margin:8px 0;color:#856404">Drop all tables and start fresh:</p>
        <button id="resetDbBtn" class="btn" style="background:#dc3545;color:#fff">🗑️ Reset Database</button>
        <div id="resetMsg" style="margin-top:8px;font-weight:bold"></div>
      </div>
    </section>
  `;

  const resetDbBtn = document.getElementById('resetDbBtn');
  const resetMsg = document.getElementById('resetMsg');

  resetDbBtn.addEventListener('click', async () => {
    const confirmed = confirm(
      '⚠️ WARNING: This will DROP ALL TABLES in the database!\n\n' +
      'This cannot be undone. Are you sure?'
    );
    
    if (!confirmed) return;

    resetMsg.textContent = 'Resetting database...';
    resetMsg.style.color = '#666';

    try {
      const res = await fetch('/api/reset-db', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        resetMsg.textContent = `✓ ${data.message} - Dropped tables: ${data.droppedTables.join(', ') || 'none'}`;
        resetMsg.style.color = 'green';
        
        // Refresh the page after 2 seconds
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
        resetMsg.textContent = `✗ Error: ${data.error}`;
        resetMsg.style.color = 'red';
      }
    } catch (err) {
      console.error('Reset error:', err);
      resetMsg.textContent = `✗ Reset failed: ${err.message}`;
      resetMsg.style.color = 'red';
    }
  });
}
