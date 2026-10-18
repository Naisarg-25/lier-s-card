/* ─── Shared Utilities ──────────────────────────────────────────────────────── */

function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ─── Session helpers ────────────────────────────────────────────────────────── */
const ls = {
  set: (k, v) => localStorage.setItem(`lc_${k}`, typeof v === 'object' ? JSON.stringify(v) : v),
  get: (k) => { try { return JSON.parse(localStorage.getItem(`lc_${k}`)); } catch { return localStorage.getItem(`lc_${k}`); } },
  del: (k) => localStorage.removeItem(`lc_${k}`)
};

function getPlayerId() {
  let id = ls.get('playerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    ls.set('playerId', id);
  }
  return id;
}
const myPlayerId = getPlayerId();

/* ─── Init ─────────────────────────────────────────────────────────────────── */
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 4000,
  timeout: 20000,
  transports: ['websocket', 'polling']
});

// Periodic heartbeat with identity to maintain active connection and self-heal session
setInterval(() => {
  if (socket && socket.connected) {
    socket.volatile.emit('clientHeartbeat', { playerId: myPlayerId });
  }
}, 5000);
let myName = ls.get('playerName') || '';
let cancellingMatchmaking = false;

const playerNameInput = document.getElementById('player-name');
const btnFriends      = document.getElementById('btn-friends');
const btnRandoms      = document.getElementById('btn-randoms');
const btnAI           = document.getElementById('btn-ai');

if (playerNameInput && myName) playerNameInput.value = myName;

// Save name on input
playerNameInput?.addEventListener('input', () => {
  myName = playerNameInput.value.trim();
  ls.set('playerName', myName);
});
playerNameInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') playerNameInput.blur();
});

function getPlayerName() {
  const n = (playerNameInput?.value || '').trim();
  if (!n) { showToast('Please enter your name first!', 'error'); playerNameInput?.focus(); return null; }
  ls.set('playerName', n);
  return n;
}

/* ─── FRIENDS ───────────────────────────────────────────────────────────────── */
btnFriends?.addEventListener('click', () => {
  openModal('join-modal');
  setTimeout(() => document.getElementById('room-code-input')?.focus(), 300);
});
btnFriends?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') btnFriends.click(); });

document.getElementById('join-cancel')?.addEventListener('click', () => closeModal('join-modal'));
document.getElementById('join-confirm')?.addEventListener('click', joinByCode);
document.getElementById('room-code-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') joinByCode(); });

function joinByCode() {
  const name = getPlayerName(); if (!name) return;
  const code = (document.getElementById('room-code-input')?.value || '').toUpperCase().trim();
  if (code.length < 4) { showToast('Enter a valid room code', 'error'); return; }
  socket.emit('joinRoom', { roomCode: code, playerName: name, playerId: myPlayerId }, (res) => {
    if (!res.ok) return showToast(res.err, 'error');
    ls.set('roomCode', res.roomCode);
    ls.set('isHost', false);
    location.href = '/lobby.html';
  });
}

document.getElementById('btn-create-friend')?.addEventListener('click', () => {
  const name = getPlayerName(); if (!name) return;
  closeModal('join-modal');
  socket.emit('createRoom', { mode: 'friends', playerName: name, playerId: myPlayerId }, (res) => {
    if (!res.ok) return showToast(res.err, 'error');
    ls.set('roomCode', res.roomCode);
    ls.set('isHost', true);
    location.href = '/lobby.html';
  });
});

/* ─── RANDOMS ───────────────────────────────────────────────────────────────── */
btnRandoms?.addEventListener('click', () => {
  const name = getPlayerName(); if (!name) return;
  socket.emit('joinRandom', { playerName: name, playerId: myPlayerId }, (res) => {
    if (!res.ok) return showToast(res.err, 'error');
    ls.set('roomCode', res.roomCode);
    ls.set('isHost', res.room?.hostId === myPlayerId);

    if (res.waiting) {
      // Show waiting modal
      document.getElementById('waiting-code').textContent = res.roomCode;
      openModal('waiting-modal');
    } else {
      location.href = '/lobby.html';
    }
  });
});
btnRandoms?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') btnRandoms.click(); });

// If random room auto-starts
socket.on('gameStarted', ({ roomCode }) => {
  if (cancellingMatchmaking) return;
  ls.set('roomCode', roomCode);
  location.href = '/game.html';
});

socket.on('roomUpdate', (room) => {
  const waitingCode = document.getElementById('waiting-code');
  if (waitingCode) {
    // We might be in the waiting modal
  }
});

document.getElementById('cancel-waiting')?.addEventListener('click', () => {
  const btn = document.getElementById('cancel-waiting');
  cancellingMatchmaking = true;
  btn.disabled = true;
  socket.timeout(5000).emit('leaveRoom', { roomCode: ls.get('roomCode') }, (err, res) => {
    if (err || !res?.ok) {
      cancellingMatchmaking = false;
      showToast(res?.err || 'Could not leave matchmaking. Please try again.', 'error');
      btn.disabled = false;
      return;
    }
    closeModal('waiting-modal');
    ls.del('roomCode');
    ls.del('isHost');
    cancellingMatchmaking = false;
    btn.disabled = false;
  });
});

/* ─── AI ────────────────────────────────────────────────────────────────────── */
btnAI?.addEventListener('click', () => {
  openModal('ai-modal');
});
btnAI?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') btnAI.click(); });

const slider = document.getElementById('bot-count-slider');
const display = document.getElementById('bot-count-display');

function updateSlider() {
  if (!slider || !display) return;
  const val = parseInt(slider.value) || 1;
  display.textContent = val;
  const pct = ((val - 1) / 4 * 100).toFixed(0) + '%';
  slider.style.setProperty('--val', pct);
}
slider?.addEventListener('input', updateSlider);
if (slider) {
  slider.value = '1';
  updateSlider();
}

document.getElementById('ai-cancel')?.addEventListener('click', () => closeModal('ai-modal'));
document.getElementById('ai-confirm')?.addEventListener('click', () => {
  const name = getPlayerName(); if (!name) { closeModal('ai-modal'); return; }
  const botCount = parseInt(slider?.value || 1);
  socket.emit('createRoom', { mode: 'ai', playerName: name, botCount, playerId: myPlayerId }, (res) => {
    if (!res.ok) return showToast(res.err, 'error');
    ls.set('roomCode', res.roomCode);
    ls.set('isHost', true);
    location.href = '/lobby.html';
  });
});

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
