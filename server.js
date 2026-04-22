const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const https = require('https');

const PORT     = 8080;
const BASE_DIR = __dirname;

// ===== MIME =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.svg' : 'image/svg+xml',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.ico' : 'image/x-icon',
};

// ===== LAZY MODULES =====
let _ytsr = null, _ytdl = null, _playdl = null;
const getYtsr   = () => _ytsr   || (_ytsr   = require('@distube/ytsr'));
const getYtdl   = () => _ytdl   || (_ytdl   = require('@distube/ytdl-core'));
const getPlaydl = () => _playdl || (_playdl = require('play-dl'));

// ===== HELPERS =====
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function sendJSON(res, data, status = 200) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function sendError(res, msg, status = 500) { sendJSON(res, { error: msg }, status); }

function fmtViews(n) {
  if (!n) return '';
  const v = parseInt(n);
  if (v >= 1e9) return (v/1e9).toFixed(1)+' M ditonton';
  if (v >= 1e6) return (v/1e6).toFixed(1)+' jt ditonton';
  if (v >= 1e3) return (v/1e3).toFixed(1)+' rb ditonton';
  return v+' ditonton';
}
function fmtDur(sec) {
  if (!sec) return '';
  const s = parseInt(sec), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${m}:${String(ss).padStart(2,'0')}`;
}
function timeAgo(d) {
  if (!d) return '';
  const dt = new Date(d); if (isNaN(dt)) return d;
  const s = Math.floor((Date.now()-dt)/1000);
  if (s < 60)      return 'baru saja';
  if (s < 3600)    return `${Math.floor(s/60)} menit lalu`;
  if (s < 86400)   return `${Math.floor(s/3600)} jam lalu`;
  if (s < 2592000) return `${Math.floor(s/86400)} hari lalu`;
  if (s < 31536000)return `${Math.floor(s/2592000)} bulan lalu`;
  return `${Math.floor(s/31536000)} tahun lalu`;
}
function mapItem(item) {
  return {
    id:             item.id,
    title:          item.name,
    channel:        item.author?.name || '',
    channelId:      item.author?.channelID || '',
    channelInitial: (item.author?.name||'Y')[0].toUpperCase(),
    views:          fmtViews(item.views),
    viewsRaw:       item.views || 0,
    duration:       item.duration || '',
    time:           timeAgo(item.uploadedAt),
    thumb:          item.thumbnail || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
    isLive:         item.isLive || false,
    badges:         item.badges || [],
  };
}

// ===== AUTOCOMPLETE (Google Suggest) =====
async function handleSuggest(res, q) {
  if (!q) return sendJSON(res, { suggestions: [] });
  const sugUrl = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}&hl=id`;
  try {
    const data = await new Promise((resolve, reject) => {
      https.get(sugUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        let raw = '';
        r.on('data', c => raw += c);
        r.on('end', () => {
          try {
            // Response: window.google.ac.h(["q",[ ["sug1",[]], ... ]])
            const match = raw.match(/\[.*\]/s);
            if (!match) return resolve([]);
            const parsed = JSON.parse(match[0]);
            const arr = parsed[1] || [];
            resolve(arr.map(x => x[0]).filter(Boolean).slice(0, 10));
          } catch { resolve([]); }
        });
        r.on('error', reject);
      }).on('error', reject);
    });
    sendJSON(res, { suggestions: data });
  } catch (e) {
    sendJSON(res, { suggestions: [] });
  }
}

// ===== SEARCH =====
async function handleSearch(res, q, filter, limit) {
  if (!q?.trim()) return sendError(res, 'Query kosong', 400);
  try {
    const ytsr = getYtsr();
    const opts = { limit: parseInt(limit) || 20 };

    // Filter: video | channel | playlist
    if (filter === 'channel')  opts.type = 'channel';
    else if (filter === 'playlist') opts.type = 'playlist';
    else opts.type = 'video';

    const results = await ytsr(q.trim(), opts);
    const items = (results.items || []);

    if (filter === 'channel') {
      const channels = items.map(c => ({
        type: 'channel',
        id:   c.channelID || c.url,
        name: c.name,
        subs: c.subscribers || '',
        thumb: c.avatars?.[0]?.url || '',
        verified: c.verified || false,
      }));
      return sendJSON(res, { channels, total: channels.length });
    }

    if (filter === 'playlist') {
      const playlists = items.map(p => ({
        type:  'playlist',
        id:    p.playlistID || p.url,
        title: p.title || p.name,
        count: p.length || 0,
        thumb: p.firstVideo?.bestThumbnail?.url || '',
        owner: p.owner?.name || '',
      }));
      return sendJSON(res, { playlists, total: playlists.length });
    }

    // Default: video
    const videos = items.filter(i => i.type === 'video').map(mapItem);
    sendJSON(res, { videos, total: videos.length, query: q.trim() });

  } catch (err) {
    console.error('[SEARCH]', err.message);
    sendError(res, err.message);
  }
}

// ===== VIDEO INFO =====
async function handleInfo(res, videoId) {
  if (!videoId) return sendError(res, 'ID kosong', 400);
  try {
    const ytdl = getYtdl();
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const d = info.videoDetails;
    sendJSON(res, {
      id:             d.videoId,
      title:          d.title,
      channel:        d.author?.name || '',
      channelId:      d.channelId || '',
      channelInitial: (d.author?.name||'Y')[0].toUpperCase(),
      views:          fmtViews(d.viewCount),
      viewsRaw:       d.viewCount || 0,
      duration:       fmtDur(d.lengthSeconds),
      time:           timeAgo(d.publishDate),
      thumb:          d.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      description:    (d.description||'').substring(0, 500),
      keywords:       d.keywords?.slice(0,10) || [],
      isLive:         d.isLiveContent || false,
      subscribers:    d.author?.subscriber_count ? fmtViews(d.author.subscriber_count) : '',
    });
  } catch (err) {
    console.error('[INFO]', err.message);
    sendError(res, err.message);
  }
}

// ===== TRENDING =====
async function handleTrending(res, category) {
  const cats = {
    music:  ['musik indonesia terbaru 2025', 'lagu viral tiktok 2025', 'top hits indonesia 2025'],
    gaming: ['game viral indonesia 2025', 'gameplay trending'],
    news:   ['berita terbaru indonesia', 'trending indonesia hari ini'],
    all:    ['trending indonesia', 'viral indonesia 2025', 'populer indonesia'],
  };
  const queries = cats[category] || cats.all;
  const q = queries[Math.floor(Math.random() * queries.length)];
  try {
    const ytsr = getYtsr();
    const results = await ytsr(q, { limit: 15, type: 'video' });
    const videos = (results.items||[]).filter(i=>i.type==='video').map(mapItem);
    sendJSON(res, { videos, category: category || 'all' });
  } catch (err) {
    console.error('[TRENDING]', err.message);
    sendError(res, err.message);
  }
}

// ===== TRENDING MUSIK (untuk tab Musik) =====
async function handleTrendingMusic(res) {
  try {
    const ytsr = getYtsr();

    // Jalankan 2 query paralel: pilihan cepat + playlist trending
    const [quickRes, trendRes] = await Promise.all([
      ytsr('lagu hits indonesia terbaru 2025', { limit: 10, type: 'video' }),
      ytsr('playlist musik trending indonesia 2025', { limit: 10, type: 'video' }),
    ]);

    const quick    = (quickRes.items||[]).filter(i=>i.type==='video').map(mapItem);
    const trending = (trendRes.items||[]).filter(i=>i.type==='video').map(mapItem);

    sendJSON(res, { quick, trending });
  } catch (err) {
    console.error('[TRENDING_MUSIC]', err.message);
    sendError(res, err.message);
  }
}

// ===== FORMAT LIST — pakai play-dl dengan fallback ytdl-core =====
async function handleFormats(res, videoId) {
  if (!videoId) return sendError(res, 'ID kosong', 400);
  try {
    const playdl = getPlaydl();
    const ytUrl  = `https://www.youtube.com/watch?v=${videoId}`;

    // Ambil info video
    const info = await playdl.video_info(ytUrl);
    const d    = info.video_details;

    const title   = d.title || 'Video';
    const channel = d.channel?.name || '';
    const thumb   = d.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // Format audio
    const audio = [
      { itag: 'audio_128', label: 'M4A (128kbps)', ext: 'M4A', bitrate: 128, size: '~', type: 'audio' },
      { itag: 'audio_64',  label: 'M4A (64kbps)',  ext: 'M4A', bitrate: 64,  size: '~', type: 'audio' },
    ];

    // Format video
    const video = [
      { itag: 'video_720', label: 'MP4 (720p)', ext: 'MP4', height: 720, size: '~', type: 'video' },
      { itag: 'video_480', label: 'MP4 (480p)', ext: 'MP4', height: 480, size: '~', type: 'video' },
      { itag: 'video_360', label: 'MP4 (360p)', ext: 'MP4', height: 360, size: '~', type: 'video' },
      { itag: 'video_240', label: 'MP4 (240p)', ext: 'MP4', height: 240, size: '~', type: 'video' },
    ];

    sendJSON(res, { videoId, title, channel, thumb, ytUrl, audio, video });
  } catch (err) {
    console.error('[FORMATS]', err.message);
    // Fallback: kembalikan format default tanpa info detail
    sendJSON(res, {
      videoId,
      title:   'Video',
      channel: '',
      thumb:   `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      ytUrl:   `https://www.youtube.com/watch?v=${videoId}`,
      audio: [
        { itag: 'audio_128', label: 'M4A (128kbps)', ext: 'M4A', bitrate: 128, size: '~', type: 'audio' },
      ],
      video: [
        { itag: 'video_720', label: 'MP4 (720p)', ext: 'MP4', height: 720, size: '~', type: 'video' },
        { itag: 'video_360', label: 'MP4 (360p)', ext: 'MP4', height: 360, size: '~', type: 'video' },
      ],
    });
  }
}
const jobs = {}; // jobId -> { status, progress, filename, error, ... }

function makeJobId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function handleDownload(res, videoId, format, itag) {
  if (!videoId) return sendError(res, 'ID kosong', 400);

  const jobId = makeJobId();
  jobs[jobId] = { status: 'pending', progress: 0, videoId, format };

  // Balas langsung dengan jobId
  sendJSON(res, { jobId, status: 'pending' });

  // Jalankan download di background
  _runDownload(jobId, videoId, format, itag).catch(err => {
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message };
    console.error('[DOWNLOAD]', err.message);
  });
}

async function _runDownload(jobId, videoId, format, itag) {
  try {
    const ytdl = getYtdl();
    jobs[jobId].status   = 'fetching';
    jobs[jobId].progress = 5;

    const info  = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const d     = info.videoDetails;
    const safeTitle = d.title.replace(/[<>:"/\\|?*\r\n]/g, '').trim().substring(0, 80);
    const thumb = d.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    jobs[jobId].title    = d.title;
    jobs[jobId].progress = 15;
    jobs[jobId].status   = 'downloading';

    let ext, mimeType, ytdlOpts;
    if (format === 'audio') {
      // Pilih format berdasarkan itag jika ada
      let best;
      if (itag) {
        best = info.formats.find(f => String(f.itag) === String(itag));
      }
      if (!best) {
        const fmts = ytdl.filterFormats(info.formats, 'audioonly')
          .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
        if (!fmts.length) throw new Error('Format audio tidak tersedia');
        best = fmts[0];
      }
      ext      = best.container === 'mp4' ? 'm4a' : 'webm';
      mimeType = best.mimeType || 'audio/mp4';
      ytdlOpts = { format: best };
    } else {
      let chosen;
      if (itag) {
        chosen = info.formats.find(f => String(f.itag) === String(itag));
      }
      if (!chosen) {
        const fmts = ytdl.filterFormats(info.formats,
          f => f.container === 'mp4' && f.hasVideo && f.hasAudio)
          .sort((a, b) => (b.height || 0) - (a.height || 0));
        chosen = fmts[0] || ytdl.chooseFormat(info.formats, { quality: 'highest' });
      }
      ext      = 'mp4';
      mimeType = 'video/mp4';
      ytdlOpts = { format: chosen };
    }

    const filename = `${safeTitle}.${ext}`;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    // Jika sudah ada, skip download
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      jobs[jobId] = { ...jobs[jobId], status: 'done', progress: 100, filename, filePath, size: fmtFileSize(stat.size) };
      _saveToDb(videoId, d, thumb, format, filename, filePath, stat.size);
      return;
    }

    const writeStream = fs.createWriteStream(filePath);
    const ytStream    = ytdl(`https://www.youtube.com/watch?v=${videoId}`, ytdlOpts);

    const totalSize = parseInt(ytdlOpts.format?.contentLength || 0);
    let downloaded  = 0;

    ytStream.on('data', chunk => {
      downloaded += chunk.length;
      if (totalSize > 0) {
        jobs[jobId].progress = Math.min(15 + Math.round((downloaded / totalSize) * 80), 95);
      } else {
        jobs[jobId].progress = Math.min(jobs[jobId].progress + 1, 95);
      }
    });

    await new Promise((resolve, reject) => {
      ytStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      ytStream.on('error', reject);
    });

    const stat    = fs.statSync(filePath);
    const sizeStr = fmtFileSize(stat.size);

    _saveToDb(videoId, d, thumb, format, filename, filePath, stat.size);

    jobs[jobId] = { ...jobs[jobId], status: 'done', progress: 100, filename, filePath, size: sizeStr };

  } catch (err) {
    jobs[jobId] = { ...jobs[jobId], status: 'error', error: err.message, progress: 0 };
    throw err;
  }
}

function _saveToDb(videoId, d, thumb, format, filename, filePath, sizeBytes) {
  const db       = readDB();
  const filtered = db.filter(f => !(f.videoId === videoId && f.format === (format === 'audio' ? 'M4A' : 'MP4')));
  filtered.unshift({
    videoId,
    title:    d.title,
    channel:  d.author?.name || '',
    thumb,
    format:   format === 'audio' ? 'M4A' : 'MP4',
    filename,
    filePath,
    size:     fmtFileSize(sizeBytes),
    sizeBytes,
    duration: fmtDur(d.lengthSeconds),
    downloadedAt: new Date().toISOString(),
  });
  writeDB(filtered);
}

// ===== JOB STATUS =====
function handleJobStatus(res, jobId) {
  if (!jobId || !jobs[jobId]) return sendError(res, 'Job tidak ditemukan', 404);
  sendJSON(res, jobs[jobId]);
}
const DOWNLOADS_DIR = path.join(BASE_DIR, '..', 'downloads');
const DB_FILE       = path.join(BASE_DIR, '..', 'downloads', 'db.json');

// Pastikan folder downloads ada
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function fmtFileSize(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

async function handleDownload(res, videoId, format) {
  if (!videoId) return sendError(res, 'ID kosong', 400);
  try {
    const ytdl = getYtdl();
    const info  = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    const d     = info.videoDetails;
    const safeTitle = d.title.replace(/[<>:"/\\|?*\r\n]/g, '').trim().substring(0, 80);
    const thumb = d.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    let ext, mimeType, ytdlOpts;

    if (format === 'audio') {
      const fmts = ytdl.filterFormats(info.formats, 'audioonly')
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
      if (!fmts.length) return sendError(res, 'Format audio tidak tersedia');
      const best = fmts[0];
      ext      = best.container === 'mp4' ? 'm4a' : 'webm';
      mimeType = best.mimeType || 'audio/mp4';
      ytdlOpts = { format: best };
    } else {
      const fmts = ytdl.filterFormats(info.formats,
        f => f.container === 'mp4' && f.hasVideo && f.hasAudio)
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      const chosen = fmts[0] || ytdl.chooseFormat(info.formats, { quality: 'highest' });
      ext      = 'mp4';
      mimeType = 'video/mp4';
      ytdlOpts = { format: chosen };
    }

    const filename = `${safeTitle}.${ext}`;
    const filePath = path.join(DOWNLOADS_DIR, filename);

    // Cek apakah sudah ada
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return sendJSON(res, {
        success: true,
        cached: true,
        filename,
        filePath,
        size: fmtFileSize(stat.size),
        sizeBytes: stat.size,
      });
    }

    // Stream ke file lokal
    const writeStream = fs.createWriteStream(filePath);
    const ytStream    = ytdl(`https://www.youtube.com/watch?v=${videoId}`, ytdlOpts);

    let downloaded = 0;
    ytStream.on('data', chunk => { downloaded += chunk.length; });

    await new Promise((resolve, reject) => {
      ytStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      ytStream.on('error', reject);
    });

    const stat = fs.statSync(filePath);
    const sizeStr = fmtFileSize(stat.size);

    // Simpan ke DB
    const db = readDB();
    // Hapus duplikat
    const filtered = db.filter(f => f.videoId !== videoId || f.format !== format.toUpperCase());
    filtered.unshift({
      videoId,
      title:    d.title,
      channel:  d.author?.name || '',
      thumb,
      format:   format === 'audio' ? 'M4A' : 'MP4',
      filename,
      filePath,
      size:     sizeStr,
      sizeBytes: stat.size,
      duration: fmtDur(d.lengthSeconds),
      downloadedAt: new Date().toISOString(),
    });
    writeDB(filtered);

    sendJSON(res, {
      success: true,
      filename,
      filePath,
      size: sizeStr,
      sizeBytes: stat.size,
    });

  } catch (err) {
    console.error('[DOWNLOAD]', err.message);
    if (!res.headersSent) sendError(res, err.message);
  }
}

// ===== FILE LIST =====
function handleFileList(res) {
  const db = readDB();
  // Sinkronisasi: hapus entry yang filenya sudah tidak ada
  const valid = db.filter(f => {
    try { return fs.existsSync(f.filePath); } catch { return false; }
  });
  if (valid.length !== db.length) writeDB(valid);
  sendJSON(res, { files: valid });
}

// ===== DELETE FILE =====
function handleDeleteFile(res, filename) {
  if (!filename) return sendError(res, 'Filename kosong', 400);
  // Sanitasi: hanya nama file, tidak boleh path traversal
  const safe = path.basename(filename);
  const filePath = path.join(DOWNLOADS_DIR, safe);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const db = readDB().filter(f => f.filename !== safe);
    writeDB(db);
    sendJSON(res, { success: true });
  } catch (err) {
    sendError(res, err.message);
  }
}

// ===== SERVE FILE (untuk play/open) =====
function handleServeFile(res, filename) {
  const safe = path.basename(filename || '');
  const filePath = path.join(DOWNLOADS_DIR, safe);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
  const stat = fs.statSync(filePath);
  const ext  = path.extname(safe).toLowerCase();
  const mime = { '.m4a':'audio/mp4', '.webm':'audio/webm', '.mp4':'video/mp4', '.mp3':'audio/mpeg' };
  setCors(res);
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`,
  });
  fs.createReadStream(filePath).pipe(res);
}

// ===== STREAM DOWNLOAD — pakai yt-dlp.exe, langsung pipe ke browser =====
const YTDLP_PATH = path.join(BASE_DIR, 'yt-dlp.exe');

async function handleStreamDownload(res, videoId, format, itag) {
  if (!videoId) return sendError(res, 'ID kosong', 400);

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Ambil judul dulu
  let safeTitle = videoId;
  let thumb     = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  let channel   = '';
  let duration  = '—';

  try {
    const infoRaw = require('child_process').execSync(
      `"${YTDLP_PATH}" --dump-json --no-playlist "${ytUrl}"`,
      { timeout: 15000, encoding: 'utf8' }
    );
    const info = JSON.parse(infoRaw);
    safeTitle  = (info.title || videoId).replace(/[<>:"/\\|?*\r\n]/g, '').trim().substring(0, 80);
    thumb      = info.thumbnail || thumb;
    channel    = info.uploader || info.channel || '';
    duration   = info.duration_string || '—';
  } catch (e) {
    console.warn('[YTDLP INFO]', e.message.substring(0, 100));
  }

  const ext      = format === 'audio' ? 'm4a' : 'mp4';
  const mimeType = format === 'audio' ? 'audio/mp4' : 'video/mp4';
  const filename = `${safeTitle}.${ext}`;

  // Format selector untuk yt-dlp
  let fmtSelector;
  if (format === 'audio') {
    fmtSelector = 'bestaudio[ext=m4a]/bestaudio/best';
  } else {
    // Pilih resolusi berdasarkan itag
    const resMap = {
      'video_720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
      'video_480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
      'video_360': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]',
      'video_240': 'bestvideo[height<=240][ext=mp4]+bestaudio[ext=m4a]/best[height<=240][ext=mp4]/best[height<=240]',
    };
    fmtSelector = resMap[itag] || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  }

  setCors(res);
  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Transfer-Encoding': 'chunked',
  });

  // Spawn yt-dlp dan pipe output ke response
  const { spawn } = require('child_process');
  const args = [
    '--no-playlist',
    '-f', fmtSelector,
    '--merge-output-format', ext,
    '-o', '-',           // output ke stdout
    '--quiet',
    ytUrl,
  ];

  const proc = spawn(YTDLP_PATH, args);

  proc.stdout.pipe(res);

  proc.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.error('[YTDLP]', msg.substring(0, 120));
  });

  proc.on('close', code => {
    if (code !== 0) {
      console.error('[YTDLP] exit code:', code);
    } else {
      // Simpan ke db
      _saveStreamToDb(videoId, safeTitle, channel, thumb, format === 'audio' ? 'M4A' : 'MP4', filename, duration);
    }
    if (!res.writableEnded) res.end();
  });

  proc.on('error', err => {
    console.error('[YTDLP ERROR]', err.message);
    if (!res.headersSent) sendError(res, err.message);
    else if (!res.writableEnded) res.end();
  });

  // Jika client disconnect, kill proses
  res.on('close', () => {
    try { proc.kill(); } catch {}
  });
}

function _saveStreamToDb(videoId, title, channel, thumb, format, filename, duration) {
  try {
    const db       = readDB();
    const filtered = db.filter(f => !(f.videoId === videoId && f.format === format));
    filtered.unshift({
      videoId, title, channel, thumb, format, filename,
      filePath: '', size: '—', duration,
      downloadedAt: new Date().toISOString(),
    });
    writeDB(filtered);
  } catch (e) { /* ignore */ }
}
// ===== ROUTER =====
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const q        = parsed.query;

  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); res.end(); return; }

  if (pathname === '/api/suggest')        return handleSuggest(res, q.q);
  if (pathname === '/api/search')         return handleSearch(res, q.q, q.filter, q.limit);
  if (pathname === '/api/info')           return handleInfo(res, q.id);
  if (pathname === '/api/formats')        return handleFormats(res, q.id);
  if (pathname === '/api/trending')       return handleTrending(res, q.category);
  if (pathname === '/api/trending-music') return handleTrendingMusic(res);
  if (pathname === '/api/download')         return handleDownload(res, q.id, q.format || 'audio', q.itag);
  if (pathname === '/api/stream-download')  return handleStreamDownload(res, q.id, q.format || 'audio', q.itag);
  if (pathname === '/api/job-status')       return handleJobStatus(res, q.jobId);
  if (pathname === '/api/files')          return handleFileList(res);
  if (pathname === '/api/delete-file')    return handleDeleteFile(res, q.filename);
  if (pathname === '/api/serve-file')     return handleServeFile(res, q.filename);

  // Static files
  const filePath = path.join(BASE_DIR, pathname === '/' ? 'index.html' : pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅ ManTube berjalan!');
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('');
  console.log('  API: /api/suggest  /api/search  /api/info  /api/trending  /api/download');
  console.log('');
});
