'use strict';

const STORAGE_KEY = 'startdock';

const DEFAULT_DATA = {
  categories: [
    {
      name: 'Search & Productivity', color: '#10B981',
      bookmarks: [
        { name: 'Google',       url: 'https://www.google.com' },
        { name: 'Gmail',        url: 'https://mail.google.com' },
        { name: 'Google Drive', url: 'https://drive.google.com' },
        { name: 'Google Docs',  url: 'https://docs.google.com' },
        { name: 'Calendar',     url: 'https://calendar.google.com' },
      ],
    },
    {
      name: 'Development', color: '#F59E0B',
      bookmarks: [
        { name: 'GitHub',      url: 'https://github.com' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
        { name: 'npm',         url: 'https://www.npmjs.com' },
        { name: 'Can I Use',   url: 'https://caniuse.com' },
      ],
    },
    {
      name: 'AI Tools', color: '#8B5CF6',
      bookmarks: [
        { name: 'Claude',   url: 'https://claude.ai' },
        { name: 'ChatGPT',  url: 'https://chatgpt.com' },
        { name: 'Gemini',   url: 'https://gemini.google.com' },
        { name: 'Perplexity', url: 'https://www.perplexity.ai' },
      ],
    },
    {
      name: 'Design', color: '#EC4899',
      bookmarks: [
        { name: 'Figma',            url: 'https://figma.com' },
        { name: 'Canva',            url: 'https://www.canva.com' },
        { name: 'SVG Repo',         url: 'https://www.svgrepo.com' },
        { name: 'Favicon.io',       url: 'https://favicon.io' },
        { name: 'Internet Archive', url: 'https://archive.org/web' },
      ],
    },
    {
      name: 'Social & News', color: '#3B82F6',
      bookmarks: [
        { name: 'Reddit',    url: 'https://www.reddit.com' },
        { name: 'Hacker News', url: 'https://news.ycombinator.com' },
        { name: 'X / Twitter', url: 'https://x.com' },
        { name: 'LinkedIn',  url: 'https://www.linkedin.com' },
        { name: 'YouTube',   url: 'https://www.youtube.com' },
      ],
    },
    {
      name: 'Entertainment', color: '#64748B',
      bookmarks: [
        { name: 'Netflix',  url: 'https://www.netflix.com' },
        { name: 'Spotify',  url: 'https://open.spotify.com' },
        { name: 'Twitch',   url: 'https://www.twitch.tv' },
      ],
    },
  ],
};

/* ── Native bookmark helpers ── */

const CATEGORY_COLORS = [
  '#3B82F6','#10B981','#F59E0B','#EF4444',
  '#8B5CF6','#EC4899','#06B6D4','#64748B',
];

function flattenNode(node, pathParts, showPath) {
  const bookmarks = [];
  if (!node.children) return bookmarks;
  for (const child of node.children) {
    if (child.url) {
      const pathLabel = pathParts.filter(Boolean).join(' / ');
      const name = showPath && pathLabel
        ? pathLabel + ' / ' + (child.title || child.url)
        : (child.title || child.url);
      bookmarks.push({ name, url: child.url });
    } else {
      const nextPath = child.title ? [...pathParts, child.title] : pathParts;
      bookmarks.push(...flattenNode(child, nextPath, showPath));
    }
  }
  return bookmarks;
}

function nativeBookmarksToCategories(tree, showPath) {
  const categories = [];
  let colorIdx = 0;

  function processRoot(rootNode) {
    if (!rootNode.children) return;
    const directBookmarks = rootNode.children
      .filter(c => c.url)
      .map(c => ({ name: c.title || c.url, url: c.url }));
    if (directBookmarks.length > 0) {
      categories.push({
        name: rootNode.title,
        color: CATEGORY_COLORS[colorIdx++ % CATEGORY_COLORS.length],
        bookmarks: directBookmarks,
      });
    }
    rootNode.children.filter(c => !c.url).forEach(folder => {
      const bookmarks = flattenNode(folder, [], showPath);
      if (bookmarks.length > 0) {
        categories.push({
          name: folder.title || 'Folder',
          color: CATEGORY_COLORS[colorIdx++ % CATEGORY_COLORS.length],
          bookmarks,
        });
      }
    });
  }

  if (tree[0] && tree[0].children) {
    tree[0].children.forEach(processRoot);
  }
  return categories;
}

function loadNativeBookmarks(showPath) {
  return new Promise(resolve => {
    if (!chrome.bookmarks) { resolve(null); return; }
    chrome.bookmarks.getTree(tree => {
      if (chrome.runtime.lastError || !tree) { resolve(null); return; }
      resolve(nativeBookmarksToCategories(tree, showPath));
    });
  });
}

/* ── Utilities ── */

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

function loadData() {
  return new Promise(resolve => {
    chrome.storage.sync.get(STORAGE_KEY, result => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveData(data) {
  return new Promise(resolve => {
    chrome.storage.sync.set({ [STORAGE_KEY]: data }, resolve);
  });
}

/* ── Render ── */

function renderGrid(categories) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  categories.forEach((cat, i) => {
    grid.appendChild(buildColumn(cat, i));
  });
}

function buildColumn(cat, index) {
  const rgb = hexToRgb(cat.color);
  const col = document.createElement('div');
  col.className = 'column';
  col.style.cssText = `--accent: ${cat.color}; --accent-rgb: ${rgb}; animation-delay: ${index * 40}ms`;

  const header = document.createElement('div');
  header.className = 'column-header';
  const bmCount = cat.bookmarks.filter(bm => bm.type !== 'separator').length;
  header.innerHTML = `
    <span class="column-dot"></span>
    <h2 class="column-title">${escHtml(cat.name)}</h2>
    <span class="column-count">${bmCount}</span>
  `;

  const list = document.createElement('div');
  list.className = 'bookmark-list';
  cat.bookmarks.forEach(bm => list.appendChild(buildBookmark(bm)));

  col.appendChild(header);
  col.appendChild(list);
  return col;
}

function buildBookmark(bm) {
  if (bm.type === 'separator') {
    const wrap = document.createElement('div');
    wrap.className = 'bookmark-separator';
    if (bm.label) {
      wrap.classList.add('bookmark-separator--labeled');
      wrap.innerHTML = `<span>${escHtml(bm.label)}</span>`;
    }
    return wrap;
  }
  const a = document.createElement('a');
  a.className = 'bookmark-item';
  a.href = bm.url;
  a.innerHTML = `
    <img class="favicon" src="${faviconUrl(bm.url)}" alt="" loading="lazy" onerror="this.style.display='none'">
    <span class="bookmark-name">${escHtml(bm.name)}</span>
  `;
  return a;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateStats(categories) {
  const total = categories.reduce((s, c) => s + c.bookmarks.filter(bm => bm.type !== 'separator').length, 0);
  document.getElementById('bookmark-total').textContent = total;
  document.getElementById('category-total').textContent = categories.length;
}

/* ── Clock & date ── */

const DAYS         = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS       = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

function greeting(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function tick() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  document.getElementById('clock-hm').textContent = pad(h) + ':' + pad(m);
  document.getElementById('clock-s').textContent  = ':' + pad(s);
  document.getElementById('greeting').textContent = greeting(h);
  document.getElementById('date-line').textContent =
    DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
}

function initClock() {
  tick();
  setInterval(tick, 1000);
}

/* ── Calendar ── */

function initCalendar() {
  const today = new Date();
  let calYear  = today.getFullYear();
  let calMonth = today.getMonth();

  function render(year, month) {
    document.getElementById('cal-month-label').textContent = MONTHS_SHORT[month] + ' ' + year;
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay     = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const isCurrent    = year === today.getFullYear() && month === today.getMonth();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'cal-day empty';
      grid.appendChild(el);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const el = document.createElement('div');
      el.className = 'cal-day' + (isCurrent && d === today.getDate() ? ' today' : '');
      el.textContent = d;
      grid.appendChild(el);
    }
  }

  render(calYear, calMonth);

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    render(calYear, calMonth);
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    render(calYear, calMonth);
  });
}

/* ── Search ── */

function initSearch() {
  const input     = document.getElementById('search');
  const noResults = document.getElementById('no-results');

  function doSearch(q) {
    const term = q.trim().toLowerCase();
    let anyVisible = false;

    document.querySelectorAll('.column').forEach(col => {
      let colVisible = false;
      col.querySelectorAll('.bookmark-item').forEach(item => {
        const name  = item.querySelector('.bookmark-name').textContent.toLowerCase();
        const match = !term || name.includes(term);
        item.classList.toggle('hidden', !match);
        if (match) colVisible = true;
      });
      col.classList.toggle('hidden', !colVisible);
      if (colVisible) anyVisible = true;
    });

    noResults.style.display = (!anyVisible && term) ? 'block' : 'none';
    document.getElementById('search-hint').style.display = term ? 'none' : '';
  }

  input.addEventListener('input', e => doSearch(e.target.value));

  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      doSearch('');
      input.blur();
    }
  });
}

/* ── Settings button ── */

function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

/* ── Storage change listener (live updates when options page saves) ── */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    const data = changes[STORAGE_KEY].newValue;
    if (!data) return;
    const settings = data.settings || {};
    if (settings.dataSource === 'native') {
      loadNativeBookmarks(settings.nativeShowPath || false).then(nativeCategories => {
        const categories = nativeCategories !== null ? nativeCategories : data.categories;
        renderGrid(categories);
        updateStats(categories);
      });
    } else {
      renderGrid(data.categories);
      updateStats(data.categories);
    }
  }
});

/* ── Init ── */

async function init() {
  let data = await loadData();
  if (!data) {
    data = DEFAULT_DATA;
    await saveData(data);
  }

  const settings = data.settings || {};
  let categories;
  if (settings.dataSource === 'native') {
    const nativeCategories = await loadNativeBookmarks(settings.nativeShowPath || false);
    categories = nativeCategories !== null ? nativeCategories : data.categories;
  } else {
    categories = data.categories;
  }

  renderGrid(categories);
  updateStats(categories);
  initClock();
  initCalendar();
  initSearch();
  initSettings();
}

init();
