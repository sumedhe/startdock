'use strict';

const STORAGE_KEY = 'startdock';

let data  = { categories: [] };
let dirty = false;

/* ── Storage ── */

function loadData() {
  return new Promise(resolve => {
    chrome.storage.sync.get(STORAGE_KEY, result => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveData() {
  return new Promise(resolve => {
    chrome.storage.sync.set({ [STORAGE_KEY]: data }, () => {
      dirty = false;
      resolve();
    });
  });
}

function markDirty() {
  dirty = true;
  const el = document.getElementById('save-status');
  el.textContent = 'Unsaved changes';
  el.className = 'save-status';
}

async function handleSave() {
  await saveData();
  const el = document.getElementById('save-status');
  el.textContent = 'Saved';
  el.className = 'save-status saved';
  setTimeout(() => { el.textContent = ''; }, 2000);
}

/* ── Utilities ── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

/* ── Render categories list ── */

function renderCategories() {
  const container = document.getElementById('categories-list');
  container.innerHTML = '';
  data.categories.forEach((cat, ci) => {
    container.appendChild(buildCatBlock(cat, ci));
  });
  populateQaSelect();
}

function buildCatBlock(cat, ci) {
  const block = document.createElement('div');
  block.className = 'cat-block';
  block.dataset.ci = ci;

  /* ── Header row ── */
  block.innerHTML = `
    <div class="cat-header-row" data-action="toggle">
      <span class="cat-dot" style="background:${escHtml(cat.color)}"></span>
      <span class="cat-name-label">${escHtml(cat.name)}</span>
      <span class="cat-count-badge">${cat.bookmarks.length}</span>
      <button class="btn-icon" data-action="edit-cat" title="Edit category">&#9998;</button>
      <button class="btn-icon danger" data-action="del-cat" title="Delete category">&#10005;</button>
      <span class="cat-chevron">&#9660;</span>
    </div>

    <!-- Edit category form -->
    <div class="cat-edit-form">
      <div class="field">
        <label>Name</label>
        <input type="text" class="cat-edit-name" value="${escHtml(cat.name)}" placeholder="Category name">
      </div>
      <div class="field">
        <label>Colour</label>
        <input type="color" class="cat-edit-color" value="${escHtml(cat.color)}">
      </div>
      <button class="btn btn-primary btn-save-cat">Save</button>
      <button class="btn btn-ghost btn-cancel-cat">Cancel</button>
    </div>

    <!-- Bookmarks body -->
    <div class="cat-body" id="cat-body-${ci}"></div>
  `;

  renderBookmarks(block, cat, ci);
  attachCatEvents(block, ci);
  return block;
}

function renderBookmarks(block, cat, ci) {
  const body = block.querySelector('.cat-body');
  body.innerHTML = '';

  cat.bookmarks.forEach((bm, bi) => {
    /* Display row */
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.dataset.bi = bi;
    row.innerHTML = `
      <img class="bm-favicon" src="${faviconUrl(bm.url)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <span class="bm-name" title="${escHtml(bm.name)}">${escHtml(bm.name)}</span>
      <span class="bm-url" title="${escHtml(bm.url)}">${escHtml(bm.url)}</span>
      <div class="bm-actions">
        <button class="btn-icon" data-action="edit-bm" data-ci="${ci}" data-bi="${bi}" title="Edit">&#9998;</button>
        <button class="btn-icon danger" data-action="del-bm" data-ci="${ci}" data-bi="${bi}" title="Delete">&#10005;</button>
      </div>
    `;

    /* Edit form (hidden) */
    const editRow = document.createElement('div');
    editRow.className = 'bm-edit-form';
    editRow.dataset.biForm = bi;
    editRow.innerHTML = `
      <div class="field">
        <label>Name</label>
        <input type="text" class="bm-edit-name" value="${escHtml(bm.name)}" placeholder="Bookmark name">
      </div>
      <div class="field" style="flex:1; min-width:220px;">
        <label>URL</label>
        <input type="url" class="bm-edit-url" value="${escHtml(bm.url)}" placeholder="https://…" style="width:100%;">
      </div>
      <button class="btn btn-primary bm-save" data-ci="${ci}" data-bi="${bi}">Save</button>
      <button class="btn btn-ghost bm-cancel" data-bi="${bi}">Cancel</button>
    `;

    body.appendChild(row);
    body.appendChild(editRow);
  });

  /* Add bookmark row */
  const addRow = document.createElement('div');
  addRow.className = 'add-bm-row';
  addRow.innerHTML = `<button class="btn btn-ghost" data-action="add-bm" data-ci="${ci}" style="font-size:12px; padding:5px 10px;">&#43; Add bookmark</button>`;

  /* New bookmark form */
  const newBmForm = document.createElement('div');
  newBmForm.className = 'bm-edit-form';
  newBmForm.id = `new-bm-form-${ci}`;
  newBmForm.innerHTML = `
    <div class="field">
      <label>Name</label>
      <input type="text" class="new-bm-name" placeholder="Bookmark name">
    </div>
    <div class="field" style="flex:1; min-width:220px;">
      <label>URL</label>
      <input type="url" class="new-bm-url" placeholder="https://…" style="width:100%;">
    </div>
    <button class="btn btn-primary" data-action="save-new-bm" data-ci="${ci}">Add</button>
    <button class="btn btn-ghost" data-action="cancel-new-bm" data-ci="${ci}">Cancel</button>
  `;

  body.appendChild(addRow);
  body.appendChild(newBmForm);
}

function attachCatEvents(block, ci) {
  /* Toggle collapse */
  block.querySelector('[data-action="toggle"]').addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (block.classList.contains('editing')) return;
    block.classList.toggle('open');
  });

  /* Edit category */
  block.querySelector('[data-action="edit-cat"]').addEventListener('click', e => {
    e.stopPropagation();
    block.classList.remove('open');
    block.classList.toggle('editing');
  });

  block.querySelector('.btn-save-cat').addEventListener('click', () => {
    const name  = block.querySelector('.cat-edit-name').value.trim();
    const color = block.querySelector('.cat-edit-color').value;
    if (!name) return;
    data.categories[ci].name  = name;
    data.categories[ci].color = color;
    markDirty();
    renderCategories();
  });

  block.querySelector('.btn-cancel-cat').addEventListener('click', () => {
    block.classList.remove('editing');
  });

  /* Delete category */
  block.querySelector('[data-action="del-cat"]').addEventListener('click', e => {
    e.stopPropagation();
    if (!confirm(`Delete category "${data.categories[ci].name}" and all its bookmarks?`)) return;
    data.categories.splice(ci, 1);
    markDirty();
    renderCategories();
  });

  /* Bookmark edit / delete */
  block.querySelectorAll('[data-action="edit-bm"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bi = parseInt(btn.dataset.bi);
      const row  = block.querySelector(`.bm-row[data-bi="${bi}"]`);
      const form = block.querySelector(`.bm-edit-form[data-bi-form="${bi}"]`);
      row.style.display  = 'none';
      form.classList.add('active');
    });
  });

  block.querySelectorAll('[data-action="del-bm"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bi = parseInt(btn.dataset.bi);
      if (!confirm(`Delete "${data.categories[ci].bookmarks[bi].name}"?`)) return;
      data.categories[ci].bookmarks.splice(bi, 1);
      markDirty();
      renderCategories();
    });
  });

  /* Bookmark save / cancel (edit) */
  block.querySelectorAll('.bm-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const bi   = parseInt(btn.dataset.bi);
      const form = block.querySelector(`.bm-edit-form[data-bi-form="${bi}"]`);
      const name = form.querySelector('.bm-edit-name').value.trim();
      const url  = form.querySelector('.bm-edit-url').value.trim();
      if (!name || !url) return;
      data.categories[ci].bookmarks[bi] = { name, url };
      markDirty();
      renderCategories();
    });
  });

  block.querySelectorAll('.bm-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const bi   = parseInt(btn.dataset.bi);
      const row  = block.querySelector(`.bm-row[data-bi="${bi}"]`);
      const form = block.querySelector(`.bm-edit-form[data-bi-form="${bi}"]`);
      row.style.display = '';
      form.classList.remove('active');
    });
  });

  /* Add bookmark */
  block.querySelector('[data-action="add-bm"]').addEventListener('click', () => {
    const form = document.getElementById(`new-bm-form-${ci}`);
    form.classList.toggle('active');
    if (form.classList.contains('active')) form.querySelector('.new-bm-name').focus();
  });

  block.querySelector(`[data-action="save-new-bm"]`).addEventListener('click', () => {
    const form = document.getElementById(`new-bm-form-${ci}`);
    const name = form.querySelector('.new-bm-name').value.trim();
    const url  = form.querySelector('.new-bm-url').value.trim();
    if (!name || !url) return;
    data.categories[ci].bookmarks.push({ name, url });
    markDirty();
    renderCategories();
    /* Re-open the expanded state after re-render */
    const newBlock = document.querySelector(`.cat-block[data-ci="${ci}"]`);
    if (newBlock) newBlock.classList.add('open');
  });

  block.querySelector(`[data-action="cancel-new-bm"]`).addEventListener('click', () => {
    const form = document.getElementById(`new-bm-form-${ci}`);
    form.classList.remove('active');
    form.querySelector('.new-bm-name').value = '';
    form.querySelector('.new-bm-url').value  = '';
  });
}

/* ── Add category ── */

function initAddCategory() {
  document.getElementById('btn-add-cat').addEventListener('click', () => {
    const form = document.getElementById('new-cat-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') document.getElementById('new-cat-name').focus();
  });

  document.getElementById('new-cat-save').addEventListener('click', () => {
    const name  = document.getElementById('new-cat-name').value.trim();
    const color = document.getElementById('new-cat-color').value;
    if (!name) return;
    data.categories.push({ name, color, bookmarks: [] });
    document.getElementById('new-cat-name').value = '';
    document.getElementById('new-cat-form').style.display = 'none';
    markDirty();
    renderCategories();
  });

  document.getElementById('new-cat-cancel').addEventListener('click', () => {
    document.getElementById('new-cat-form').style.display = 'none';
    document.getElementById('new-cat-name').value = '';
  });

  document.getElementById('new-cat-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('new-cat-save').click();
    if (e.key === 'Escape') document.getElementById('new-cat-cancel').click();
  });
}

/* ── Save button ── */

function initSaveButton() {
  document.getElementById('btn-save').addEventListener('click', handleSave);
}

/* ── Quick-add (via context menu) ── */

function populateQaSelect() {
  const sel = document.getElementById('qa-category');
  sel.innerHTML = '';
  data.categories.forEach((cat, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

function initQuickAdd() {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('add')) return;

  const url   = decodeURIComponent(params.get('url')   || '');
  const title = decodeURIComponent(params.get('title') || '');

  const banner = document.getElementById('quick-add-banner');
  banner.style.display = 'block';
  document.getElementById('qa-url').value  = url;
  document.getElementById('qa-name').value = title;

  document.getElementById('qa-add').addEventListener('click', () => {
    const name = document.getElementById('qa-name').value.trim();
    const qUrl = document.getElementById('qa-url').value.trim();
    const ci   = parseInt(document.getElementById('qa-category').value);
    if (!name || !qUrl) return;
    data.categories[ci].bookmarks.push({ name, url: qUrl });
    markDirty();
    banner.style.display = 'none';
    renderCategories();
    handleSave();
  });

  document.getElementById('qa-cancel').addEventListener('click', () => {
    banner.style.display = 'none';
  });
}

/* ── Import / Export ── */

function initImportExport() {
  document.getElementById('btn-export').addEventListener('click', () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'startdock-bookmarks.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-import-trigger').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!parsed.categories || !Array.isArray(parsed.categories)) {
          alert('Invalid file: expected { categories: [...] }');
          return;
        }
        if (!confirm(`Replace all current bookmarks with the imported data (${parsed.categories.length} categories)?`)) return;
        data = parsed;
        markDirty();
        renderCategories();
        handleSave();
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

/* ── Init ── */

async function init() {
  const stored = await loadData();
  if (stored) data = stored;

  renderCategories();
  initAddCategory();
  initSaveButton();
  initQuickAdd();
  initImportExport();
}

init();
