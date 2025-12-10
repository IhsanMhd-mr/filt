// Main App - SPA Router and Initialization
// Imports modules for different features

import { renderHome } from './modules/home.js';
import { renderTemplate, renderImport } from './modules/upload.js';
import { renderTableExport } from './modules/tableExport.js';
import { renderReconcile } from './modules/reconcile.js';

// Utility functions - available globally
window.escapeHtml = function(str) {
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
};

// Navigation handler
function navTo(hash) {
  location.hash = hash;
}

// Setup nav buttons
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => navTo(btn.dataset.href.slice(1)));
});

// Helper function - build table HTML
window.buildTable = function(rows) {
  if (!rows || rows.length === 0) return '<p>No data available.</p>';

  const headers = Object.keys(rows[0]);
  let html = '<div class="table-wrap"><table><thead><tr>';
  for (const h of headers) html += `<th>${window.escapeHtml(h)}</th>`;
  html += '</tr></thead><tbody>';

  for (const r of rows) {
    html += '<tr>';
    for (const h of headers) html += `<td>${window.escapeHtml(String(r[h] ?? ''))}</td>`;
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
};

// Router - handles navigation based on URL hash
function router() {
  const hash = (location.hash || '#home').replace('#', '');
  
  if (hash === 'home') renderHome();
  else if (hash === 'template') renderTemplate();
  else if (hash === 'import') renderImport();
  else if (hash === 'table') renderTableExport();
  else if (hash === 'reconcile') renderReconcile();
  else renderHome();
}

// Listen to hash changes
window.addEventListener('hashchange', router);

// Initial load
router();
