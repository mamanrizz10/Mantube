// ===== MANTUBE APP =====
// API URL: otomatis deteksi local vs production
const API = (() => {
  const host = window.location.hostname;
  // Localhost → server lokal
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:8080/api';
  }
  // Production: cek apakah ada BACKEND_URL yang di-set
  if (window.BACKEND_URL) return window.BACKEND_URL;
  // Jika deploy di Vercel/Netlify tanpa backend terpisah:
  // Coba pakai origin yang sama (jika backend dan frontend satu server)
  return window.location.origin + '/api';
})();

// Cek apakah backend tersedia
let _backendAvailable = null;
async function checkBackend() {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const r = await fetch(API.replace('/api', '') + '/', { signal: AbortSignal.timeout(3000) });
    _backendAvailable = r.ok || r.status < 500;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

// Wrapper fetch yang tidak hang selamanya
async function apiFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10 detik timeout
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ===== STATE =====
let currentTab = 'beranda';
let prevTab = 'beranda';
let myFiles = JSON.parse(localStorage.getItem('myFiles') || '[]');
let quickSearchEnabled = localStorage.getItem('quickSearch') !== 'false';
let currentVideo = null;
let isSearching = false;
let lastQuery = '';
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
let searchDebounceTimer = null;
let currentSearchFilter = 'all';
let suggestionsVisible = false;

// ===== SAMPLE DATA =====
const SAMPLE_QUICK = [
  { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up', artist: 'Rick Astley', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi', thumb: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg' },
  { id: 'JGwWNGJdvx8', title: 'Shape of You', artist: 'Ed Sheeran', thumb: 'https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg' },
  { id: 'OPf0YbXqDm0', title: 'Mark Ronson - Uptown Funk ft. Bruno Mars', artist: 'Mark Ronson', thumb: 'https://i.ytimg.com/vi/OPf0YbXqDm0/mqdefault.jpg' },
  { id: 'hT_nvWreIhg', title: 'OneRepublic - Counting Stars', artist: 'OneRepublic', thumb: 'https://i.ytimg.com/vi/hT_nvWreIhg/mqdefault.jpg' },
  { id: 'YqeW9_5kURI', title: 'Justin Bieber - Baby ft. Ludacris', artist: 'Justin Bieber', thumb: 'https://i.ytimg.com/vi/YqeW9_5kURI/mqdefault.jpg' },
];

const SAMPLE_TRENDING = [
  { id: 'SlPhMPnQ58k', title: 'Trending Musik Indonesia', artist: 'Various Artists', thumb: 'https://i.ytimg.com/vi/SlPhMPnQ58k/mqdefault.jpg' },
  { id: 'CevxZvSJLk8', title: 'Katy Perry - Roar', artist: 'Katy Perry', thumb: 'https://i.ytimg.com/vi/CevxZvSJLk8/mqdefault.jpg' },
  { id: 'RgKAFK5djSk', title: 'Wiz Khalifa - See You Again', artist: 'Wiz Khalifa', thumb: 'https://i.ytimg.com/vi/RgKAFK5djSk/mqdefault.jpg' },
  { id: 'nfWlot6h_JM', title: 'Taylor Swift - Shake It Off', artist: 'Taylor Swift', thumb: 'https://i.ytimg.com/vi/nfWlot6h_JM/mqdefault.jpg' },
  { id: 'lp-EO5I60KA', title: 'Adele - Rolling in the Deep', artist: 'Adele', thumb: 'https://i.ytimg.com/vi/lp-EO5I60KA/mqdefault.jpg' },
  { id: 'bo_efYhYU2A', title: 'Maroon 5 - Sugar', artist: 'Maroon 5', thumb: 'https://i.ytimg.com/vi/bo_efYhYU2A/mqdefault.jpg' },
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Init bahasa dulu sebelum render
  if (typeof initLanguage === 'function') initLanguage();
  loadHomeFeed();
  renderMusicPage();
  // Baca file dari localStorage dulu (cepat), lalu sync server
  myFiles = lsGetFiles();
  renderFileList();
  loadFileList();
  setupSearch();
  setupPullToRefresh();   // ← pull-to-refresh
  const toggle = document.getElementById('quickSearchToggle');
  if (toggle) toggle.checked = quickSearchEnabled;
});

// ===== TAB SWITCHING =====
function switchTab(tab) {
  if (tab === currentTab) return;
  prevTab = currentTab;
  currentTab = tab;

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + tab);
  if (page) page.classList.add('active');

  // Show topbar only on beranda
  const topbar = document.getElementById('topbar');
  if (topbar) topbar.style.display = tab === 'beranda' ? '' : 'none';
  if (tab === 'files') loadFileList();
  if (tab === 'musik') {
    // Re-aktifkan drag scroll setelah render
    setTimeout(() => {
      document.querySelectorAll('.musik-hscroll').forEach(el => _enableDragScroll(el));
    }, 300);
  }
}

// ===== SEARCH SETUP =====
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  input.addEventListener('focus', () => {
    showSearchPage();
  });

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(searchDebounceTimer);
    if (!q) {
      renderSearchHistory();
      hideSuggestions();
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      if (quickSearchEnabled) fetchSuggestions(q);
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        hideSuggestions();
        doSearch(q);
      }
    }
    if (e.key === 'Escape') {
      hideSearchPage();
    }
  });
}

// ===== SEARCH PAGE OVERLAY =====
function showSearchPage() {
  let overlay = document.getElementById('searchOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'searchOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:80; background:#fff;
      display:flex; flex-direction:column; max-width:430px;
      margin:0 auto; left:0; right:0;
      animation: fadeInUp 0.18s ease;
    `;
    overlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #ebebeb;flex-shrink:0;">
        <button onclick="hideSearchPage()" style="background:none;border:none;cursor:pointer;padding:6px;color:#1a1a1a;display:flex;align-items:center;border-radius:50%;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="24" height="24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="flex:1;display:flex;align-items:center;background:#f5f5f5;border-radius:20px;padding:0 10px 0 14px;height:38px;gap:6px;">
          <input id="searchOverlayInput" type="text" placeholder="Cari video, musik, atau URL YouTube"
            style="flex:1;border:none;background:transparent;font-size:14px;color:#1a1a1a;outline:none;" autocomplete="off" />
          <button id="searchOverlayClear" onclick="clearSearchInput()" style="background:none;border:none;cursor:pointer;padding:2px;display:none;color:#888;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button onclick="doSearchFromOverlay()" style="background:none;border:none;cursor:pointer;padding:2px;color:#888;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
      </div>
      <div id="searchSuggestions" style="display:none;border-bottom:1px solid #ebebeb;flex-shrink:0;"></div>
      <div id="searchFilterBar" style="display:none;padding:8px 12px;gap:8px;overflow-x:auto;flex-shrink:0;white-space:nowrap;border-bottom:1px solid #ebebeb;"></div>
      <div id="searchBody" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>
    `;
    document.getElementById('app').appendChild(overlay);

    const overlayInput = overlay.querySelector('#searchOverlayInput');
    const clearBtn = overlay.querySelector('#searchOverlayClear');

    overlayInput.addEventListener('input', () => {
      const q = overlayInput.value.trim();
      clearBtn.style.display = q ? 'flex' : 'none';
      clearTimeout(searchDebounceTimer);
      if (!q) {
        hideSuggestions();
        renderSearchHistory();
        return;
      }
      searchDebounceTimer = setTimeout(() => {
        if (quickSearchEnabled) fetchSuggestions(q);
      }, 300);
    });

    overlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = overlayInput.value.trim();
        if (q) {
          hideSuggestions();
          doSearch(q);
        }
      }
    });
  }

  overlay.style.display = 'flex';
  const overlayInput = document.getElementById('searchOverlayInput');
  if (overlayInput) {
    // Copy value from topbar input
    const topInput = document.getElementById('searchInput');
    if (topInput && topInput.value) overlayInput.value = topInput.value;
    setTimeout(() => overlayInput.focus(), 50);
  }
  renderSearchHistory();
}

function hideSearchPage() {
  const overlay = document.getElementById('searchOverlay');
  if (overlay) overlay.style.display = 'none';
  // Blur topbar input
  const topInput = document.getElementById('searchInput');
  if (topInput) topInput.blur();
}

function clearSearchInput() {
  const input = document.getElementById('searchOverlayInput');
  const clearBtn = document.getElementById('searchOverlayClear');
  if (input) { input.value = ''; input.focus(); }
  if (clearBtn) clearBtn.style.display = 'none';
  hideSuggestions();
  renderSearchHistory();
  document.getElementById('searchFilterBar').style.display = 'none';
  document.getElementById('searchBody').innerHTML = '';
}

function doSearchFromOverlay() {
  const input = document.getElementById('searchOverlayInput');
  const q = input ? input.value.trim() : '';
  if (q) {
    hideSuggestions();
    doSearch(q);
  }
}

// ===== SEARCH EXECUTION =====
// Kata kunci musik yang ditambahkan otomatis ke query
const MUSIC_SUFFIX = ' musik lagu';

// Filter: hanya tampilkan hasil yang relevan musik
function _isMusicResult(v) {
  const title = (v.title || '').toLowerCase();
  const ch    = (v.channel || v.author || '').toLowerCase();
  // Exclude: gaming, berita, olahraga, tutorial, vlog non-musik
  const exclude = ['gaming', 'game', 'berita', 'news', 'tutorial', 'vlog', 'review', 'unboxing', 'olahraga', 'sport', 'film', 'movie', 'drama', 'sinetron', 'podcast', 'talk show'];
  for (const ex of exclude) {
    if (title.includes(ex) && !title.includes('musik') && !title.includes('lagu') && !title.includes('song')) return false;
  }
  return true;
}

async function doSearch(query, filter) {
  const q = (query || '').trim();
  if (!q) return;

  lastQuery = q;
  currentSearchFilter = filter || 'lagu'; // default musik

  const topInput = document.getElementById('searchInput');
  if (topInput) topInput.value = q;
  const overlayInput = document.getElementById('searchOverlayInput');
  if (overlayInput) overlayInput.value = q;

  saveSearchHistory(q);
  showSearchPage();
  hideSuggestions();

  renderMusicFilterBar(q);

  const body = document.getElementById('searchBody');
  if (body) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:14px;">
        <div class="spinner" style="width:32px;height:32px;border-width:3px;border-top-color:var(--red);"></div>
        <p style="font-size:14px;color:#606060;">Mencari musik "<strong>${escHtml(q)}</strong>"...</p>
      </div>`;
  }

  isSearching = true;
  try {
    // Tambahkan suffix musik agar hasil lebih relevan
    const musicQ = q.toLowerCase().includes('lagu') || q.toLowerCase().includes('musik') || q.toLowerCase().includes('song')
      ? q
      : q + MUSIC_SUFFIX;

    const res  = await apiFetch(`${API}/search?q=${encodeURIComponent(musicQ)}&limit=20`);
    const data = await res.json();
    let videos = (data.videos || []).filter(_isMusicResult);

    // Jika terlalu sedikit, coba tanpa filter ketat
    if (videos.length < 3) videos = data.videos || [];

    renderMusicSearchResults(videos, q);
  } catch (e) {
    const ytId = extractYouTubeId(q);
    if (ytId) {
      hideSearchPage();
      openVideo(ytId, { title: q, videoId: ytId });
    } else {
      renderNotFoundSearch(q);
    }
  } finally {
    isSearching = false;
  }
}

// ── Filter chips khusus musik ──
function renderMusicFilterBar(q) {
  const bar = document.getElementById('searchFilterBar');
  if (!bar) return;
  bar.style.display = 'flex';

  const filters = [
    { key: 'lagu',    label: '🎵 Lagu',    q: q + ' lagu' },
    { key: 'album',   label: '💿 Album',   q: q + ' full album' },
    { key: 'lirik',   label: '📝 Lirik',   q: q + ' lirik lyrics' },
    { key: 'live',    label: '🎤 Live',    q: q + ' live performance' },
    { key: 'cover',   label: '🎸 Cover',   q: q + ' cover akustik' },
    { key: 'remix',   label: '🎧 Remix',   q: q + ' remix' },
  ];

  bar.innerHTML = filters.map(f => `
    <button onclick="doSearchMusic('${escAttr(q)}','${escAttr(f.q)}','${f.key}')"
      style="display:inline-flex;align-items:center;gap:4px;padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:13px;font-weight:600;flex-shrink:0;white-space:nowrap;transition:all 0.15s;
      background:${currentSearchFilter === f.key ? 'var(--red)' : '#f2f2f2'};
      color:${currentSearchFilter === f.key ? '#fff' : '#0f0f0f'};">
      ${escHtml(f.label)}
    </button>
  `).join('');
}

async function doSearchMusic(origQ, musicQ, filterKey) {
  currentSearchFilter = filterKey;
  renderMusicFilterBar(origQ);

  const body = document.getElementById('searchBody');
  if (body) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:14px;">
        <div class="spinner" style="width:32px;height:32px;border-width:3px;border-top-color:var(--red);"></div>
        <p style="font-size:14px;color:#606060;">Mencari...</p>
      </div>`;
  }

  try {
    const res  = await apiFetch(`${API}/search?q=${encodeURIComponent(musicQ)}&limit=20`);
    const data = await res.json();
    renderMusicSearchResults(data.videos || [], origQ);
  } catch (e) {
    renderNotFoundSearch(origQ);
  }
}

// ── Render hasil pencarian musik ──
function renderMusicSearchResults(videos, query) {
  const body = document.getElementById('searchBody');
  if (!body) return;

  if (!videos || videos.length === 0) {
    renderNotFoundSearch(query);
    return;
  }

  body.innerHTML = `
    <div class="sr-header">
      <span class="sr-count">${videos.length} hasil untuk "<strong>${escHtml(query)}</strong>"</span>
    </div>
    <div class="sr-list">
      ${videos.map(v => musicSearchCardHTML(v)).join('')}
    </div>`;
}

function musicSearchCardHTML(v) {
  const id      = escAttr(v.id || v.videoId || '');
  const title   = escHtml(v.title || 'Tanpa Judul');
  const channel = escHtml(v.channel || v.author || '');
  const views   = v.views ? escHtml(v.views) : '';
  const time    = v.time  ? escHtml(v.time)  : '';
  const dur     = v.duration ? escHtml(v.duration) : '';
  const thumb   = escAttr(v.thumbnail || v.thumb || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
  const meta    = [views, time].filter(Boolean).join(' · ');
  const initial = (v.channel || v.author || 'M')[0].toUpperCase();
  const colors  = ['#c2185b','#7b1fa2','#1565c0','#2e7d32','#e65100','#00838f','#ad1457','#4527a0'];
  const color   = colors[initial.charCodeAt(0) % colors.length];

  return `
    <div class="sr-card" onclick='openVideoFromData(${JSON.stringify(v)})'>
      <!-- Thumbnail -->
      <div class="sr-thumb-wrap">
        <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.src='assets/thumb-placeholder.svg'" />
        ${dur ? `<span class="sr-duration">${dur}</span>` : ''}
        <!-- Play overlay -->
        <div class="sr-play-overlay">
          <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <!-- Info -->
      <div class="sr-info">
        <div class="sr-title">${title}</div>
        <div class="sr-channel-row">
          <div class="sr-avatar" style="background:${color};">${initial}</div>
          <span class="sr-channel">${channel}</span>
        </div>
        ${meta ? `<div class="sr-meta">${meta}</div>` : ''}
        <!-- Action buttons -->
        <div class="sr-actions">
          <button class="sr-btn sr-btn-dl"
            onclick="event.stopPropagation();openDownloadModal('${id}','${escAttr(v.title||'')}','${thumb}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Unduh
          </button>
          <button class="sr-btn sr-btn-share"
            onclick="event.stopPropagation();shareVideo('${id}','${escAttr(v.title||'')}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Bagikan
          </button>
        </div>
      </div>
    </div>`;
}

function openVideoFromData(v) {
  const id = v.id || v.videoId;
  if (!id) return;
  hideSearchPage();
  openVideo(id, v);
}

function renderNotFoundSearch(query) {
  const body = document.getElementById('searchBody');
  if (!body) return;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px;text-align:center;">
      <div style="width:72px;height:72px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="36" height="36"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div style="font-size:18px;font-weight:800;color:#0f0f0f;">Musik tidak ditemukan</div>
      <div style="font-size:14px;color:#606060;max-width:280px;line-height:1.5;">
        Tidak ada hasil musik untuk <strong>"${escHtml(query)}"</strong>.<br>Coba kata kunci lain.
      </div>
      <button onclick="clearSearchInput()"
        style="padding:10px 24px;background:var(--red);color:#fff;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;">
        Cari Lagi
      </button>
    </div>`;
}

// Keep old function name for compatibility
function renderFilterBar(q) { renderMusicFilterBar(q); }

// ===== AUTOCOMPLETE / SUGGESTIONS =====
async function fetchSuggestions(q) {
  if (!q) { hideSuggestions(); return; }
  try {
    const res = await apiFetch(`${API}/suggest?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const suggestions = Array.isArray(data) ? data : (data.suggestions || []);
    renderSuggestions(suggestions, q);
  } catch (e) {
    hideSuggestions();
  }
}

function renderSuggestions(suggestions, q) {
  const box = document.getElementById('searchSuggestions');
  if (!box) return;

  if (!suggestions || suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  box.style.display = 'block';
  suggestionsVisible = true;
  box.innerHTML = suggestions.slice(0, 8).map(s => {
    const text = typeof s === 'string' ? s : (s.query || s.text || '');
    return `
      <div onclick="doSearch('${escAttr(text)}')"
        style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background 0.1s;"
        onmouseenter="this.style.background='#f5f5f5'" onmouseleave="this.style.background=''">
        <svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span style="font-size:14px;color:#1a1a1a;flex:1;">${escHtml(text)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `;
  }).join('');
}

function hideSuggestions() {
  const box = document.getElementById('searchSuggestions');
  if (box) box.style.display = 'none';
  suggestionsVisible = false;
}

// ===== SEARCH HISTORY =====
function saveSearchHistory(q) {
  if (!q) return;
  searchHistory = searchHistory.filter(h => h !== q);
  searchHistory.unshift(q);
  if (searchHistory.length > 20) searchHistory = searchHistory.slice(0, 20);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

function renderSearchHistory() {
  const body = document.getElementById('searchBody');
  if (!body) return;

  if (searchHistory.length === 0) {
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:12px;color:#ccc;font-size:14px;text-align:center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Belum ada riwayat pencarian</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div style="padding:12px 0;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 16px 8px;">
        <span style="font-size:13px;font-weight:600;color:#888;">Pencarian Terakhir</span>
        <button onclick="clearHistory()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--red);font-weight:600;">Hapus Semua</button>
      </div>
      ${searchHistory.map((h, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid #f5f5f5;"
          onmouseenter="this.style.background='#f5f5f5'" onmouseleave="this.style.background=''">
          <div onclick="doSearch('${escAttr(h)}')" style="display:flex;align-items:center;gap:12px;flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" width="16" height="16"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
            <span style="font-size:14px;color:#1a1a1a;">${escHtml(h)}</span>
          </div>
          <button onclick="deleteHistory(${i})" style="background:none;border:none;cursor:pointer;padding:4px;color:#ccc;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function deleteHistory(index) {
  searchHistory.splice(index, 1);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  renderSearchHistory();
}

function clearHistory() {
  searchHistory = [];
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  renderSearchHistory();
}

// ===== HOME FEED — Pull-to-refresh + Infinite scroll + Musik Rekomendasi =====

// Query dikelompokkan per kategori — rotasi otomatis saat scroll bawah
const FEED_QUERY_GROUPS = [
  { label: null,                      queries: ['lagu hits indonesia terbaru 2025', 'musik indonesia populer 2025', 'top lagu indonesia april 2025'] },
  { label: '🎵 Musik Terbaru',        queries: ['lagu baru rilis indonesia 2025', 'single terbaru indonesia april 2025', 'new release musik indonesia 2025'] },
  { label: '🔥 Trending Sekarang',    queries: ['lagu viral tiktok indonesia 2025', 'trending musik indonesia minggu ini', 'lagu viral shorts indonesia 2025'] },
  { label: '🎤 Artis Populer',        queries: ['Raim Laode lagu terbaru 2025', 'Mahalini lagu terbaru 2025', 'Rizky Febian lagu terbaru 2025'] },
  { label: '🎶 Rekomendasi Untukmu',  queries: ['playlist musik santai indonesia 2025', 'lagu enak didengar sambil kerja 2025', 'musik relaksasi indonesia terbaru'] },
  { label: '📻 Viral di Shorts',      queries: ['lagu viral shorts musik indonesia 2025', 'short music video viral indonesia', 'lagu pendek viral tiktok 2025'] },
  { label: '🏆 Top Chart Musik',      queries: ['top chart musik indonesia 2025', 'spotify top hits indonesia 2025', 'lagu terpopuler indonesia chart 2025'] },
  { label: '🎸 Pop Indonesia',        queries: ['pop indonesia terbaru 2025', 'lagu pop hits indonesia 2025', 'pop melayu viral 2025'] },
  { label: '🥁 Dangdut & Koplo',      queries: ['dangdut viral 2025 indonesia', 'koplo hits terbaru 2025', 'lagu dangdut populer 2025'] },
  { label: '🌟 Rilis Baru Minggu Ini',queries: ['lagu baru minggu ini indonesia 2025', 'album baru indonesia april 2025', 'musik indonesia rilis terbaru'] },
  { label: '💿 Nostalgia & Klasik',   queries: ['lagu nostalgia indonesia terbaik', 'hits indonesia 2000an populer', 'lagu lawas indonesia enak didengar'] },
  { label: '🎼 Akustik & Cover',      queries: ['cover lagu viral indonesia 2025', 'akustik lagu indonesia terbaru', 'cover akustik hits indonesia 2025'] },
  { label: '🌙 Musik Malam',          queries: ['lagu malam santai indonesia 2025', 'musik slow indonesia terbaru', 'lagu galau hits indonesia 2025'] },
  { label: '☀️ Musik Pagi',           queries: ['lagu pagi hari enak indonesia 2025', 'musik semangat pagi indonesia', 'lagu motivasi indonesia terbaru 2025'] },
  { label: '🎹 Ballad & Slow',        queries: ['lagu ballad indonesia terbaru 2025', 'slow song indonesia hits 2025', 'lagu romantis indonesia 2025'] },
];

let _feedVideos      = [];
let _feedPage        = 0;
let _feedLoading     = false;
let _feedHasMore     = true;
let _feedGroupIdx    = 0;
let _feedQueryInGroup= 0;
let _pullStartY      = 0;
let _pullRefreshing  = false;

function _nextFeedQuery() {
  const group = FEED_QUERY_GROUPS[_feedGroupIdx % FEED_QUERY_GROUPS.length];
  const q     = group.queries[_feedQueryInGroup % group.queries.length];
  const label = group.label;
  _feedQueryInGroup++;
  if (_feedQueryInGroup >= group.queries.length) {
    _feedQueryInGroup = 0;
    _feedGroupIdx++;
  }
  return { q, label };
}

async function loadHomeFeed(reset = true) {
  if (_feedLoading) return;
  _feedLoading = true;

  const feed = document.getElementById('videoFeed');
  if (!feed) { _feedLoading = false; return; }

  if (reset) {
    _feedVideos       = [];
    _feedPage         = 0;
    _feedHasMore      = true;
    _feedGroupIdx     = 0;
    _feedQueryInGroup = 0;
    showLoadingFeed('Memuat video terbaru...');
  }

  try {
    const { q, label } = _nextFeedQuery();
    const res  = await apiFetch(`${API}/search?q=${encodeURIComponent(q)}&limit=15`);

    // Jika server tidak merespons dengan benar
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();

    const newVideos = (data.videos || []).filter(v => {
      const id = v.id || v.videoId;
      return id && !_feedVideos.find(x => (x.id || x.videoId) === id);
    });

    _feedVideos = [..._feedVideos, ...newVideos];
    _feedPage++;
    _feedHasMore = true;

    document.getElementById('feedSentinel')?.remove();
    document.querySelector('.pull-indicator')?.remove();
    document.querySelector('.refresh-indicator')?.remove();

    if (reset) feed.innerHTML = '';

    if (label && newVideos.length > 0) {
      const labelEl = document.createElement('div');
      labelEl.className = 'feed-section-label';
      labelEl.textContent = label;
      feed.appendChild(labelEl);
    }

    newVideos.forEach(v => {
      const div = document.createElement('div');
      div.innerHTML = videoCardHTML(v);
      while (div.firstChild) feed.appendChild(div.firstChild);
    });

    if (_feedVideos.length === 0) {
      feed.innerHTML = `<div class="loading-state"><p>Tidak ada video. Coba refresh.</p><button class="not-found-btn" onclick="loadHomeFeed()">Refresh</button></div>`;
    } else {
      const sentinel = document.createElement('div');
      sentinel.id = 'feedSentinel';
      sentinel.style.cssText = 'height:1px;overflow:hidden;';
      feed.appendChild(sentinel);
      _observeSentinel(sentinel);
    }

  } catch (e) {
    if (reset) {
      // Cek apakah ini masalah koneksi ke backend
      const isOffline = e.name === 'AbortError' || e.message.includes('fetch') || e.message.includes('Failed');
      feed.innerHTML = `
        <div class="loading-state" style="padding:40px 20px;text-align:center;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="56" height="56" style="margin-bottom:16px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style="font-size:16px;font-weight:700;color:#0f0f0f;margin-bottom:8px;">
            ${isOffline ? 'Server tidak tersedia' : 'Gagal memuat'}
          </p>
          <p style="font-size:13px;color:#606060;margin-bottom:20px;line-height:1.5;">
            ${isOffline
              ? 'Backend server belum berjalan.<br>Jalankan: <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;">node muka_app/server.js</code>'
              : 'Periksa koneksi internet kamu.'}
          </p>
          <button class="not-found-btn" onclick="loadHomeFeed()">Coba Lagi</button>
        </div>`;
    } else {
      setTimeout(() => { _feedLoading = false; loadHomeFeed(false); }, 3000);
    }
  } finally {
    _feedLoading = false;
  }
}

// ── Infinite scroll via IntersectionObserver ──
let _feedObserver = null;
function _observeSentinel(el) {
  if (_feedObserver) _feedObserver.disconnect();
  _feedObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !_feedLoading) {
      // Sembunyikan sentinel saat mulai load
      const s = document.getElementById('feedSentinel');
      if (s) s.style.visibility = 'hidden';
      loadHomeFeed(false);
    }
  }, { rootMargin: '200px', threshold: 0 });
  _feedObserver.observe(el);
}

// ── Pull-to-refresh ──
function setupPullToRefresh() {
  const pageEl = document.getElementById('page-beranda');
  if (!pageEl) return;

  let pullIndicator = null;
  let _startY = 0;

  pageEl.addEventListener('touchstart', e => {
    const feedEl = document.getElementById('videoFeed');
    if (!feedEl || feedEl.scrollTop > 0) return;
    _startY = e.touches[0].clientY;
  }, { passive: true });

  pageEl.addEventListener('touchmove', e => {
    if (_pullRefreshing) return;
    const feedEl = document.getElementById('videoFeed');
    if (!feedEl || feedEl.scrollTop > 0) return;
    const dy = e.touches[0].clientY - _startY;
    if (dy < 30) return;

    if (!pullIndicator) {
      pullIndicator = document.createElement('div');
      pullIndicator.className = 'pull-indicator';
      feedEl.prepend(pullIndicator);
    }
    const pct = Math.min((dy - 30) / 60, 1);
    pullIndicator.style.height = Math.min(dy - 20, 64) + 'px';
    pullIndicator.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" width="22" height="22"
        style="transform:rotate(${pct * 360}deg);opacity:${pct};">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      <span style="font-size:12px;color:#606060;margin-left:6px;">${pct >= 1 ? 'Lepas untuk refresh' : 'Tarik untuk refresh'}</span>`;
  }, { passive: true });

  pageEl.addEventListener('touchend', async () => {
    if (!pullIndicator) return;
    const h = parseInt(pullIndicator.style.height || '0');
    pullIndicator.remove();
    pullIndicator = null;

    if (h >= 50 && !_pullRefreshing) {
      _pullRefreshing = true;
      const feedEl = document.getElementById('videoFeed');
      if (feedEl) {
        const ri = document.createElement('div');
        ri.className = 'refresh-indicator';
        ri.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;border-top-color:var(--red);"></div><span>Memperbarui feed...</span>`;
        feedEl.prepend(ri);
      }
      await new Promise(r => setTimeout(r, 500));
      document.querySelector('.refresh-indicator')?.remove();
      await loadHomeFeed(true);
      _pullRefreshing = false;
      showToast('✅ Feed diperbarui');
    }
  }, { passive: true });
}

function renderFeed(videos) {
  const feed = document.getElementById('videoFeed');
  if (!feed) return;
  if (!videos || videos.length === 0) {
    feed.innerHTML = `
      <div class="loading-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="48" height="48"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <p>Cari video atau tempel URL YouTube di atas</p>
      </div>`;
    return;
  }
  feed.innerHTML = videos.map(v => videoCardHTML(v)).join('');
}

function showLoadingFeed(msg) {
  const feed = document.getElementById('videoFeed');
  if (!feed) return;
  feed.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${escHtml(msg || 'Memuat...')}</p></div>`;
}

function renderNotFound(query) {
  const feed = document.getElementById('videoFeed');
  if (!feed) return;
  feed.innerHTML = `
    <div class="not-found-state">
      <div class="not-found-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="64" height="64"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <div class="not-found-title">Tidak ditemukan</div>
      <div class="not-found-sub">Tidak ada hasil untuk "<strong>${escHtml(query)}</strong>"</div>
      <button class="not-found-btn" onclick="loadHomeFeed()">Kembali ke Beranda</button>
    </div>`;
}

function videoCardHTML(v) {
  const id      = escAttr(v.id || v.videoId || '');
  const title   = escHtml(v.title || 'Tanpa Judul');
  const channel = escHtml(v.channel || v.channelTitle || v.author || '');
  const views   = v.views ? escHtml(v.views) : '';
  const time    = v.time  ? escHtml(v.time)  : '';
  const dur     = v.duration ? escHtml(v.duration) : '';
  const thumb   = escAttr(v.thumbnail || v.thumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  const initial = (v.channel || v.channelTitle || v.author || 'M')[0].toUpperCase();
  const colors  = ['#f57c00','#2e7d32','#7b1fa2','#1565c0','#c2185b','#e53935','#00838f','#6d4c41','#ad1457','#4527a0'];
  const color   = colors[initial.charCodeAt(0) % colors.length];
  const meta    = [channel, views, time].filter(Boolean).join(' · ');
  const dataStr = JSON.stringify(v);

  return `
    <div class="video-card">
      <!-- Thumbnail 16:9 penuh lebar -->
      <div class="video-thumb-wrap" onclick='openVideoFromData(${dataStr})'>
        <img src="${thumb}" alt="${title}" loading="lazy"
          onerror="this.src='assets/thumb-placeholder.svg'" />
        ${dur ? `<span class="video-duration">${dur}</span>` : ''}
      </div>
      <!-- Info row: avatar kecil + judul + tombol -->
      <div class="video-info">
        <div class="video-avatar" style="background:${color};" onclick='openVideoFromData(${dataStr})'>${initial}</div>
        <div class="video-meta" onclick='openVideoFromData(${dataStr})'>
          <div class="video-title">${title}</div>
          <div class="video-sub">${escHtml(meta)}</div>
        </div>
        <div class="video-actions-col">
          <button class="vid-action-btn vid-dl" onclick="openDownloadModal('${id}','${escAttr(v.title||'')}','${thumb}')" title="Unduh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="19" height="19">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="vid-action-btn" onclick="shareVideo('${id}','${escAttr(v.title||'')}')" title="Bagikan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

function showVideoMenu(id, title, thumb) {
  let sheet = document.getElementById('videoMenuSheet');
  if (sheet) sheet.remove();
  sheet = document.createElement('div');
  sheet.id = 'videoMenuSheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;';
  sheet.innerHTML = `
    <div style="background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 32px;width:100%;max-width:430px;animation:slideUp 0.22s ease;">
      <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(title)}</div>
      <button onclick="openDownloadModal('${escAttr(id)}','${escAttr(title)}','${escAttr(thumb)}');document.getElementById('videoMenuSheet').remove();"
        style="display:flex;align-items:center;gap:14px;width:100%;padding:14px 0;background:none;border:none;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:15px;color:#1a1a1a;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Unduh
      </button>
      <button onclick="shareVideo('${escAttr(id)}','${escAttr(title)}');document.getElementById('videoMenuSheet').remove();"
        style="display:flex;align-items:center;gap:14px;width:100%;padding:14px 0;background:none;border:none;cursor:pointer;font-size:15px;color:#1a1a1a;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Bagikan
      </button>
      <button onclick="document.getElementById('videoMenuSheet').remove();"
        style="width:100%;margin-top:12px;padding:13px;background:none;border:1px solid #ebebeb;border-radius:12px;font-size:14px;color:#888;cursor:pointer;">
        Batal
      </button>
    </div>`;
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  document.getElementById('app').appendChild(sheet);
}

// ===== MUSIK PAGE =====
function renderMusicPage() {
  loadMusicPage();
}

async function loadMusicPage() {
  // Tampilkan skeleton dulu
  _musikSkeleton('musikTrendingShorts', 'list');
  _musikSkeleton('musikTrendingNew',    'cards');
  _musikSkeleton('musikHitsIndo',       'cards');
  _musikSkeleton('musikRilisBaru',      'cards');
  _musikSkeleton('musikFavorit',        'cards');

  // Query YouTube yang relevan dan fresh (seperti YouTube Music)
  const queries = {
    shorts:   'trending shorts musik indonesia 2025',
    newTrend: 'lagu viral tiktok indonesia terbaru 2025',
    hits:     'top hits musik indonesia 2025 populer',
    rilis:    'lagu baru rilis indonesia april 2025',
    favorit:  'lagu indonesia terbaik sepanjang masa nostalgia',
  };

  const fetchSection = async (q, limit = 12) => {
    try {
      const res  = await apiFetch(`${API}/search?q=${encodeURIComponent(q)}&limit=${limit}`);
      const data = await res.json();
      return (data.videos || []).slice(0, limit);
    } catch { return []; }
  };

  // Fetch semua paralel
  const [shorts, newTrend, hits, rilis, favorit] = await Promise.all([
    fetchSection(queries.shorts,  12),
    fetchSection(queries.newTrend, 10),
    fetchSection(queries.hits,     10),
    fetchSection(queries.rilis,    10),
    fetchSection(queries.favorit,  10),
  ]);

  _renderShortsList('musikTrendingShorts', shorts);
  _renderHscrollCards('musikTrendingNew',  newTrend);
  _renderHscrollCards('musikHitsIndo',     hits);
  _renderAlbumCards('musikRilisBaru',      rilis);
  _renderHscrollCards('musikFavorit',      favorit);

  // Aktifkan drag-to-scroll pada semua hscroll
  document.querySelectorAll('.musik-hscroll').forEach(el => _enableDragScroll(el));
}

function _musikSkeleton(id, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (type === 'list') {
    el.innerHTML = Array(6).fill(0).map(() => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid #f0f0f0;">
        <div class="shimmer" style="width:52px;height:52px;border-radius:6px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="shimmer" style="height:12px;width:85%;margin-bottom:6px;"></div>
          <div class="shimmer" style="height:10px;width:60%;"></div>
        </div>
      </div>`).join('');
  } else {
    el.innerHTML = Array(4).fill(0).map(() => `
      <div style="flex-shrink:0;width:130px;">
        <div class="shimmer" style="width:130px;height:130px;border-radius:10px;margin-bottom:8px;"></div>
        <div class="shimmer" style="height:12px;width:90%;margin-bottom:5px;"></div>
        <div class="shimmer" style="height:10px;width:65%;"></div>
      </div>`).join('');
  }
}

function _renderShortsList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="padding:16px;color:#aaa;font-size:13px;text-align:center;">Tidak ada data</div>'; return; }
  el.innerHTML = items.map(v => {
    const vid   = escAttr(v.id || v.videoId || '');
    const title = escHtml(v.title || 'Tanpa Judul');
    const ch    = escHtml(v.channel || v.author || '');
    const views = v.views ? escHtml(v.views) : '';
    const thumb = escAttr(v.thumb || v.thumbnail || `https://i.ytimg.com/vi/${vid}/default.jpg`);
    return `
      <div class="musik-shorts-item" onclick='openVideoFromData(${JSON.stringify(v)})'>
        <div class="musik-shorts-thumb">
          <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.src='assets/thumb-placeholder.svg'" />
        </div>
        <div class="musik-shorts-info">
          <div class="musik-shorts-title">${title}</div>
          <div class="musik-shorts-sub">${ch}${views ? ' · ' + views : ''}</div>
        </div>
        <button class="musik-shorts-dl"
          onclick="event.stopPropagation();openDownloadModal('${vid}','${escAttr(v.title||'')}','${thumb}')"
          title="Unduh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

function _renderHscrollCards(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="padding:16px;color:#aaa;font-size:13px;">Tidak ada data</div>'; return; }
  el.innerHTML = items.map(v => {
    const vid   = escAttr(v.id || v.videoId || '');
    const title = escHtml(v.title || 'Tanpa Judul');
    const ch    = escHtml(v.channel || v.author || '');
    const views = v.views ? escHtml(v.views) : '';
    const thumb = escAttr(v.thumb || v.thumbnail || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`);
    return `
      <div class="musik-card-sq" onclick='openVideoFromData(${JSON.stringify(v)})'>
        <div class="musik-card-sq-thumb">
          <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.src='assets/thumb-placeholder.svg'" />
        </div>
        <div class="musik-card-sq-title">${title}</div>
        <div class="musik-card-sq-sub">${ch}${views ? '<br>' + views : ''}</div>
      </div>`;
  }).join('');
}

function _renderAlbumCards(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div style="padding:16px;color:#aaa;font-size:13px;">Tidak ada data</div>'; return; }
  el.innerHTML = items.map(v => {
    const vid   = escAttr(v.id || v.videoId || '');
    const title = escHtml(v.title || 'Tanpa Judul');
    const ch    = escHtml(v.channel || v.author || '');
    const thumb = escAttr(v.thumb || v.thumbnail || `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`);
    return `
      <div class="musik-card-album" onclick='openVideoFromData(${JSON.stringify(v)})'>
        <div class="musik-card-album-thumb">
          <img src="${thumb}" alt="${title}" loading="lazy" onerror="this.src='assets/thumb-placeholder.svg'" />
        </div>
        <div class="musik-card-album-title">${title}</div>
        <div class="musik-card-album-sub">${ch}</div>
      </div>`;
  }).join('');
}

// Keep old functions for compatibility (not used anymore)
function renderQuickListSkeleton() {}
function renderTrendingGridSkeleton() {}
function renderQuickList() {}
function renderTrendingGrid() {}
function loadMusicTrending() { loadMusicPage(); }

// ── Drag-to-scroll untuk mouse (desktop) ──
function _enableDragScroll(el) {
  if (!el || el._dragEnabled) return;
  el._dragEnabled = true;
  let isDown = false, startX = 0, scrollLeft = 0;

  el.addEventListener('mousedown', e => {
    isDown = true;
    el.style.cursor = 'grabbing';
    startX     = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
    e.preventDefault();
  });
  el.addEventListener('mouseleave', () => { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup',    () => { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  e => {
    if (!isDown) return;
    e.preventDefault();
    const x    = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  });
}

// ===== FILE LIST — dari localStorage =====
async function loadFileList() {
  myFiles = lsGetFiles();
  // Sinkronisasi dengan server juga (jika ada)
  try {
    const res  = await apiFetch(`${API}/files`);
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      // Merge: server files yang belum ada di localStorage
      const lsIds = new Set(myFiles.map(f => f.videoId + f.format));
      for (const sf of data.files) {
        const key = sf.videoId + sf.format;
        if (!lsIds.has(key)) {
          myFiles.push({
            videoId:     sf.videoId,
            title:       sf.title,
            channel:     sf.channel || '',
            thumb:       sf.thumb,
            format:      sf.format,
            filename:    sf.filename,
            size:        sf.size || '—',
            duration:    sf.duration || '—',
            downloadedAt: sf.downloadedAt || new Date().toISOString(),
          });
        }
      }
      lsSaveFiles(myFiles);
    }
  } catch (e) { /* offline — pakai localStorage saja */ }
  renderFileList();
}

function renderFileList() {
  const list       = document.getElementById('fileList');
  const countBadge = document.getElementById('fileCount');
  if (!list) return;

  // Selalu baca dari localStorage
  myFiles = lsGetFiles();
  if (countBadge) countBadge.textContent = myFiles.length;

  if (myFiles.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" width="64" height="64">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <p>Belum ada file yang diunduh</p>
      </div>`;
    return;
  }

  list.innerHTML = myFiles.map((f, i) => {
    const thumb = escAttr(f.thumb || `https://i.ytimg.com/vi/${f.videoId}/mqdefault.jpg`);
    const date  = f.downloadedAt
      ? new Date(f.downloadedAt).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    return `
    <div class="file-item">
      <div class="file-vinyl" onclick="playFile(${i})">
        <img src="${thumb}" alt="${escHtml(f.title||'')}" onerror="this.src='assets/thumb-placeholder.svg'" />
        <div class="vinyl-overlay">
          <div class="vinyl-disc"></div>
        </div>
      </div>
      <div class="file-info" onclick="playFile(${i})">
        <div class="file-title">${escHtml(f.title||'Tanpa Judul')}</div>
        <div class="file-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <span>${escHtml(f.format||'—')} · ${escHtml(f.size||'—')} · ${escHtml(f.duration||'—')}</span>
        </div>
        <div class="file-date">${escHtml(date)}</div>
      </div>
      <button class="file-more" onclick="showFileMenu(${i})" title="Opsi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="12" cy="19" r="1" fill="currentColor"/>
        </svg>
      </button>
    </div>`;
  }).join('');
}

function saveFiles() { lsSaveFiles(myFiles); }

// ===== DOWNLOAD MODAL =====
let _modalVideoId = null;
let _modalVideoTitle = null;
let _modalVideoThumb = null;

// ===== DOWNLOAD MODAL (NEW) =====
let _selectedFormat = null; // { itag, type, ext, label, size }

async function openDownloadModal(id, title, thumb) {
  _modalVideoId    = id;
  _modalVideoTitle = title;
  _modalVideoThumb = thumb;
  _selectedFormat  = null;

  const modal = document.getElementById('downloadModal');
  if (!modal) return;

  // Set thumbnail & judul
  const thumbEl = document.getElementById('modalThumb2');
  const titleEl = document.getElementById('modalVideoTitle2');
  const ytLink  = document.getElementById('modalYtLinkText');
  const dlBtn   = document.getElementById('modalDownloadBtn');

  if (thumbEl) thumbEl.src = thumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  if (titleEl) titleEl.textContent = title || 'Video';
  if (ytLink)  ytLink.textContent  = `youtube.com/watch?v=${id}`;
  if (dlBtn)   dlBtn.disabled = true;

  // Set link YouTube
  const ytLinkEl = document.getElementById('modalYtLink');
  if (ytLinkEl) {
    ytLinkEl.onclick = () => window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
  }

  // Tampilkan loading
  const body = document.getElementById('modalFormatBody');
  if (body) body.innerHTML = `<div class="mdl-loading"><div class="spinner"></div><span>Memuat format tersedia...</span></div>`;

  modal.classList.add('open');

  // Fetch format list dari server
  try {
    const res  = await apiFetch(`${API}/formats?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderFormatList(data);
  } catch (e) {
    // Fallback: tampilkan format default
    renderFormatListFallback(id, title, thumb);
  }
}

function renderFormatList(data) {
  const body = document.getElementById('modalFormatBody');
  if (!body) return;

  // Update info dari server
  const thumbEl = document.getElementById('modalThumb2');
  const titleEl = document.getElementById('modalVideoTitle2');
  if (thumbEl && data.thumb) thumbEl.src = data.thumb;
  if (titleEl && data.title) titleEl.textContent = data.title;
  _modalVideoTitle = data.title || _modalVideoTitle;
  _modalVideoThumb = data.thumb || _modalVideoThumb;

  const audio = data.audio || [];
  const video = data.video || [];

  body.innerHTML = `
    ${audio.length ? `
    <div class="mdl-section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      Musik
    </div>
    <div class="mdl-format-grid">
      ${audio.map(f => `
        <div class="mdl-format-card" onclick="selectFormat(this,'${f.itag}','${f.type}','${escAttr(f.ext)}','${escAttr(f.label)}','${escAttr(f.size)}')">
          <div class="fmt-name">${escHtml(f.ext)}</div>
          <div class="fmt-name" style="font-size:11px;font-weight:600;color:#606060;">(${f.bitrate || '?'}kbps)</div>
          <div class="fmt-size">${escHtml(f.size)}</div>
          <div class="fmt-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    ${video.length ? `
    <div class="mdl-section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" width="18" height="18"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      Video
    </div>
    <div class="mdl-format-grid">
      ${video.map(f => `
        <div class="mdl-format-card" onclick="selectFormat(this,'${f.itag}','${f.type}','${escAttr(f.ext)}','${escAttr(f.label)}','${escAttr(f.size)}')">
          <div class="fmt-name">${escHtml(f.label)}</div>
          <div class="fmt-size">${escHtml(f.size)}</div>
          <div class="fmt-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

function renderFormatListFallback(id, title, thumb) {
  const body = document.getElementById('modalFormatBody');
  if (!body) return;
  body.innerHTML = `
    <div class="mdl-section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      Musik
    </div>
    <div class="mdl-format-grid">
      <div class="mdl-format-card" onclick="selectFormat(this,'audio_128','audio','M4A','M4A (128kbps)','~')">
        <div class="fmt-name">M4A</div>
        <div class="fmt-name" style="font-size:11px;font-weight:600;color:#606060;">(128kbps)</div>
        <div class="fmt-size">~</div>
        <div class="fmt-check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg></div>
      </div>
    </div>
    <div class="mdl-section-label">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.2" width="18" height="18"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      Video
    </div>
    <div class="mdl-format-grid">
      <div class="mdl-format-card" onclick="selectFormat(this,'video_360','video','MP4','MP4 (360p)','~')">
        <div class="fmt-name">MP4 (360p)</div>
        <div class="fmt-size">~</div>
        <div class="fmt-check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg></div>
      </div>
      <div class="mdl-format-card" onclick="selectFormat(this,'video_720','video','MP4','MP4 (720p)','~')">
        <div class="fmt-name">MP4 (720p)</div>
        <div class="fmt-size">~</div>
        <div class="fmt-check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg></div>
      </div>
    </div>
  `;
}

function selectFormat(el, itag, type, ext, label, size) {
  // Deselect semua
  document.querySelectorAll('.mdl-format-card').forEach(c => c.classList.remove('selected'));
  // Select yang diklik
  el.classList.add('selected');
  _selectedFormat = { itag, type, ext, label, size };
  // Enable tombol unduh
  const btn = document.getElementById('modalDownloadBtn');
  if (btn) btn.disabled = false;
}

function closeModal() {
  const modal = document.getElementById('downloadModal');
  if (modal) modal.classList.remove('open');
  _selectedFormat = null;
}

async function startDownloadSelected() {
  if (!_selectedFormat || !_modalVideoId) return;
  const format = _selectedFormat.type === 'audio' ? 'audio' : 'video';
  closeModal();
  await startDownload(format, _selectedFormat.itag);
}

// ===== DOWNLOAD SYSTEM =====
// Key localStorage
const LS_FILES_KEY = 'mantube_files_v2';

function lsGetFiles() {
  try { return JSON.parse(localStorage.getItem(LS_FILES_KEY) || '[]'); } catch { return []; }
}
function lsSaveFiles(arr) {
  localStorage.setItem(LS_FILES_KEY, JSON.stringify(arr));
}
function lsAddFile(entry) {
  const arr = lsGetFiles();
  // Hindari duplikat (videoId + format sama)
  const filtered = arr.filter(f => !(f.videoId === entry.videoId && f.format === entry.format));
  filtered.unshift(entry);
  lsSaveFiles(filtered);
}
function lsDeleteFile(index) {
  const arr = lsGetFiles();
  arr.splice(index, 1);
  lsSaveFiles(arr);
}
function lsDeleteAll() {
  lsSaveFiles([]);
}

async function startDownload(format, itag) {
  if (!_modalVideoId) return;
  closeModal();

  const id    = _modalVideoId;
  const title = _modalVideoTitle || 'video';
  const thumb = _modalVideoThumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const ext   = format === 'audio' ? 'm4a' : 'mp4';
  const label = format === 'audio' ? 'M4A' : 'MP4';

  // Tampilkan progress overlay
  const overlay   = document.getElementById('progressOverlay');
  const bar       = document.getElementById('progressBar');
  const pct       = document.getElementById('progressPercent');
  const progTitle = document.getElementById('progressVideoTitle');
  const progMsg   = document.getElementById('progressMsg');

  if (overlay)   overlay.style.display = 'flex';
  if (progTitle) progTitle.textContent  = title;
  if (bar)       bar.style.width        = '10%';
  if (pct)       pct.textContent        = '10%';
  if (progMsg)   progMsg.textContent    = 'Memulai unduhan...';

  const itagParam = itag ? `&itag=${encodeURIComponent(itag)}` : '';
  const dlUrl = `${API}/stream-download?id=${encodeURIComponent(id)}&format=${format}${itagParam}`;

  try {
    // ── Cek dulu apakah server bisa menjangkau video ──
    if (progMsg) progMsg.textContent = 'Menghubungi server...';

    // Animasi progress palsu
    let prog = 10;
    const ticker = setInterval(() => {
      prog = Math.min(prog + 1, 40);
      if (bar) bar.style.width = prog + '%';
      if (pct) pct.textContent = Math.round(prog) + '%';
    }, 500);

    // Trigger download langsung via <a> tag — browser handle natively
    // Ini cara paling reliable: tidak perlu load ke memory
    const a = document.createElement('a');
    a.href     = dlUrl;
    a.download = `${title}.${ext}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Simulasi progress setelah trigger
    clearInterval(ticker);
    if (progMsg) progMsg.textContent = 'Mengunduh... (cek folder Downloads)';

    // Animasi progress sampai selesai
    let prog2 = 40;
    const ticker2 = setInterval(() => {
      prog2 = Math.min(prog2 + Math.random() * 5 + 1, 95);
      if (bar) bar.style.width = prog2 + '%';
      if (pct) pct.textContent = Math.round(prog2) + '%';
    }, 800);

    // Tutup overlay setelah 4 detik (download sudah berjalan di background browser)
    await new Promise(r => setTimeout(r, 4000));
    clearInterval(ticker2);

    if (bar) bar.style.width = '100%';
    if (pct) pct.textContent = '100%';
    if (progMsg) progMsg.textContent = 'Unduhan dimulai!';

    await new Promise(r => setTimeout(r, 600));
    if (overlay) overlay.style.display = 'none';

    // Simpan ke File Saya (localStorage)
    const filename = `${title}.${ext}`;
    lsAddFile({
      videoId:      id,
      title,
      channel:      '',
      thumb,
      format:       label,
      filename,
      size:         '—',
      duration:     '—',
      downloadedAt: new Date().toISOString(),
    });

    showToast(`✅ Mengunduh: ${filename.substring(0, 40)}...`);
    _refreshFileTab();

  } catch (e) {
    if (overlay) overlay.style.display = 'none';
    showToast('❌ Gagal: ' + e.message);
    console.error('Download error:', e);
  }
}

function _triggerBrowserDownload(url, filename) {
  const a = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
}

function _refreshFileTab() {
  myFiles = lsGetFiles();
  renderFileList();
  // Pindah ke tab File Saya
  switchTab('files');
}

// ===== VIDEO PLAYER =====
let _liked = false;

async function openVideo(videoId, videoData) {
  if (!videoId) return;
  currentVideo = { id: videoId, ...(videoData || {}) };
  _liked = false;

  // Sembunyikan mini player saat buka full player
  hideMiniPlayer();

  const playerPage = document.getElementById('page-player');
  if (!playerPage) return;

  playerPage.style.display = 'flex';
  playerPage.offsetHeight; // force reflow
  playerPage.classList.add('slide-in');

  // Embed YouTube iframe autoplay dengan enablejsapi=1
  const embedEl = document.getElementById('playerEmbed');
  if (embedEl) {
    _embedYT(embedEl, videoId, true);
  }

  // Render info awal dari cache
  if (videoData) renderPlayerInfo(videoData);

  // Load full info dari API
  try {
    const res  = await apiFetch(`${API}/info?id=${encodeURIComponent(videoId)}`);
    const info = await res.json();
    if (!info.error) {
      currentVideo = { ...currentVideo, ...info };
      renderPlayerInfo(info);
    }
  } catch (e) { /* pakai cache */ }

  // Load related
  loadRelatedVideos(videoData?.title || videoId);
}

function renderPlayerInfo(v) {
  const title   = v.title || '';
  const channel = v.channel || v.channelTitle || v.author || '';
  const views   = v.views   || '';
  const time    = v.time    || v.publishedAt || '';
  const subs    = v.subscribers || '';
  const desc    = v.description || '';
  const likes   = v.likes   || '';

  // Judul
  const titleEl = document.getElementById('playerTitle');
  if (titleEl) titleEl.textContent = title;

  // Stats row
  const statRow = document.getElementById('playerStatRow');
  if (statRow) {
    const parts = [views, time].filter(Boolean).join(' · ');
    statRow.innerHTML = `
      <span>${escHtml(parts)}</span>
      ${v.trending ? `<span class="player-trending-badge">#${v.trending} Trending</span>` : ''}
    `;
  }

  // Channel avatar
  const avatarEl = document.getElementById('playerChannelAvatar');
  if (avatarEl) {
    if (v.channelThumb) {
      avatarEl.innerHTML = `<img src="${escAttr(v.channelThumb)}" alt="${escHtml(channel)}" onerror="this.style.display='none';this.parentElement.textContent='${channel[0]||'M'}'" />`;
    } else {
      avatarEl.textContent = (channel[0] || 'M').toUpperCase();
    }
  }

  // Channel name
  const nameEl = document.getElementById('playerChannelName');
  if (nameEl) nameEl.textContent = channel;

  // Verified
  const verEl = document.getElementById('playerVerified');
  if (verEl) verEl.style.display = v.verified ? 'flex' : 'none';

  // Subscribers
  const subsEl = document.getElementById('playerSubs');
  if (subsEl) subsEl.textContent = subs ? subs + ' subscriber' : '';

  // Like count
  const likeCountEl = document.getElementById('likeCount');
  if (likeCountEl) likeCountEl.textContent = likes || '—';

  // Description
  const descEl = document.getElementById('playerDescText');
  if (descEl) {
    descEl.textContent = desc || 'Tidak ada deskripsi.';
    descEl.classList.remove('expanded');
  }
  const descToggle = document.getElementById('playerDescToggle');
  if (descToggle) descToggle.textContent = '...more';
}

let _descExpanded = false;
function toggleDesc() {
  _descExpanded = !_descExpanded;
  const descEl   = document.getElementById('playerDescText');
  const toggleEl = document.getElementById('playerDescToggle');
  if (descEl)   descEl.classList.toggle('expanded', _descExpanded);
  if (toggleEl) toggleEl.textContent = _descExpanded ? 'Sembunyikan' : '...more';
}

function toggleLike() {
  _liked = !_liked;
  const btn = document.getElementById('likeBtn');
  if (btn) btn.classList.toggle('liked', _liked);
  showToast(_liked ? '👍 Disukai' : 'Like dibatalkan');
}

async function loadRelatedVideos(query) {
  const relatedEl = document.getElementById('relatedVideos');
  if (!relatedEl) return;
  relatedEl.innerHTML = `<div class="related-loading"><div class="spinner"></div><span>Memuat video terkait...</span></div>`;
  try {
    const q   = typeof query === 'string' && query.length > 3 ? query.substring(0, 60) : 'musik indonesia terbaru';
    const res = await apiFetch(`${API}/search?q=${encodeURIComponent(q)}&limit=12`);
    const data = await res.json();
    const list = (data.videos || []).filter(v => (v.id||v.videoId) !== currentVideo?.id).slice(0, 12);
    if (!list.length) {
      relatedEl.innerHTML = '<div class="related-loading">Tidak ada video terkait</div>';
      return;
    }
    relatedEl.innerHTML = list.map(v => {
      const id      = escAttr(v.id || v.videoId || '');
      const title   = escHtml(v.title || 'Tanpa Judul');
      const ch      = escHtml(v.channel || v.author || '');
      const initial = (v.channel || v.author || 'M')[0].toUpperCase();
      const views   = v.views ? escHtml(v.views) : '';
      const time    = v.time  ? escHtml(v.time)  : '';
      const meta    = [views, time].filter(Boolean).join(' · ');
      const colors  = ['#c2185b','#e53935','#f57c00','#7b1fa2','#1565c0','#2e7d32','#00838f','#6d4c41'];
      const color   = colors[initial.charCodeAt(0) % colors.length];
      return `
        <div class="related-item" onclick='openVideoFromData(${JSON.stringify(v)})'>
          <div class="related-avatar" style="background:${color};">${initial}</div>
          <div class="related-info">
            <div class="related-title">${title}</div>
            <div class="related-ch">${ch}</div>
            ${meta ? `<div class="related-meta">${meta}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    if (relatedEl) relatedEl.innerHTML = '<div class="related-loading">Gagal memuat</div>';
  }
}

// ===== MINI PLAYER =====
let _miniPaused = false;
let _miniProgressTimer = null;
let _miniProgress = 0;
let _miniVideoId = null;

function showMiniPlayer(video) {
  if (!video) return;
  const mp = document.getElementById('miniPlayer');
  if (!mp) return;

  _miniVideoId = video.id || video.videoId || '';
  const title = video.title || 'Video';
  const ch    = video.channel || video.author || '';
  const thumb = video.thumbnail || video.thumb || `https://i.ytimg.com/vi/${_miniVideoId}/hqdefault.jpg`;

  const thumbEl = document.getElementById('miniThumb');
  const titleEl = document.getElementById('miniTitle');
  const chEl    = document.getElementById('miniChannel');
  if (thumbEl) thumbEl.src = thumb;
  if (titleEl) titleEl.textContent = title;
  if (chEl)    chEl.textContent    = ch;

  _miniPaused   = false;
  _miniProgress = 0;
  updateMiniPlayIcon();

  const bar = document.getElementById('miniProgressBar');
  if (bar) bar.style.width = '0%';

  mp.style.display = 'block';

  // Progress simulasi
  clearInterval(_miniProgressTimer);
  _miniProgressTimer = setInterval(() => {
    if (_miniPaused) return;
    _miniProgress = Math.min(_miniProgress + 0.12, 100);
    const b = document.getElementById('miniProgressBar');
    if (b) b.style.width = _miniProgress + '%';
    if (_miniProgress >= 100) clearInterval(_miniProgressTimer);
  }, 1000);
}

function hideMiniPlayer() {
  const mp = document.getElementById('miniPlayer');
  if (mp) mp.style.display = 'none';
  clearInterval(_miniProgressTimer);
  _miniProgress = 0;
  _miniVideoId  = null;
}

// Klik area mini player → expand ke full player
function expandPlayer() {
  if (!currentVideo) return;
  const playerPage = document.getElementById('page-player');
  if (!playerPage) return;

  hideMiniPlayer();

  playerPage.style.display = 'flex';
  playerPage.offsetHeight;
  playerPage.classList.add('slide-in');

  // Re-embed iframe jika kosong
  const embedEl = document.getElementById('playerEmbed');
  if (embedEl && !embedEl.querySelector('iframe')) {
    const id = currentVideo.id || currentVideo.videoId;
    _embedYT(embedEl, id, true);
  }
}

// ── Pause / Play ──
function toggleMiniPlay(e) {
  if (e) e.stopPropagation();
  _miniPaused = !_miniPaused;
  updateMiniPlayIcon();
  _sendYTCommand(_miniPaused ? 'pauseVideo' : 'playVideo');
}

// ── Next: putar video terkait pertama ──
function miniNext(e) {
  if (e) e.stopPropagation();
  // Ambil video terkait pertama dari related list
  const firstRelated = document.querySelector('.related-item');
  if (firstRelated) {
    firstRelated.click();
  } else {
    showToast('Tidak ada video berikutnya');
  }
}

// ── Close: hentikan video dan sembunyikan mini player ──
function closeMiniPlayer(e) {
  if (e) e.stopPropagation();
  _sendYTCommand('stopVideo');
  // Hapus iframe agar video benar-benar berhenti
  const embedEl = document.getElementById('playerEmbed');
  if (embedEl) embedEl.innerHTML = '';
  hideMiniPlayer();
  currentVideo    = null;
  _miniPaused     = false;
  _descExpanded   = false;
}

function updateMiniPlayIcon() {
  const icon = document.getElementById('miniPauseIcon');
  if (!icon) return;
  icon.innerHTML = _miniPaused
    ? `<polygon points="5 3 19 12 5 21 5 3"/>`
    : `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
}

// Kirim perintah ke YouTube iframe via postMessage (butuh enablejsapi=1)
function _sendYTCommand(cmd) {
  const iframe = document.querySelector('#playerEmbed iframe');
  if (!iframe) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: [] }),
      'https://www.youtube.com'
    );
  } catch (e) { /* ignore cross-origin */ }
}

// Embed YouTube dengan enablejsapi=1
function _embedYT(container, videoId, autoplay = true) {
  const ap = autoplay ? '1' : '0';
  container.innerHTML = `
    <div class="player-embed-loading">
      <div class="spinner" style="border-color:#333;border-top-color:#fff;"></div>
    </div>
    <iframe
      id="ytIframe"
      src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=${ap}&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      onload="this.previousElementSibling.style.display='none'"
    ></iframe>`;
}

function closePlayer() {
  const playerPage = document.getElementById('page-player');
  if (!playerPage) return;

  playerPage.classList.remove('slide-in');

  setTimeout(() => {
    playerPage.style.display = 'none';
    _liked        = false;
    _descExpanded = false;
    // Tampilkan mini player jika masih ada video
    if (currentVideo) {
      showMiniPlayer(currentVideo);
    }
  }, 300);
}

function downloadCurrentVideo() {
  if (!currentVideo) return;
  const id    = currentVideo.id || currentVideo.videoId;
  const title = currentVideo.title || 'video';
  const thumb = currentVideo.thumbnail || currentVideo.thumb || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  openDownloadModal(id, title, thumb);
}

function shareCurrentVideo() {
  if (!currentVideo) return;
  shareVideo(currentVideo.id || currentVideo.videoId, currentVideo.title || 'Video');
}

function refreshPlayer() {
  if (!currentVideo) return;
  const id = currentVideo.id || currentVideo.videoId;
  const embedEl = document.getElementById('playerEmbed');
  if (embedEl) _embedYT(embedEl, id, true);
  showToast('Video di-refresh');
}

// ===== FILE ACTIONS =====
async function deleteFile(index) {
  if (index < 0 || index >= myFiles.length) return;
  const f = myFiles[index];
  // Hapus dari localStorage
  lsDeleteFile(index);
  myFiles = lsGetFiles();
  // Hapus dari server juga (best effort)
  if (f.filename) {
    try { await apiFetch(`${API}/delete-file?filename=${encodeURIComponent(f.filename)}`); } catch {}
  }
  renderFileList();
  showToast(`🗑️ "${(f.title||'file').substring(0,30)}" dihapus`);
}

async function confirmDeleteAll() {
  if (myFiles.length === 0) { showToast('Tidak ada file untuk dihapus'); return; }
  const ok = window.confirm(`Hapus semua ${myFiles.length} file dari daftar?`);
  if (!ok) return;
  // Hapus dari server (best effort)
  for (const f of myFiles) {
    if (f.filename) {
      try { await apiFetch(`${API}/delete-file?filename=${encodeURIComponent(f.filename)}`); } catch {}
    }
  }
  lsDeleteAll();
  myFiles = [];
  renderFileList();
  showToast('🗑️ Semua file dihapus');
}

function playFile(index) {
  if (index < 0 || index >= myFiles.length) return;
  const f = myFiles[index];
  // Buka file dari server lokal
  const fileUrl = `${API.replace('/api','')}/api/serve-file?filename=${encodeURIComponent(f.filename)}`;
  window.open(fileUrl, '_blank');
}

function showFileMenu(index) {
  if (index < 0 || index >= myFiles.length) return;
  const f = myFiles[index];

  let menu = document.getElementById('fileMenuSheet');
  if (menu) menu.remove();

  menu = document.createElement('div');
  menu.id = 'fileMenuSheet';
  menu.style.cssText = `position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;`;
  menu.innerHTML = `
    <div style="background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 32px;width:100%;max-width:430px;animation:slideUp 0.25s ease;">
      <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">${escHtml(f.title||'File')}</div>
      <div style="font-size:12px;color:#888;margin-bottom:16px;">${escHtml(f.size||'')} · ${escHtml(f.format||'')} · ${escHtml(f.duration||'')}</div>
      <div style="display:flex;flex-direction:column;">
        <button onclick="playFile(${index});document.getElementById('fileMenuSheet').remove();"
          style="display:flex;align-items:center;gap:14px;padding:16px 0;background:none;border:none;border-bottom:1px solid #ebebeb;cursor:pointer;font-size:15px;color:#1a1a1a;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Putar / Buka File
        </button>
        <button onclick="shareVideo('${escAttr(f.videoId||'')}','${escAttr(f.title||'')}');document.getElementById('fileMenuSheet').remove();"
          style="display:flex;align-items:center;gap:14px;padding:16px 0;background:none;border:none;border-bottom:1px solid #ebebeb;cursor:pointer;font-size:15px;color:#1a1a1a;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Bagikan Link YouTube
        </button>
        <button onclick="deleteFile(${index});document.getElementById('fileMenuSheet').remove();"
          style="display:flex;align-items:center;gap:14px;padding:16px 0;background:none;border:none;cursor:pointer;font-size:15px;color:#e8001d;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#e8001d" stroke-width="2" width="22" height="22"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Hapus File
        </button>
      </div>
      <button onclick="document.getElementById('fileMenuSheet').remove();"
        style="width:100%;margin-top:12px;padding:14px;background:none;border:1px solid #ebebeb;border-radius:12px;font-size:14px;color:#888;cursor:pointer;">
        Batal
      </button>
    </div>`;
  menu.addEventListener('click', e => { if (e.target === menu) menu.remove(); });
  document.getElementById('app').appendChild(menu);
}

// ===== SETTINGS =====
function toggleQuickSearch(el) {
  quickSearchEnabled = el.checked;
  localStorage.setItem('quickSearch', quickSearchEnabled ? 'true' : 'false');
  showToast(quickSearchEnabled ? '✅ Pencarian cepat aktif' : '🔕 Pencarian cepat nonaktif');
}

function openLink(url) {
  window.open(url, '_blank');
}

function shareApp() {
  const text = 'ManTube - Download musik & video YouTube dengan mudah!';
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'ManTube', text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Link disalin ke clipboard');
    }).catch(() => {
      showToast('Bagikan: ' + url);
    });
  }
}

function showPrivacy() {
  showToast('Kebijakan Privasi: Kami tidak menyimpan data pribadi Anda.');
}

// ===== LANGUAGE MODAL =====
const LANGUAGES = [
  { code: 'id', name: 'Bahasa Indonesia', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'en', name: 'English',          native: 'English',          flag: '🇬🇧' },
  { code: 'ar', name: 'Arabic',           native: 'العربية',          flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese',          native: '中文',              flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese',         native: '日本語',            flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',           native: '한국어',            flag: '🇰🇷' },
  { code: 'es', name: 'Spanish',          native: 'Español',          flag: '🇪🇸' },
  { code: 'fr', name: 'French',           native: 'Français',         flag: '🇫🇷' },
  { code: 'de', name: 'German',           native: 'Deutsch',          flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese',       native: 'Português',        flag: '🇧🇷' },
  { code: 'hi', name: 'Hindi',            native: 'हिन्दी',           flag: '🇮🇳' },
  { code: 'ru', name: 'Russian',          native: 'Русский язык',     flag: '🇷🇺' },
  { code: 'ms', name: 'Malay',            native: 'Bahasa Melayu',    flag: '🇲🇾' },
  { code: 'tr', name: 'Turkish',          native: 'Türkçe',           flag: '🇹🇷' },
  { code: 'vi', name: 'Vietnamese',       native: 'Tiếng Việt',       flag: '🇻🇳' },
  { code: 'th', name: 'Thai',             native: 'ภาษาไทย',          flag: '🇹🇭' },
  { code: 'kk', name: 'Kazakh',           native: 'Қазақ',            flag: '🇰🇿' },
  { code: 'bn', name: 'Bengali',          native: 'বাংলা',            flag: '🇧🇩' },
  { code: 'zu', name: 'IsiZulu',          native: 'IsiZulu',          flag: '🇿🇦' },
];

let currentLang = localStorage.getItem('mantube_lang') || 'id';

function showLanguageModal() {
  const existing = document.getElementById('languageModal');
  if (existing) existing.remove();

  const currentLangObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  const modal = document.createElement('div');
  modal.id = 'languageModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);padding:20px;';

  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:390px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.25s ease;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:20px 20px 14px;flex-shrink:0;border-bottom:1px solid #f0f0f0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" width="24" height="24">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span style="font-size:18px;font-weight:800;color:#0f0f0f;flex:1;">${t('lang_title')}</span>
      </div>

      <!-- Scrollable list -->
      <div style="overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">

        <!-- Bahasa saat ini -->
        <div style="padding:14px 20px 10px;">
          <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">${t('lang_current')}</div>
          <div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#f0faf0;border-radius:12px;border:1.5px solid var(--red);">
            <span style="font-size:22px;">${currentLangObj.flag}</span>
            <span style="font-size:15px;font-weight:700;color:#0f0f0f;flex:1;">${escHtml(currentLangObj.native)}</span>
            <div style="width:22px;height:22px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>

        <div style="height:1px;background:#f0f0f0;margin:4px 20px 10px;"></div>

        <!-- Semua bahasa -->
        <div style="padding:0 20px 8px;">
          <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">${t('lang_all')}</div>
          ${LANGUAGES.filter(l => l.code !== currentLang).map(l => `
            <div onclick="selectLanguage('${l.code}')"
              style="display:flex;align-items:center;gap:14px;padding:12px 14px;cursor:pointer;border-radius:10px;margin-bottom:4px;transition:background 0.1s;"
              onmouseenter="this.style.background='#f5f5f5'" onmouseleave="this.style.background=''">
              <span style="font-size:22px;flex-shrink:0;">${l.flag}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:15px;font-weight:600;color:#0f0f0f;">${escHtml(l.native)}</div>
                <div style="font-size:12px;color:#888;">${escHtml(l.name)}</div>
              </div>
              <div style="width:20px;height:20px;border-radius:50%;border:2px solid #ddd;flex-shrink:0;"></div>
            </div>
          `).join('')}
        </div>
        <div style="height:8px;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px 20px;flex-shrink:0;border-top:1px solid #f0f0f0;">
        <button onclick="document.getElementById('languageModal').remove()"
          style="width:100%;padding:13px;background:none;border:1.5px solid #e0e0e0;border-radius:12px;font-size:15px;color:#606060;cursor:pointer;font-weight:600;">
          ${t('lang_close')}
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('app').appendChild(modal);
}

function selectLanguage(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  if (!lang) return;

  currentLang = code;

  // Terapkan bahasa ke seluruh UI
  if (typeof applyLanguage === 'function') applyLanguage(code);

  // Tutup modal
  document.getElementById('languageModal')?.remove();

  showToast(`✅ ${t('toast_lang_changed')}: ${lang.native}`);
}

function showLanguageModal() {
  // Remove existing
  const existing = document.getElementById('languageModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'languageModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:200;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.45);
    padding:20px;
  `;

  const currentLangObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

  modal.innerHTML = `
    <div style="
      background:#fff;border-radius:20px;
      width:100%;max-width:390px;
      max-height:80vh;display:flex;flex-direction:column;
      overflow:hidden;
      animation:slideUp 0.25s ease;
    ">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:20px 20px 16px;flex-shrink:0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" width="26" height="26">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span style="font-size:18px;font-weight:700;color:#1a1a1a;">Bahasa</span>
      </div>

      <!-- Scrollable list -->
      <div style="overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;">

        <!-- Current language -->
        <div style="padding:4px 20px 8px;">
          <div style="font-size:13px;font-weight:600;color:#888;margin-bottom:8px;">Bahasa saat ini</div>
          <div style="display:flex;align-items:center;gap:14px;padding:10px 0;">
            <div style="
              width:22px;height:22px;border-radius:50%;
              background:var(--red);
              display:flex;align-items:center;justify-content:center;
              flex-shrink:0;
            ">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="13" height="13">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span style="font-size:15px;color:#1a1a1a;">${escHtml(currentLangObj.native)}</span>
          </div>
        </div>

        <div style="height:1px;background:#ebebeb;margin:0 20px 12px;"></div>

        <!-- All languages -->
        <div style="padding:0 20px 8px;">
          <div style="font-size:13px;font-weight:600;color:#888;margin-bottom:8px;">Semua bahasa</div>
          <div id="langList">
            ${LANGUAGES.filter(l => l.code !== currentLang).map(l => `
              <div onclick="selectLanguage('${l.code}')"
                style="display:flex;align-items:center;gap:14px;padding:13px 0;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background 0.1s;"
                onmouseenter="this.style.background='#f9f9f9'" onmouseleave="this.style.background=''">
                <div style="
                  width:22px;height:22px;border-radius:50%;
                  border:2px solid #ccc;
                  flex-shrink:0;
                "></div>
                <span style="font-size:15px;color:#1a1a1a;">${escHtml(l.native)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="height:16px;"></div>
      </div>

      <!-- Close button -->
      <div style="padding:12px 20px 20px;flex-shrink:0;border-top:1px solid #ebebeb;">
        <button onclick="document.getElementById('languageModal').remove()"
          style="width:100%;padding:13px;background:none;border:1.5px solid #ebebeb;border-radius:12px;font-size:14px;color:#888;cursor:pointer;font-weight:500;">
          Tutup
        </button>
      </div>
    </div>
  `;

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('app').appendChild(modal);
}

function selectLanguage(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  if (!lang) return;

  currentLang = code;
  localStorage.setItem('mantube_lang', code);

  // Close modal
  const modal = document.getElementById('languageModal');
  if (modal) modal.remove();

  showToast(`✅ Bahasa diubah ke: ${lang.native}`);

  // Update settings item display
  const langItem = document.querySelector('.settings-item [data-lang-label]');
  if (langItem) langItem.textContent = lang.native;
}

// ===== SHARE =====
function shareVideo(id, title) {
  const ytUrl = `https://www.youtube.com/watch?v=${id}`;
  const text  = title ? `${title} - ManTube` : 'ManTube';
  showShareSheet(ytUrl, text, title);
}

function shareCurrentVideo() {
  if (!currentVideo) return;
  const id    = currentVideo.id || currentVideo.videoId;
  const title = currentVideo.title || 'Video';
  shareVideo(id, title);
}

// Simpan data share sementara
let _shareUrl  = '';
let _shareText = '';

function showShareSheet(url, text, title) {
  _shareUrl  = url;
  _shareText = text;

  document.getElementById('shareSheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'shareSheet';
  sheet.style.cssText = `
    position:fixed;inset:0;z-index:300;
    background:rgba(0,0,0,0.5);
    display:flex;align-items:flex-end;justify-content:center;
  `;

  sheet.innerHTML = `
    <div style="
      background:#fff;border-radius:20px 20px 0 0;
      width:100%;max-width:430px;
      padding:20px 20px 32px;
      animation:slideUp 0.25s ease;
    ">
      <!-- Handle -->
      <div style="width:40px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px;"></div>

      <!-- Title -->
      <div style="font-size:18px;font-weight:800;color:#0f0f0f;margin-bottom:20px;">Bagikan</div>

      <!-- App icons -->
      <div style="display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-bottom:8px;margin-bottom:16px;">

        <!-- WhatsApp -->
        <div onclick="_shareToApp('whatsapp')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="24" fill="#25D366"/>
            <path fill="#fff" d="M24 10C16.27 10 10 16.27 10 24c0 2.52.68 4.88 1.86 6.92L10 38l7.28-1.83A13.93 13.93 0 0 0 24 38c7.73 0 14-6.27 14-14S31.73 10 24 10zm7.18 19.36c-.3.84-1.76 1.6-2.42 1.7-.62.1-1.4.14-2.26-.14-.52-.17-1.18-.4-2.04-.78-3.58-1.54-5.92-5.14-6.1-5.38-.18-.24-1.46-1.94-1.46-3.7 0-1.76.92-2.62 1.24-2.98.32-.36.7-.44.94-.44.24 0 .48.002.68.012.22.01.52-.08.8.62.3.72 1.02 2.48 1.1 2.66.1.18.16.4.04.64-.12.24-.18.38-.36.58-.18.2-.38.44-.54.6-.18.18-.36.38-.16.74.2.36.9 1.48 1.94 2.4 1.34 1.18 2.46 1.54 2.82 1.72.36.18.56.16.76-.1.2-.26.86-1 1.08-1.34.22-.34.44-.28.74-.16.3.12 1.9.9 2.22 1.06.32.16.54.24.62.38.08.14.08.8-.22 1.64z"/>
          </svg>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">WhatsApp</span>
        </div>

        <!-- Telegram -->
        <div onclick="_shareToApp('telegram')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="24" fill="#2CA5E0"/>
            <path fill="#fff" d="M10.5 23.6l6.9 2.6 2.7 8.6c.2.5.8.7 1.2.4l3.8-3.1 7.4 5.4c.5.4 1.2.1 1.4-.5l5-22.5c.2-.8-.5-1.5-1.3-1.2L10.5 22c-.8.3-.8 1.4 0 1.6zm9.5 1.8l12.8-7.9-8.5 9.3-.5 4.2-3.8-5.6z"/>
          </svg>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">Telegram</span>
        </div>

        <!-- Facebook -->
        <div onclick="_shareToApp('facebook')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="24" fill="#1877F2"/>
            <path fill="#fff" d="M26.5 38V25.5H30l.5-4H26.5v-2.5c0-1.1.3-1.9 2-1.9H31V14c-.5-.1-2-.2-3.8-.2-3.8 0-6.4 2.3-6.4 6.5V21.5H17v4h3.8V38h5.7z"/>
          </svg>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">Facebook</span>
        </div>

        <!-- Twitter/X -->
        <div onclick="_shareToApp('twitter')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="24" fill="#000"/>
            <path fill="#fff" d="M26.4 22.3L34.5 13h-2L25.5 21l-6.4-8H12l8.5 12.4L12 35h2l7.4-8.6 5.9 8.6H35L26.4 22.3zm-2.6 3l-.9-1.2-6.9-9.9h3l5.6 8 .9 1.2 7.2 10.3h-3l-5.9-8.4z"/>
          </svg>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">Twitter/X</span>
        </div>

        <!-- Instagram -->
        <div onclick="_shareToApp('instagram')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <defs>
              <radialGradient id="igGrad" cx="30%" cy="107%" r="150%">
                <stop offset="0%" stop-color="#fdf497"/>
                <stop offset="45%" stop-color="#fd5949"/>
                <stop offset="60%" stop-color="#d6249f"/>
                <stop offset="90%" stop-color="#285AEB"/>
              </radialGradient>
            </defs>
            <circle cx="24" cy="24" r="24" fill="url(#igGrad)"/>
            <rect x="14" y="14" width="20" height="20" rx="6" fill="none" stroke="#fff" stroke-width="2.2"/>
            <circle cx="24" cy="24" r="5.5" fill="none" stroke="#fff" stroke-width="2.2"/>
            <circle cx="30.5" cy="17.5" r="1.5" fill="#fff"/>
          </svg>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">Instagram</span>
        </div>

        <!-- More (native share) -->
        <div onclick="_shareToApp('more')"
          style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:72px;cursor:pointer;padding:4px 0;flex-shrink:0;">
          <div style="width:52px;height:52px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="#555" width="24" height="24">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </div>
          <span style="font-size:11px;color:#0f0f0f;font-weight:500;">More</span>
        </div>
      </div>

      <!-- Salin tautan -->
      <button onclick="_shareCopyLink()"
        style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
        padding:14px;background:#f2f2f2;border:none;border-radius:12px;
        font-size:15px;font-weight:600;color:#0f0f0f;cursor:pointer;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Salin tautan
      </button>
    </div>
  `;

  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  document.getElementById('app').appendChild(sheet);
}

// Handler per platform
function _shareToApp(platform) {
  const url  = _shareUrl;
  const text = _shareText;
  document.getElementById('shareSheet')?.remove();

  switch (platform) {
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
      break;
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
      break;
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
      break;
    case 'twitter':
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      break;
    case 'instagram':
      // Instagram tidak punya web share API — salin link + instruksi
      navigator.clipboard?.writeText(url).then(() => {
        showToast('🔗 Link disalin! Buka Instagram → Stories → tempel link');
      }).catch(() => {
        showToast('Buka Instagram dan tempel: ' + url);
      });
      break;
    case 'more':
      if (navigator.share) {
        navigator.share({ title: text, url }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(url).then(() => {
          showToast('🔗 Link disalin ke clipboard');
        });
      }
      break;
  }
}

function _shareCopyLink() {
  document.getElementById('shareSheet')?.remove();
  const url = _shareUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Link disalin ke clipboard');
    }).catch(() => {
      prompt('Salin link ini:', url);
    });
  } else {
    prompt('Salin link ini:', url);
  }
}

// ===== TOAST =====
let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== HELPERS =====
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractYouTubeId(str) {
  if (!str) return null;
  // Match full URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = str.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatViews(views) {
  if (!views && views !== 0) return '';
  const n = parseInt(views, 10);
  if (isNaN(n)) return String(views);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0', '') + 'M penonton';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'jt';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'rb';
  return n.toString();
}
