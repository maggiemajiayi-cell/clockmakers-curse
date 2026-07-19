/* =============================================
   THE CLOCKMAKER'S CURSE — GAME ENGINE
   Framework skeleton; puzzles to be filled in.
   ============================================= */

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  currentRoom: 'workshop',
  inventory: [],
  solvedPuzzles: new Set(),
  notes: [],
  selectedItem: null,
  gameStartTime: null,
};

// ─── ITEMS ───────────────────────────────────────────────────────────────────
// (To be expanded with all three components + supporting items)
const ITEMS = {
  // Placeholder items — will be populated per puzzle design
  spectacles: {
    id: 'spectacles',
    name: 'Spectacles',
    icon: '🥽',
    desc: 'Round brass-framed spectacles. The lenses magnify faint engravings.',
  },
  music_box: {
    id: 'music_box',
    name: 'Music Box',
    icon: '🎵',
    desc: 'A tiny octagonal music box. It plays a rhythm when wound: long, short, short, long...',
  },
  winding_key: {
    id: 'winding_key',
    name: 'Winding Key',
    icon: '🗝️',
    desc: 'A delicate clockwork key. Ice-cold to the touch. This must fit the drive shaft.',
  },
};

// ─── PUZZLES ─────────────────────────────────────────────────────────────────
// Skeleton — puzzle logic to be designed in next phase
const PUZZLES = {};

// ─── AUDIO / OPENING CINEMATIC ──────────────────────────────────────────────
const bgm = document.getElementById('bgm');
const introVideo = document.getElementById('intro-video');
const introOverlay = document.getElementById('intro-video-overlay');
const volumeControl = document.getElementById('volume-control');
const volumeToggle = document.getElementById('volume-toggle');
const volumePanel = document.getElementById('volume-panel');
const volumeIcon = document.getElementById('volume-icon');
const volumeMarks = document.querySelectorAll('.volume-mark');
let introWatchdog = null;
let introActive = false;
const INTRO_END_EARLY_SECONDS = 0.45;
const INTRO_MAX_WAIT_MS = 16000;

function ensureBgm() {
  if (!bgm || !bgm.paused) return;
  bgm.play().catch(() => {
    // Audible autoplay may be blocked until the visitor interacts with the page.
  });
}

function setVolume(level, resumePlayback = true) {
  const safeLevel = [0, 25, 50, 75, 100].includes(level) ? level : 75;

  if (bgm) {
    bgm.volume = safeLevel / 100;
    bgm.muted = safeLevel === 0;
  }

  if (volumeIcon) {
    volumeIcon.dataset.level = String(safeLevel);
  }
  if (volumeToggle) volumeToggle.setAttribute('aria-label', `Adjust volume, currently ${safeLevel} percent`);

  volumeMarks.forEach(mark => {
    const active = Number(mark.dataset.volume) === safeLevel;
    mark.classList.toggle('active', active);
    mark.setAttribute('aria-pressed', String(active));
  });

  try { localStorage.setItem('clockwork-volume', String(safeLevel)); } catch (_) {}
  if (resumePlayback && safeLevel > 0) ensureBgm();
}

function toggleVolumePanel() {
  if (!volumePanel || !volumeToggle) return;
  const willOpen = volumePanel.classList.contains('is-hidden');
  volumePanel.classList.toggle('is-hidden', !willOpen);
  volumeToggle.setAttribute('aria-expanded', String(willOpen));
}

function closeVolumePanel() {
  if (!volumePanel || !volumeToggle) return;
  volumePanel.classList.add('is-hidden');
  volumeToggle.setAttribute('aria-expanded', 'false');
}

if (volumeToggle) {
  volumeToggle.addEventListener('click', event => {
    event.stopPropagation();
    toggleVolumePanel();
  });
}

volumeMarks.forEach(mark => {
  mark.addEventListener('click', event => {
    event.stopPropagation();
    setVolume(Number(mark.dataset.volume));
  });
});

document.addEventListener('click', event => {
  if (volumeControl && !volumeControl.contains(event.target)) closeVolumePanel();
});

let initialVolume = 75;
try {
  const savedVolume = localStorage.getItem('clockwork-volume');
  if (savedVolume !== null) initialVolume = Number(savedVolume);
} catch (_) {}
setVolume(initialVolume, false);

function playIntro() {
  ensureBgm();

  if (!introVideo || !introOverlay) {
    enterShop();
    return;
  }

  introActive = true;
  introVideo.currentTime = 0;
  introOverlay.classList.remove('is-hidden');
  introOverlay.setAttribute('aria-hidden', 'false');

  introVideo.play().catch(() => finishIntro());

  // Never leave the visitor trapped behind a stalled media element.
  clearTimeout(introWatchdog);
  introWatchdog = setTimeout(finishIntro, INTRO_MAX_WAIT_MS);
}

function finishIntro() {
  if (!introActive) return;
  introActive = false;
  clearTimeout(introWatchdog);
  if (introVideo) introVideo.pause();
  if (introOverlay) {
    introOverlay.classList.add('is-hidden');
    introOverlay.setAttribute('aria-hidden', 'true');
  }
  enterShop();
}

if (introVideo) {
  introVideo.addEventListener('ended', finishIntro);
  introVideo.addEventListener('error', finishIntro);
  introVideo.addEventListener('timeupdate', () => {
    if (
      introActive &&
      Number.isFinite(introVideo.duration) &&
      introVideo.duration - introVideo.currentTime <= INTRO_END_EARLY_SECONDS
    ) {
      finishIntro();
    }
  });
}

// Try immediately, then retry on the first user gesture for browsers that
// disallow audible autoplay on page load.
ensureBgm();
['pointerdown', 'keydown', 'touchstart'].forEach(eventName => {
  document.addEventListener(eventName, ensureBgm);
});

// ─── SCREEN TRANSITIONS ──────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── ENTER SHOP ──────────────────────────────────────────────────────────────
function enterShop() {
  state.currentRoom = 'workshop';
  state.inventory   = [];
  state.solvedPuzzles = new Set();
  state.notes       = [];
  state.selectedItem = null;
  state.gameStartTime = Date.now();

  showScreen('game-screen');
  renderSidebar();
  showDialogue(
    'The pendulum swings above you — <em>tick... tock... tick...</em><br/>' +
    'Your hands are cold. Your chest doesn\'t beat. Something here feels horribly familiar.'
  );
}

function resetGame() { showScreen('landing-screen'); }

// ─── INVENTORY SIDEBAR ───────────────────────────────────────────────────────
function hasItem(id) { return state.inventory.includes(id); }

function addItem(id) {
  if (!state.inventory.includes(id)) {
    state.inventory.push(id);
    renderSidebar();
    flashSidebar();
  }
}

function removeItem(id) {
  state.inventory = state.inventory.filter(i => i !== id);
  if (state.selectedItem === id) {
    state.selectedItem = null;
    updateSidebarFooter();
    updateUsePrompt();
  }
  renderSidebar();
}

function renderSidebar() {
  const list  = document.getElementById('inv-sidebar-list');
  const empty = document.getElementById('inv-sidebar-empty');
  if (!list) return;

  list.querySelectorAll('.inv-card').forEach(c => c.remove());

  if (state.inventory.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.inventory.forEach(id => {
    const item = ITEMS[id];
    if (!item) return;
    const card = document.createElement('div');
    card.className = 'inv-card' + (state.selectedItem === id ? ' selected' : '');
    card.id = `inv-card-${id}`;
    card.title = item.desc;
    card.innerHTML = `
      <div class="inv-card-icon">${item.icon}</div>
      <div class="inv-card-name">${item.name}</div>
    `;
    card.addEventListener('click', () => selectItem(id));
    list.appendChild(card);
  });

  updateSidebarFooter();
}

function updateSidebarFooter() {
  const footer = document.getElementById('inv-sidebar-footer');
  if (!footer) return;
  if (state.selectedItem && ITEMS[state.selectedItem]) {
    const item = ITEMS[state.selectedItem];
    document.getElementById('inv-footer-icon').textContent = item.icon;
    document.getElementById('inv-footer-name').textContent = item.name;
    document.getElementById('inv-footer-desc').textContent = item.desc;
    footer.style.display = 'flex';
  } else {
    footer.style.display = 'none';
  }
}

function flashSidebar() {
  const sb = document.getElementById('inv-sidebar');
  if (!sb) return;
  sb.style.boxShadow = '-4px 0 28px rgba(200,144,10,0.6)';
  setTimeout(() => { sb.style.boxShadow = ''; }, 1600);
}

function selectItem(id) {
  state.selectedItem = (state.selectedItem === id) ? null : id;
  document.querySelectorAll('.inv-card').forEach(c => c.classList.remove('selected'));
  if (state.selectedItem) {
    const card = document.getElementById(`inv-card-${id}`);
    if (card) card.classList.add('selected');
  }
  updateSidebarFooter();
  updateUsePrompt();
}

function cancelUse() {
  state.selectedItem = null;
  document.querySelectorAll('.inv-card').forEach(c => c.classList.remove('selected'));
  updateSidebarFooter();
  updateUsePrompt();
}

function updateUsePrompt() {
  // (No floating use-prompt in this game — sidebar footer handles it)
}

// ─── ROOM INTERACTION ─────────────────────────────────────────────────────────
function interact(objId) {
  showDialogue('The gears turn slowly... <em>this part of the clock is not yet ready.</em>');
}

// ─── NOTES / JOURNAL ─────────────────────────────────────────────────────────
function addNote(title, body) {
  state.notes.push({ title, body });
}

function openNotes() {
  const modal   = document.getElementById('notes-modal');
  const content = document.getElementById('notes-content');
  if (state.notes.length === 0) {
    content.innerHTML = '<p class="notes-empty">Your journal is empty.<br/>Examine objects to record observations.</p>';
  } else {
    content.innerHTML = state.notes.map(n =>
      `<div class="note-entry"><strong>${n.title}</strong>${n.body}</div>`
    ).join('');
  }
  modal.classList.remove('hidden');
}
function closeNotes() { document.getElementById('notes-modal').classList.add('hidden'); }

// ─── DIALOGUE ─────────────────────────────────────────────────────────────────
let _dialogueTimer = null;
function showDialogue(text) {
  const box = document.getElementById('dialogue-box');
  document.getElementById('dialogue-text').innerHTML = text;
  box.classList.remove('hidden');
  if (_dialogueTimer) clearTimeout(_dialogueTimer);
  _dialogueTimer = setTimeout(closeDialogue, 7000);
}
function closeDialogue() {
  document.getElementById('dialogue-box').classList.add('hidden');
  if (_dialogueTimer) clearTimeout(_dialogueTimer);
}

// ─── PUZZLE MODAL ─────────────────────────────────────────────────────────────
function closePuzzle() { document.getElementById('puzzle-modal').classList.add('hidden'); }

// ─── WIN / END ────────────────────────────────────────────────────────────────
function triggerEnd() {
  setTimeout(() => showScreen('end-screen'), 2000);
}

// ─── KEYBOARD ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePuzzle(); closeNotes(); closeDialogue(); closeVolumePanel(); cancelUse(); }
  if (e.key === 'j' || e.key === 'J') openNotes();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
console.log('%c⚙ THE CLOCKMAKER\'S CURSE', 'color:#c8900a;font-size:22px;font-weight:bold;font-family:serif;');
console.log('%cFramework loaded. Puzzles incoming.', 'color:#8a5f06;font-family:serif;');
