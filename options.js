'use strict';

const STORAGE_KEY = 'startdock';

let data  = { categories: [], settings: { dataSource: 'custom', nativeShowPath: false } };
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
  let dragSrcCi = null;

  data.categories.forEach((cat, ci) => {
    const block = buildCatBlock(cat, ci);
    block.draggable = true;
    let dragHandleActive = false;

    block.querySelector('.cat-drag').addEventListener('mousedown', () => { dragHandleActive = true; });
    document.addEventListener('mouseup', () => { dragHandleActive = false; }, { once: false });

    block.addEventListener('dragstart', e => {
      if (!dragHandleActive) { e.preventDefault(); return; }
      dragSrcCi = ci;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => block.classList.add('dragging'), 0);
    });
    block.addEventListener('dragend', () => {
      block.classList.remove('dragging');
      container.querySelectorAll('.cat-block').forEach(b => b.classList.remove('drag-over'));
      dragSrcCi = null;
    });
    block.addEventListener('dragover', e => {
      if (dragSrcCi === null || dragSrcCi === ci) return;
      e.preventDefault();
      container.querySelectorAll('.cat-block').forEach(b => b.classList.remove('drag-over'));
      block.classList.add('drag-over');
    });
    block.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcCi === null || dragSrcCi === ci) return;
      const moved = data.categories.splice(dragSrcCi, 1)[0];
      data.categories.splice(ci, 0, moved);
      dragSrcCi = null;
      markDirty();
      renderCategories();
    });

    container.appendChild(block);
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
      <span class="cat-drag" title="Drag to reorder">&#8942;</span>
      <span class="cat-dot" style="background:${escHtml(cat.color)}"></span>
      <span class="cat-name-label">${escHtml(cat.name)}</span>
      <span class="cat-count-badge">${cat.bookmarks.filter(b => b.type !== 'separator').length}</span>
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

  let dragSrcBi = null;

  const clearDragOver = () => body.querySelectorAll('.bm-row, .bm-separator-row').forEach(r => r.classList.remove('drag-over'));

  const attachDragEvents = (row, bi) => {
    row.addEventListener('dragstart', e => {
      e.stopPropagation();
      dragSrcBi = bi;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', e => {
      e.stopPropagation();
      row.classList.remove('dragging');
      clearDragOver();
      dragSrcBi = null;
    });
    row.addEventListener('dragover', e => {
      e.stopPropagation();
      if (dragSrcBi === null || dragSrcBi === bi) return;
      e.preventDefault();
      clearDragOver();
      row.classList.add('drag-over');
    });
    row.addEventListener('drop', e => {
      e.stopPropagation();
      e.preventDefault();
      if (dragSrcBi === null || dragSrcBi === bi) return;
      const moved = data.categories[ci].bookmarks.splice(dragSrcBi, 1)[0];
      data.categories[ci].bookmarks.splice(bi, 0, moved);
      dragSrcBi = null;
      markDirty();
      renderCategories();
      const newBlock = document.querySelector(`.cat-block[data-ci="${ci}"]`);
      if (newBlock) newBlock.classList.add('open');
    });
  };

  cat.bookmarks.forEach((bm, bi) => {
    /* Separator row */
    if (bm.type === 'separator') {
      const row = document.createElement('div');
      row.className = 'bm-separator-row';
      row.dataset.bi = bi;
      row.draggable = true;
      const labelText = bm.label || '';
      row.innerHTML = `
        <span class="bm-drag" title="Drag to reorder">&#8942;</span>
        <div class="bm-separator-line"></div>
        <span class="bm-separator-label" title="Click to edit label">${escHtml(labelText) || 'section'}</span>
        <input class="bm-separator-input" type="text" value="${escHtml(labelText)}" placeholder="Label (optional)" style="display:none">
        <div class="bm-separator-line"></div>
        <div class="bm-actions">
          <button class="btn-icon danger" data-action="del-bm" data-ci="${ci}" data-bi="${bi}" title="Delete">&#10005;</button>
        </div>
      `;

      const labelEl = row.querySelector('.bm-separator-label');
      const inputEl = row.querySelector('.bm-separator-input');

      labelEl.addEventListener('click', () => {
        labelEl.style.display = 'none';
        inputEl.style.display = '';
        inputEl.focus();
        inputEl.select();
      });

      const commitLabel = () => {
        const val = inputEl.value.trim();
        data.categories[ci].bookmarks[bi].label = val;
        markDirty();
        labelEl.textContent = val || 'section';
        inputEl.style.display = 'none';
        labelEl.style.display = '';
      };

      inputEl.addEventListener('blur', commitLabel);
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
        if (e.key === 'Escape') { inputEl.value = bm.label || ''; commitLabel(); }
      });

      attachDragEvents(row, bi);
      body.appendChild(row);
      return;
    }

    /* Display row */
    const row = document.createElement('div');
    row.className = 'bm-row';
    row.dataset.bi = bi;
    row.draggable = true;
    row.innerHTML = `
      <span class="bm-drag" title="Drag to reorder">&#8942;</span>
      <img class="bm-favicon" src="${faviconUrl(bm.url)}" alt="" loading="lazy" onerror="this.style.display='none'">
      <span class="bm-name" title="${escHtml(bm.name)}">${escHtml(bm.name)}</span>
      <span class="bm-url" title="${escHtml(bm.url)}">${escHtml(bm.url)}</span>
      <div class="bm-actions">
        <button class="btn-icon" data-action="edit-bm" data-ci="${ci}" data-bi="${bi}" title="Edit">&#9998;</button>
        <button class="btn-icon danger" data-action="del-bm" data-ci="${ci}" data-bi="${bi}" title="Delete">&#10005;</button>
      </div>
    `;

    attachDragEvents(row, bi);

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
  addRow.innerHTML = `
    <button class="btn btn-ghost" data-action="add-bm" data-ci="${ci}" style="font-size:12px; padding:5px 10px;">&#43; Add bookmark</button>
    <button class="btn btn-ghost" data-action="add-sep" data-ci="${ci}" style="font-size:12px; padding:5px 10px;">&#8213; Add section</button>
  `;

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
    if (e.target.closest('button') || e.target.closest('.cat-drag')) return;
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

  /* Add separator */
  block.querySelector('[data-action="add-sep"]').addEventListener('click', () => {
    data.categories[ci].bookmarks.push({ type: 'separator' });
    markDirty();
    renderCategories();
    const newBlock = document.querySelector(`.cat-block[data-ci="${ci}"]`);
    if (newBlock) newBlock.classList.add('open');
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

/* ── Data Source ── */

function applyDataSourceUI(source) {
  const isNative = source === 'native';

  document.querySelectorAll('.ds-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });

  document.getElementById('ds-native-opts').classList.toggle('visible', isNative);
  document.getElementById('custom-section-header').style.display = isNative ? 'none' : '';
  document.getElementById('new-cat-form').style.display = 'none';
  document.querySelector('#categories-list').style.display = isNative ? 'none' : '';
  document.getElementById('io-section').style.display = isNative ? 'none' : '';
  document.getElementById('btn-save').style.display = isNative ? 'none' : '';
}

function initDataSource() {
  const settings = data.settings || {};
  const current = settings.dataSource || 'custom';
  applyDataSourceUI(current);
  document.getElementById('native-show-path').checked = settings.nativeShowPath || false;

  document.querySelectorAll('.ds-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const source = btn.dataset.source;
      if (!data.settings) data.settings = {};
      data.settings.dataSource = source;
      applyDataSourceUI(source);
      markDirty();
      handleSave();
    });
  });

  document.getElementById('native-show-path').addEventListener('change', e => {
    if (!data.settings) data.settings = {};
    data.settings.nativeShowPath = e.target.checked;
    markDirty();
    handleSave();
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
  document.getElementById('btn-close').addEventListener('click', () => {
    location.href = chrome.runtime.getURL('newtab.html');
  });
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

/* ── Export to browser bookmarks ── */

async function exportToBrowser() {
  const btn = document.getElementById('btn-export-browser');
  btn.disabled = true;
  btn.textContent = 'Exporting…';

  try {
    // Remove any existing StartDock folder from the bookmarks bar
    const existing = await new Promise(resolve => {
      chrome.bookmarks.search({ title: 'StartDock' }, results => {
        resolve(results.filter(r => !r.url && r.parentId === '1'));
      });
    });
    for (const folder of existing) {
      await new Promise(resolve => chrome.bookmarks.removeTree(folder.id, resolve));
    }

    // Create fresh StartDock root folder in the bookmarks bar
    const root = await new Promise(resolve => {
      chrome.bookmarks.create({ parentId: '1', title: 'StartDock' }, resolve);
    });

    // Create one sub-folder per category with its bookmarks
    for (const cat of data.categories) {
      const catFolder = await new Promise(resolve => {
        chrome.bookmarks.create({ parentId: root.id, title: cat.name }, resolve);
      });
      for (const bm of cat.bookmarks) {
        await new Promise(resolve => {
          chrome.bookmarks.create({ parentId: catFolder.id, title: bm.name, url: bm.url }, resolve);
        });
      }
    }

    btn.textContent = 'Exported!';
    setTimeout(() => {
      btn.textContent = '↗ Export to browser bookmarks';
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('StartDock: export to browser failed', err);
    btn.textContent = 'Export failed';
    btn.disabled = false;
  }
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

  document.getElementById('btn-export-browser').addEventListener('click', () => {
    if (!confirm(`This will replace the "StartDock" folder in your browser bookmarks bar with your current ${data.categories.length} categories. Continue?`)) return;
    exportToBrowser();
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
  if (stored) {
    data = stored;
    if (!data.settings) data.settings = { dataSource: 'custom', nativeShowPath: false };
  }

  renderCategories();
  initDataSource();
  initAddCategory();
  initSaveButton();
  initQuickAdd();
  initImportExport();
}

init();
