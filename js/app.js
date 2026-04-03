// ─────────────────────────────────────────────
//  CloudPlay — Main App
// ─────────────────────────────────────────────

// ── State ──
const state = {
  files: [],           // all media files
  audioFiles: [],
  videoFiles: [],
  queue: [],           // current playback queue
  queueIndex: 0,
  shuffle: false,
  repeat: false,       // 'off' | 'one' | 'all'
  repeatMode: 'off',
  playlists: [],
  recentlyPlayed: [],
  currentView: 'home',
  previousView: null,
  genres: {},
  artists: {},
  albums: {},
  isLoaded: false,
  user: null,
  tokenClient: null,
  accessToken: null,
};

// ── Google Auth ──
function initGoogle() {
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: CONFIG.API_KEY,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    if (state.accessToken) {
      gapi.client.setToken({ access_token: state.accessToken });
      showApp();
    }
  });

  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly profile email',
    callback: (resp) => {
      if (resp.error) return;
      state.accessToken = resp.access_token;
      localStorage.setItem('cp_token', resp.access_token);
      gapi.client.setToken({ access_token: resp.access_token });
      fetchUserInfo();
      showApp();
      loadLibrary();
    },
  });

  // Auto sign-in if token saved
  const saved = localStorage.getItem('cp_token');
  if (saved) {
    state.accessToken = saved;
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey: CONFIG.API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      gapi.client.setToken({ access_token: saved });
      fetchUserInfo();
      showApp();
      loadLibrary();
    });
  }
}

async function fetchUserInfo() {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const u = await r.json();
    state.user = u;
    document.getElementById('user-info').textContent = u.name || u.email || '';
  } catch(e) {}
}

function signIn() {
  state.tokenClient.requestAccessToken();
}

function signOut() {
  localStorage.removeItem('cp_token');
  state.accessToken = null;
  state.user = null;
  state.files = [];
  state.audioFiles = [];
  state.videoFiles = [];
  google.accounts.oauth2.revoke(state.accessToken, () => {});
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
}

function showApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  updateGreeting();
  loadPlaylists();
}

// ── Library Loading ──
async function loadLibrary() {
  document.getElementById('loading-state').style.display = 'flex';
  state.isLoaded = false;

  try {
    const all = [];
    await fetchFiles(all, CONFIG.ROOT_FOLDER_ID || null, null);
    state.files = all;
    state.audioFiles = all.filter(f => isAudio(f.name));
    state.videoFiles = all.filter(f => isVideo(f.name));
    indexLibrary();
    renderAll();
    state.isLoaded = true;
  } catch(e) {
    console.error(e);
    if (e.status === 401) {
      localStorage.removeItem('cp_token');
      signOut();
    }
  }

  document.getElementById('loading-state').style.display = 'none';
}

async function fetchFiles(acc, folderId, pageToken) {
  let q = `trashed = false and (${buildMimeQuery()})`;
  if (folderId) q += ` and '${folderId}' in parents`;

  const params = {
    q,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, imageMediaMetadata)',
    pageSize: 1000,
    orderBy: 'name',
  };
  if (pageToken) params.pageToken = pageToken;

  const r = await gapi.client.drive.files.list(params);
  const data = r.result;
  acc.push(...(data.files || []));
  if (data.nextPageToken) await fetchFiles(acc, folderId, data.nextPageToken);
}

function buildMimeQuery() {
  const audio = ['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/flac','audio/aiff','audio/ogg','audio/opus'];
  const video = ['video/mp4','video/quicktime','video/x-m4v','video/webm'];
  return [...audio, ...video].map(m => `mimeType = '${m}'`).join(' or ');
}

function refreshLibrary() {
  state.files = [];
  state.audioFiles = [];
  state.videoFiles = [];
  loadLibrary();
}

// ── Indexing ──
function indexLibrary() {
  state.genres = {};
  state.artists = {};
  state.albums = {};

  state.audioFiles.forEach(f => {
    const parsed = parseName(f.name);
    f._parsed = parsed;

    // Genre (from folder path or tags — approximate from filename patterns)
    const genre = parsed.genre || 'Unknown';
    if (!state.genres[genre]) state.genres[genre] = [];
    state.genres[genre].push(f);

    // Artist
    const artist = parsed.artist || 'Unknown Artist';
    if (!state.artists[artist]) state.artists[artist] = [];
    state.artists[artist].push(f);

    // Album
    const album = parsed.album || 'Unknown Album';
    const key = `${artist}|${album}`;
    if (!state.albums[key]) state.albums[key] = { name: album, artist, files: [] };
    state.albums[key].files.push(f);
  });
}

function parseName(filename) {
  // Remove extension
  let name = filename.replace(/\.[^.]+$/, '');

  // Common patterns: "01 - Artist - Title", "Artist - Title", "01. Title"
  let artist = '', title = name, album = '', genre = '';

  // Pattern: "Artist - Title"
  const dash = name.match(/^(.+?)\s+-\s+(.+)$/);
  if (dash) {
    artist = dash[1].replace(/^\d+[\s.-]+/, '').trim();
    title = dash[2].trim();
  }

  // Strip leading track numbers
  title = title.replace(/^\d+[\s.-]+/, '').trim();
  artist = artist.replace(/^\d+[\s.-]+/, '').trim();

  return { title, artist, album, genre };
}

function isAudio(name) {
  const ext = name.split('.').pop().toLowerCase();
  return CONFIG.AUDIO_TYPES.includes(ext);
}

function isVideo(name) {
  const ext = name.split('.').pop().toLowerCase();
  return CONFIG.VIDEO_TYPES.includes(ext);
}

// ── Rendering ──
function renderAll() {
  renderHomeStats();
  renderMusicList();
  renderVideoGrid();
  renderGenres();
  renderArtists();
  renderAlbums();
}

function renderHomeStats() {
  const el = document.getElementById('home-stats');
  const stats = [
    { num: state.audioFiles.length, label: 'tracks', view: 'music' },
    { num: state.videoFiles.length, label: 'videos', view: 'videos' },
    { num: Object.keys(state.artists).length, label: 'artists', view: 'artists' },
    { num: Object.keys(state.genres).length, label: 'genres', view: 'genres' },
  ];
  el.innerHTML = stats.map(s => `
    <div class="stat-card" onclick="setViewBtn('${s.view}')">
      <div class="stat-num">${s.num}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

function renderMusicList(files, containerId = 'music-list') {
  const list = files || state.audioFiles;
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!list.length) { el.innerHTML = emptyState('No music found'); return; }

  el.innerHTML = list.map((f, i) => {
    const p = f._parsed || parseName(f.name);
    const playing = state.queue[state.queueIndex] === f;
    return `
      <div class="track-item ${playing ? 'playing' : ''}" onclick="playFromList(${i}, '${containerId}')">
        <div class="track-num">${i + 1}</div>
        <div class="track-thumb">
          ${f.thumbnailLink ? `<img src="${f.thumbnailLink}" alt="">` : audioIcon()}
        </div>
        <div class="track-info">
          <div class="track-title">${esc(p.title)}</div>
          <div class="track-sub">${esc(p.artist) || '—'}</div>
        </div>
        ${p.genre ? `<span class="track-genre">${esc(p.genre)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderVideoGrid() {
  const el = document.getElementById('video-grid');
  if (!state.videoFiles.length) { el.innerHTML = emptyState('No videos found'); return; }

  el.innerHTML = state.videoFiles.map((f, i) => `
    <div class="media-card video-card" onclick="playVideo(${i})">
      <div class="media-card-art video-card-art">
        ${f.thumbnailLink ? `<img src="${f.thumbnailLink}" alt="">` : videoIcon()}
        <div class="media-card-play">${playBigIcon()}</div>
      </div>
      <div class="media-card-info">
        <div class="media-card-title">${esc(f.name.replace(/\.[^.]+$/, ''))}</div>
      </div>
    </div>
  `).join('');
}

function renderGenres() {
  const el = document.getElementById('genres-grid');
  const genres = Object.entries(state.genres);
  if (!genres.length) { el.innerHTML = emptyState('No genres found'); return; }

  el.innerHTML = genres.map(([name, files], i) => `
    <div class="genre-card gc-${i % 8}" onclick="showGenre('${esc(name)}')">
      <div class="genre-card-name">${esc(name)}</div>
      <div class="genre-card-count">${files.length} track${files.length !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

function renderArtists() {
  const el = document.getElementById('artists-grid');
  const artists = Object.entries(state.artists);
  if (!artists.length) { el.innerHTML = emptyState('No artists found'); return; }

  el.innerHTML = artists.map(([name, files]) => `
    <div class="artist-card" onclick="showArtist('${esc(name)}')">
      <div class="artist-avatar">${name[0] || '?'}</div>
      <div class="artist-name">${esc(name)}</div>
      <div class="artist-count">${files.length} track${files.length !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

function renderAlbums() {
  const el = document.getElementById('albums-grid');
  const albums = Object.values(state.albums);
  if (!albums.length) { el.innerHTML = emptyState('No albums found'); return; }

  el.innerHTML = albums.map((a, i) => `
    <div class="media-card" onclick="showAlbum('${esc(a.name)}', '${esc(a.artist)}')">
      <div class="media-card-art">
        ${a.files[0]?.thumbnailLink ? `<img src="${a.files[0].thumbnailLink}" alt="">` : albumIcon()}
        <div class="media-card-play">${playBigIcon()}</div>
      </div>
      <div class="media-card-info">
        <div class="media-card-title">${esc(a.name)}</div>
        <div class="media-card-sub">${esc(a.artist)}</div>
      </div>
    </div>
  `).join('');
}

function renderPlaylists() {
  const el = document.getElementById('playlists-list');
  if (!state.playlists.length) {
    el.innerHTML = emptyState('No playlists yet. Create one to get started.');
    return;
  }
  el.innerHTML = state.playlists.map((pl, i) => `
    <div class="playlist-item" onclick="showPlaylist(${i})">
      <div class="playlist-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="playlist-info">
        <div class="playlist-name">${esc(pl.name)}</div>
        <div class="playlist-meta">${pl.files.length} tracks ${pl.genres.length ? '· ' + pl.genres.join(', ') : ''}</div>
      </div>
      <button class="playlist-delete" onclick="deletePlaylist(event, ${i})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/></svg>
      </button>
    </div>
  `).join('');
}

// ── Navigation ──
function setView(name, btnEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
  state.previousView = state.currentView;
  state.currentView = name;

  if (name === 'playlists') renderPlaylists();

  // Mobile: close sidebar
  document.getElementById('sidebar').classList.remove('open');
}

function setViewBtn(name) {
  const btn = document.querySelector(`[data-view="${name}"]`);
  setView(name, btn);
}

function goBack() {
  setViewBtn(state.previousView || 'home');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Detail Views ──
function showGenre(genre) {
  const files = state.genres[genre] || [];
  state.previousView = state.currentView;
  document.getElementById('detail-title').textContent = genre;
  renderMusicList(files, 'detail-list');
  // Store for playback
  window._detailFiles = files;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  state.currentView = 'detail';
}

function showArtist(artist) {
  const files = state.artists[artist] || [];
  state.previousView = state.currentView;
  document.getElementById('detail-title').textContent = artist;
  renderMusicList(files, 'detail-list');
  window._detailFiles = files;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  state.currentView = 'detail';
}

function showAlbum(album, artist) {
  const key = `${artist}|${album}`;
  const files = state.albums[key]?.files || [];
  state.previousView = state.currentView;
  document.getElementById('detail-title').textContent = album;
  renderMusicList(files, 'detail-list');
  window._detailFiles = files;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  state.currentView = 'detail';
}

function showPlaylist(i) {
  const pl = state.playlists[i];
  if (!pl) return;
  state.previousView = state.currentView;
  document.getElementById('detail-title').textContent = pl.name;
  renderMusicList(pl.files, 'detail-list');
  window._detailFiles = pl.files;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  state.currentView = 'detail';
}

// ── Playback ──
function playFromList(index, containerId) {
  let list;
  if (containerId === 'music-list') list = state.audioFiles;
  else if (containerId === 'detail-list') list = window._detailFiles || [];
  else if (containerId === 'search-results') list = window._searchFiles || [];
  else list = state.audioFiles;

  state.queue = [...list];
  state.queueIndex = index;
  playCurrentTrack();
}

async function playCurrentTrack() {
  const file = state.queue[state.queueIndex];
  if (!file) return;

  try {
    // Get a fresh streaming URL via Drive API
    const r = await gapi.client.drive.files.get({
      fileId: file.id,
      alt: 'media',
      supportsAllDrives: true,
    });

    // Use fetch with auth header to get blob URL
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${state.accessToken}` } }
    );

    if (!response.ok) throw new Error('Stream error');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const audio = document.getElementById('audio-player');
    audio.src = url;
    audio.volume = document.getElementById('volume-slider').value / 100;
    audio.play();

    updateNowPlaying(file);
    addToRecent(file);
    refreshTrackHighlight();
  } catch(e) {
    console.error('Playback error', e);
    nextTrack();
  }
}

async function playVideo(index) {
  const file = state.videoFiles[index];
  if (!file) return;

  document.getElementById('vp-title').textContent = file.name.replace(/\.[^.]+$/, '');
  document.getElementById('video-player').classList.remove('hidden');

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${state.accessToken}` } }
  );
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const video = document.getElementById('video-element');
  video.src = url;
  video.play();
}

function closeVideoPlayer() {
  const video = document.getElementById('video-element');
  video.pause();
  video.src = '';
  document.getElementById('video-player').classList.add('hidden');
}

function togglePlayPause() {
  const audio = document.getElementById('audio-player');
  if (audio.paused) audio.play(); else audio.pause();
}

function nextTrack() {
  if (!state.queue.length) return;
  if (state.shuffle) {
    state.queueIndex = Math.floor(Math.random() * state.queue.length);
  } else {
    state.queueIndex = (state.queueIndex + 1) % state.queue.length;
  }
  playCurrentTrack();
}

function prevTrack() {
  const audio = document.getElementById('audio-player');
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (!state.queue.length) return;
  state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
  playCurrentTrack();
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  document.getElementById('shuffle-btn').classList.toggle('active', state.shuffle);
  document.getElementById('fp-shuffle-btn').classList.toggle('active', state.shuffle);
}

function toggleRepeat() {
  const modes = ['off', 'all', 'one'];
  const i = modes.indexOf(state.repeatMode);
  state.repeatMode = modes[(i + 1) % modes.length];
  const btn = document.getElementById('fp-repeat-btn');
  btn.classList.toggle('active', state.repeatMode !== 'off');
  btn.style.opacity = state.repeatMode === 'off' ? '0.4' : '1';
}

function setVolume(val) {
  const audio = document.getElementById('audio-player');
  audio.volume = val / 100;
  document.getElementById('volume-slider').value = val;
  document.getElementById('fp-volume-slider').value = val;
}

function seekTo(e, isFull) {
  const bar = isFull ? document.getElementById('fp-progress') : document.getElementById('np-progress');
  const rect = bar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const audio = document.getElementById('audio-player');
  audio.currentTime = ratio * audio.duration;
}

// ── Now Playing UI ──
function updateNowPlaying(file) {
  const p = file._parsed || parseName(file.name);

  document.getElementById('np-title').textContent = p.title;
  document.getElementById('np-artist').textContent = p.artist || '—';
  document.getElementById('fp-title').textContent = p.title;
  document.getElementById('fp-artist').textContent = p.artist || '—';
  document.getElementById('fp-album').textContent = p.album || '';

  const thumb = file.thumbnailLink;
  const artHtml = thumb ? `<img src="${thumb}" alt="">` : audioIcon();
  document.getElementById('np-art').innerHTML = artHtml;
  document.getElementById('fp-art').innerHTML = thumb
    ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
    : `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

  document.getElementById('now-playing-bar').classList.remove('hidden');
}

function togglePlayer() {
  document.getElementById('full-player').classList.toggle('hidden');
}

function updatePlayPauseIcons(playing) {
  document.getElementById('play-icon').style.display = playing ? 'none' : 'block';
  document.getElementById('pause-icon').style.display = playing ? 'block' : 'none';
  document.getElementById('fp-play-icon').style.display = playing ? 'none' : 'block';
  document.getElementById('fp-pause-icon').style.display = playing ? 'block' : 'none';
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function refreshTrackHighlight() {
  document.querySelectorAll('.track-item').forEach((el, i) => {
    el.classList.toggle('playing', i === state.queueIndex);
  });
}

// ── Audio Events ──
function initAudioEvents() {
  const audio = document.getElementById('audio-player');

  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    document.getElementById('np-progress-fill').style.width = pct + '%';
    document.getElementById('fp-progress-fill').style.width = pct + '%';
    const cur = formatTime(audio.currentTime);
    const dur = formatTime(audio.duration);
    document.getElementById('np-current').textContent = cur;
    document.getElementById('np-duration').textContent = dur;
    document.getElementById('fp-current').textContent = cur;
    document.getElementById('fp-duration').textContent = dur;
  });

  audio.addEventListener('play', () => updatePlayPauseIcons(true));
  audio.addEventListener('pause', () => updatePlayPauseIcons(false));

  audio.addEventListener('ended', () => {
    if (state.repeatMode === 'one') { audio.currentTime = 0; audio.play(); return; }
    if (state.repeatMode === 'all' || state.queueIndex < state.queue.length - 1) nextTrack();
  });
}

// ── Search ──
function handleSearch(q) {
  const query = q.toLowerCase().trim();
  if (!query) {
    if (state.currentView === 'search') setViewBtn('home');
    return;
  }

  const results = state.audioFiles.filter(f => {
    const p = f._parsed || parseName(f.name);
    return (
      p.title.toLowerCase().includes(query) ||
      p.artist.toLowerCase().includes(query) ||
      p.album.toLowerCase().includes(query) ||
      f.name.toLowerCase().includes(query)
    );
  });

  window._searchFiles = results;
  renderMusicList(results, 'search-results');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-search').classList.add('active');
  state.currentView = 'search';
}

// ── Playlists ──
function loadPlaylists() {
  try {
    state.playlists = JSON.parse(localStorage.getItem('cp_playlists') || '[]');
  } catch(e) { state.playlists = []; }
}

function savePlaylists() {
  // Save without file objects (only IDs) to avoid storage limits
  const light = state.playlists.map(pl => ({
    ...pl,
    files: pl.files.map(f => f.id),
  }));
  localStorage.setItem('cp_playlists', JSON.stringify(light));
}

function showCreatePlaylist() {
  document.getElementById('playlist-name').value = '';
  const el = document.getElementById('genre-checkboxes');
  el.innerHTML = Object.keys(state.genres).map(g => `
    <label class="genre-check-label">
      <input type="checkbox" value="${esc(g)}"> ${esc(g)}
    </label>
  `).join('');
  document.getElementById('playlist-modal').classList.remove('hidden');
}

function hideCreatePlaylist() {
  document.getElementById('playlist-modal').classList.add('hidden');
}

function createPlaylist() {
  const name = document.getElementById('playlist-name').value.trim();
  if (!name) return;

  const checked = [...document.querySelectorAll('#genre-checkboxes input:checked')].map(c => c.value);
  let files = [];
  if (checked.length) {
    checked.forEach(g => { files.push(...(state.genres[g] || [])); });
    // Deduplicate
    const seen = new Set();
    files = files.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
  }

  state.playlists.push({ name, genres: checked, files });
  savePlaylists();
  hideCreatePlaylist();
  renderPlaylists();
}

function deletePlaylist(e, i) {
  e.stopPropagation();
  state.playlists.splice(i, 1);
  savePlaylists();
  renderPlaylists();
}

// ── Sort ──
function sortFiles(type, by) {
  const list = type === 'music' ? state.audioFiles : state.videoFiles;
  list.sort((a, b) => {
    const pa = a._parsed || parseName(a.name);
    const pb = b._parsed || parseName(b.name);
    if (by === 'artist') return (pa.artist || '').localeCompare(pb.artist || '');
    if (by === 'album') return (pa.album || '').localeCompare(pb.album || '');
    if (by === 'date') return new Date(b.modifiedTime) - new Date(a.modifiedTime);
    return pa.title.localeCompare(pb.title);
  });
  if (type === 'music') renderMusicList();
}

// ── Recently Played ──
function addToRecent(file) {
  state.recentlyPlayed = [file, ...state.recentlyPlayed.filter(f => f.id !== file.id)].slice(0, 12);
  renderRecent();
}

function renderRecent() {
  const el = document.getElementById('recent-grid');
  const section = document.getElementById('recent-section');
  if (!state.recentlyPlayed.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  el.innerHTML = state.recentlyPlayed.slice(0, 6).map((f, i) => {
    const p = f._parsed || parseName(f.name);
    return `
      <div class="media-card" onclick="playRecentTrack(${i})">
        <div class="media-card-art">
          ${f.thumbnailLink ? `<img src="${f.thumbnailLink}" alt="">` : audioIcon()}
          <div class="media-card-play">${playBigIcon()}</div>
        </div>
        <div class="media-card-info">
          <div class="media-card-title">${esc(p.title)}</div>
          <div class="media-card-sub">${esc(p.artist) || '—'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function playRecentTrack(i) {
  state.queue = [...state.recentlyPlayed];
  state.queueIndex = i;
  playCurrentTrack();
}

// ── Greeting ──
function updateGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = g;
}

// ── Helpers ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function emptyState(msg) {
  return `<div class="empty-state"><p>${msg}</p></div>`;
}

function audioIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
}

function videoIcon() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;
}

function albumIcon() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function playBigIcon() {
  return `<svg width="36" height="36" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>`;
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initAudioEvents();

  // Load Google APIs
  const gsiScript = document.createElement('script');
  gsiScript.src = 'https://accounts.google.com/gsi/client';
  gsiScript.async = true;
  gsiScript.defer = true;
  document.head.appendChild(gsiScript);

  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.async = true;
  gapiScript.defer = true;
  gapiScript.onload = initGoogle;
  document.head.appendChild(gapiScript);
});
