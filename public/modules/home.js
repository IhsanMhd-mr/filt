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
    </section>
  `;
}
