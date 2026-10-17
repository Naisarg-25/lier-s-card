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

function getInitial(name) {
  return String(name ?? '?').charAt(0).toUpperCase();
}

/* ─── Session ───────────────────────────────────────────────────────────────── */
const roomCode = ls.get('roomCode');
const myName   = localStorage.getItem('lc_playerName') || 'Player';
let   isHost   = ls.get('isHost') === true || ls.get('isHost') === 'true';
let   currentRoom = null;

if (!roomCode) { location.href = '/'; }

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 4000,
  timeout: 20000,
  transports: ['websocket', 'polling']
});

// Periodic heartbeat to prevent disconnect
setInterval(() => {
  if (socket && socket.connected) {
    socket.volatile.emit('clientHeartbeat');
  }
}, 8000);

socket.on('disconnect', (reason) => {
  console.warn('[Lobby] Disconnected:', reason);
  showToast('Connection lost. Reconnecting to lobby...', 'info');
});

/* ─── Socket events ─────────────────────────────────────────────────────────── */
socket.on('connect', () => {
  rejoin();
});

function rejoin() {
  socket.emit('joinRoom', { roomCode, playerName: myName, playerId: myPlayerId }, (res) => {
    if (!res.ok) {
      showToast(res.err || 'Could not join room', 'error');
      setTimeout(() => location.href = '/', 2500);
      return;
    }
    currentRoom = res.room;
    isHost = res.room.hostId === myPlayerId;
    ls.set('isHost', isHost);
    renderRoom(res.room);
  });
}

socket.on('roomUpdate', (room) => {
  currentRoom = room;
  isHost = room.hostId === myPlayerId;
  ls.set('isHost', isHost);
  renderRoom(room);
});

socket.on('gameStarted', ({ roomCode: rc }) => {
  ls.set('roomCode', rc);
  location.href = '/game.html';
});

socket.on('kicked', ({ message }) => {
  ls.del('roomCode');
  ls.del('isHost');
  alert(message || 'You were removed from the lobby.');
  location.href = '/';
});

/* ─── Render ────────────────────────────────────────────────────────────────── */
function renderRoom(room) {
  // Room code
  const codeEl = document.getElementById('room-code-display');
  if (codeEl) codeEl.textContent = room.code;

  // Mode badge
  const badgeContainer = document.getElementById('mode-badge-container');
  if (badgeContainer) {
    const icons = { friends: '🤝', random: '🌍', ai: '🤖' };
    const labels = { friends: 'Friends Mode', random: 'Random Matchmaking', ai: 'VS AI Bots' };
    badgeContainer.innerHTML = `<span class="mode-badge ${room.mode}">${icons[room.mode] || '🎮'} ${labels[room.mode] || room.mode}</span>`;
  }

  // Player count
  const humanCount = room.players.filter(p => !p.isAI).length;
  const totalCount = room.players.length;
  const countEl = document.getElementById('player-count');
  if (countEl) countEl.textContent = `${totalCount} / ${room.maxPlayers}`;

  const waitingCountEl = document.getElementById('player-count-waiting');
  if (waitingCountEl) waitingCountEl.textContent = humanCount;

  // Show/hide random waiting message
  const randomWaiting = document.getElementById('random-waiting');
  if (randomWaiting) {
    randomWaiting.style.display = (room.mode === 'random' && room.status === 'waiting' && humanCount < room.maxPlayers) ? 'flex' : 'none';
  }

  // Hide code section for random mode
  const codeSection = document.getElementById('code-section');
  if (codeSection) {
    codeSection.style.display = (room.mode === 'random') ? 'none' : 'block';
  }

  // Add AI Bot button (visible to host in lobby before game starts)
  const addBotBtn = document.getElementById('add-bot-btn');
  if (addBotBtn) {
    if (isHost && room.status === 'waiting') {
      addBotBtn.style.display = 'inline-flex';
      const canAdd = room.players.length < room.maxPlayers;
      addBotBtn.disabled = !canAdd;
      addBotBtn.textContent = canAdd ? '🤖 + Add AI Bot' : 'Max Players (6)';
    } else {
      addBotBtn.style.display = 'none';
    }
  }

  // Player list
  const list = document.getElementById('player-list');
  if (list) {
    list.innerHTML = '';
    room.players.forEach(p => {
      const isMe       = p.id === myPlayerId;
      const isRoomHost = p.id === room.hostId;
      const item       = document.createElement('div');
      item.className   = 'player-item';
      const playerName = String(p.name ?? 'Player');

      const avatarClass = p.isAI ? 'player-avatar ai-avatar' : 'player-avatar';
      const badges = [
        isRoomHost ? '<span class="player-badge badge-host">HOST</span>' : '',
        isMe       ? '<span class="player-badge badge-you">YOU</span>'   : '',
        p.isAI     ? '<span class="player-badge badge-bot">BOT</span>'   : '',
        (p.connected === false && !p.isAI) ? '<span class="player-badge" style="background:#ea580c;color:#fff;">OFFLINE</span>' : '',
      ].join('');

      // Host can remove AI bots OR other humans
      const canRemove = isHost && !isMe && room.status === 'waiting';
      const removeBtn = canRemove
        ? `<button class="player-remove-btn" data-id="${p.id}" title="Remove from lobby">✕ Remove</button>`
        : '';

      item.innerHTML = `
        <div class="${avatarClass}">${p.isAI ? '🤖' : getInitial(playerName)}</div>
        <div class="player-info">
          <div class="player-name">${escHtml(playerName)} ${badges}</div>
        </div>
        ${removeBtn}
      `;
      list.appendChild(item);
    });

    // Remove player / bot handlers
    list.querySelectorAll('.player-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPlayerId = btn.dataset.id;
        socket.emit('removePlayer', { roomCode, targetPlayerId }, (res) => {
          if (!res.ok) showToast(res.err, 'error');
        });
      });
    });
  }

  // Start button
  const startBtn = document.getElementById('start-btn');
  const waitingMsg = document.getElementById('waiting-for-host');

  if (isHost) {
    if (startBtn) {
      startBtn.style.display = 'block';
      startBtn.disabled = room.players.length < 2;
      startBtn.title = room.players.length < 2 ? 'Need at least 2 players' : '';
    }
    if (waitingMsg) waitingMsg.style.display = 'none';
  } else {
    if (startBtn) startBtn.style.display = 'none';
    if (waitingMsg) waitingMsg.style.display = 'flex';
  }
}

// Add Bot Button listener
document.getElementById('add-bot-btn')?.addEventListener('click', () => {
  socket.emit('addBot', { roomCode }, (res) => {
    if (!res.ok) showToast(res.err, 'error');
  });
});

/* ─── Actions ───────────────────────────────────────────────────────────────── */
document.getElementById('start-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('start-btn');
  btn.disabled = true; btn.textContent = 'Starting...';
  socket.emit('startGame', { roomCode }, (res) => {
    if (!res.ok) {
      showToast(res.err, 'error');
      btn.disabled = false; btn.textContent = '⚔️ Start Game';
    }
  });
});

document.getElementById('leave-btn')?.addEventListener('click', () => {
  const btn = document.getElementById('leave-btn');
  if (btn) btn.disabled = true;
  socket.timeout(5000).emit('leaveRoom', { roomCode }, (err, res) => {
    if (err || !res?.ok) {
      showToast(res?.err || 'Could not leave the lobby. Please try again.', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    ls.del('roomCode');
    ls.del('isHost');
    socket.disconnect();
    location.replace('/');
  });
});

// Copy code
document.getElementById('copy-code-btn')?.addEventListener('click', () => {
  if (!roomCode) return;
  navigator.clipboard.writeText(roomCode).then(() => showToast('Room code copied!', 'success'));
});

document.getElementById('copy-link-btn')?.addEventListener('click', () => {
  if (!roomCode) return;
  const url = `${location.origin}?join=${roomCode}`;
  navigator.clipboard.writeText(url).then(() => showToast('Invite link copied!', 'success'));
});

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
