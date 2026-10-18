/* ═══════════════════════════════════════════════════════════════════════════════
   Liar's Cards — Modern High-Stakes Casino Game Client
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

/* ─── Utilities ─────────────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg, type = 'info', duration = 3500) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out .3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, duration);
}

function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

const ls = {
  get: k => { try { return JSON.parse(localStorage.getItem(`lc_${k}`)); } catch { return localStorage.getItem(`lc_${k}`); } },
  set: (k, v) => localStorage.setItem(`lc_${k}`, typeof v === 'object' ? JSON.stringify(v) : v),
  del: k => localStorage.removeItem(`lc_${k}`)
};

function getPlayerId() {
  let id = ls.get('playerId');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    ls.set('playerId', id);
  }
  return id;
}

/* ─── Procedural Audio Engine (Web Audio API) ───────────────────────────────── */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = ls.get('sound_enabled') !== false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    ls.set('sound_enabled', this.enabled);
    this.updateUI();
    if (this.enabled) {
      this.init();
      this.playCardClick();
    }
    return this.enabled;
  }

  updateUI() {
    const icon = document.getElementById('sound-icon');
    const text = document.getElementById('sound-text');
    if (icon) icon.textContent = this.enabled ? '🔊' : '🔇';
    if (text) text.textContent = this.enabled ? 'Audio On' : 'Audio Off';
  }

  playCardClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  playCardPlay() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playPass() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playDare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    // Dramatic low suspense pulse
    [180, 220, 280].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.25);
    });
  }

  playTruthFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    // Major chord triumphant fanfare
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.07);
      gain.gain.setValueAtTime(0.22, this.ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.07);
      osc.stop(this.ctx.currentTime + i * 0.07 + 0.35);
    });
  }

  playLieBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    // Caught bluffing buzzer
    [160, 150].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.28, this.ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.15 + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.15);
      osc.stop(this.ctx.currentTime + i * 0.15 + 0.22);
    });
  }

  playYourTurn() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playEmote() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }
}

const sounds = new SoundEngine();

/* ─── Session ───────────────────────────────────────────────────────────────── */
const roomCode = ls.get('roomCode');
const myName   = localStorage.getItem('lc_playerName') || 'Player';
let   myId     = getPlayerId();

if (!roomCode) { location.href = '/'; }

/* ─── State ─────────────────────────────────────────────────────────────────── */
let gameState        = null;
let selectedCards    = [];         // ORDERED Array of card IDs selected for playing
let selectedRank     = null;       // rank declared for first play
let dareCardIdx      = null;       // card index selected in dare modal
let dareResolved     = false;      // dare modal showing result
let handSortMode     = 'rank';     // 'rank' | 'suit'
let prevTurnPlayerId = null;
let endModalTimer    = null;

/* ─── Socket ────────────────────────────────────────────────────────────────── */
const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 4000,
  timeout: 20000,
  transports: ['websocket', 'polling']
});
let hasConnectedBefore = false;
let hadConnectionIssue = false;

// Periodic heartbeat with identity to maintain active connection and self-heal session
setInterval(() => {
  if (socket && socket.connected) {
    socket.volatile.emit('clientHeartbeat', { playerId: myId, roomCode });
  }
}, 5000);

let reconnectBannerEl = null;

function updateConnectionBanner(isDisconnected, msg = '') {
  if (!reconnectBannerEl) {
    reconnectBannerEl = document.createElement('div');
    reconnectBannerEl.id = 'reconnect-banner';
    reconnectBannerEl.className = 'reconnect-banner';
    document.body.appendChild(reconnectBannerEl);
  }
  if (isDisconnected) {
    reconnectBannerEl.className = 'reconnect-banner show warning';
    reconnectBannerEl.innerHTML = `<span>⚠️</span> <span>${escHtml(msg || 'Connection lost. Reconnecting to table...')}</span>`;
  } else {
    reconnectBannerEl.className = 'reconnect-banner show connected';
    reconnectBannerEl.innerHTML = `<span>✅</span> <span>Reconnected to table!</span>`;
    setTimeout(() => {
      if (reconnectBannerEl && !reconnectBannerEl.classList.contains('warning')) {
        reconnectBannerEl.className = 'reconnect-banner';
      }
    }, 2500);
  }
}

socket.on('disconnect', (reason) => {
  console.warn('[Socket] Disconnected:', reason);
  hadConnectionIssue = true;
  updateConnectionBanner(true, `Connection lost (${reason}). Reconnecting to table...`);
});

socket.on('connect_error', (err) => {
  console.warn('[Socket] Connection error:', err);
  hadConnectionIssue = true;
  updateConnectionBanner(true, `Cannot reach the game server (${err.message}). Retrying...`);
});

socket.on('connect', () => {
  const isReconnect = hasConnectedBefore || hadConnectionIssue;
  hasConnectedBefore = true;
  socket.emit('joinRoom', { roomCode, playerName: myName, playerId: myId }, (res) => {
    if (!res.ok) {
      showToast(res.err || 'Connecting to table...', 'info');
      updateConnectionBanner(true, res.err || 'Could not rejoin the table.');
      if (res.err && (res.err.includes('removed') || res.err.includes('not found'))) {
        alert(res.err);
        location.href = '/';
      }
    } else {
      if (isReconnect) updateConnectionBanner(false);
      hadConnectionIssue = false;
      showToast(isReconnect ? 'Reconnected to game table' : 'Connected to game table', 'success', 2000);
    }
  });

  const el = document.getElementById('nav-room-code');
  if (el) el.textContent = roomCode || '------';
  sounds.updateUI();
});

socket.on('gameState', (state) => {
  const me = state.players.find(p => p.hand !== undefined);
  if (me && state.currentPlayerId === me.id && prevTurnPlayerId !== me.id) {
    sounds.playYourTurn();
  }
  prevTurnPlayerId = state.currentPlayerId;

  gameState = state;
  renderGameState(state);
});

socket.on('dareResult', (result) => {
  handleDareResult(result);
});

socket.on('gameRestarted', () => {
  if (endModalTimer !== null) {
    clearTimeout(endModalTimer);
    endModalTimer = null;
  }
  closeModal('end-modal');
  closeModal('dare-modal');
  selectedCards = [];
  selectedRank = null;
  dareCardIdx = null;
  dareResolved = false;
  prevTurnPlayerId = null;
  document.querySelectorAll('.rank-btn').forEach(button => button.classList.remove('selected'));
  const replayButton = document.getElementById('end-replay-btn');
  if (replayButton) {
    replayButton.disabled = false;
    replayButton.textContent = '🔄 Play Again';
  }
});

socket.on('playerEmote', ({ playerId, playerName, emote }) => {
  showPlayerEmote(playerId, emote);
  sounds.playEmote();
});

socket.on('kicked', ({ message }) => {
  ls.del('roomCode');
  alert(message || 'You were removed.');
  location.href = '/';
});

function exitGame() {
  if (!window.confirm('Exit this game?')) return;

  const exitButtons = [
    document.getElementById('nav-exit-btn'),
    document.getElementById('end-home-btn')
  ].filter(Boolean);
  exitButtons.forEach(button => { button.disabled = true; });

  socket.timeout(5000).emit('leaveRoom', { roomCode }, (err, res) => {
    if (err || !res?.ok) {
      showToast(res?.err || 'Could not exit the game. Please try again.', 'error');
      exitButtons.forEach(button => { button.disabled = false; });
      return;
    }
    ls.del('roomCode');
    ls.del('isHost');
    socket.disconnect();
    location.replace('/');
  });
}

document.getElementById('nav-exit-btn')?.addEventListener('click', exitGame);
document.getElementById('end-home-btn')?.addEventListener('click', exitGame);
document.getElementById('end-replay-btn')?.addEventListener('click', () => {
  const button = document.getElementById('end-replay-btn');
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Starting new game...';
  socket.timeout(5000).emit('playAgain', { roomCode }, (err, res) => {
    if (err || !res?.ok) {
      showToast(res?.err || 'Could not start another game. Please try again.', 'error');
      button.disabled = false;
      button.textContent = '🔄 Play Again';
    }
  });
});

function enterFullscreenLandscape() {
  const fullscreen = document.documentElement.requestFullscreen;
  if (!fullscreen) {
    showToast('Fullscreen is not supported here. Turn your phone sideways to continue.', 'info');
    return;
  }

  document.documentElement.requestFullscreen().then(() => {
    const orientation = screen.orientation;
    if (!orientation?.lock) {
      showToast('Turn your phone sideways to play in landscape.', 'info');
      return;
    }

    orientation.lock('landscape').catch(() => {
      showToast('Turn your phone sideways to play in landscape.', 'info');
    });
  }).catch(() => {
    showToast('Allow fullscreen, then turn your phone sideways to play.', 'error');
  });
}

document.getElementById('mobile-landscape-btn')?.addEventListener('click', enterFullscreenLandscape);
document.getElementById('mobile-fullscreen-btn')?.addEventListener('click', enterFullscreenLandscape);

/* ─── Card Utilities ────────────────────────────────────────────────────────── */
function cardColor(suit) { return RED_SUITS.has(suit) ? 'red' : 'black'; }

function rankDisplayName(rank) {
  const map = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  return map[rank] || rank;
}

function rankPluralName(rank) {
  const map = {
    A: 'Aces', '2': 'Twos', '3': 'Threes', '4': 'Fours', '5': 'Fives',
    '6': 'Sixes', '7': 'Sevens', '8': 'Eights', '9': 'Nines', '10': 'Tens',
    J: 'Jacks', Q: 'Queens', K: 'Kings'
  };
  return map[rank] || `${rank}s`;
}

/* ─── Playing Card DOM Generator ────────────────────────────────────────────── */
function buildPlayingCard(card, opts = {}) {
  const { selectable = false, selected = false, orderIndex = null, disabled = false } = opts;
  const div = document.createElement('div');

  const color = cardColor(card.suit);
  div.className = `play-card ${color}${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`;
  div.dataset.cardId = card.id;

  // Order badge if selected
  const orderBadgeHtml = (selected && orderIndex !== null)
    ? `<div class="card-order-badge">#${orderIndex + 1}</div>`
    : '';

  div.innerHTML = `
    ${orderBadgeHtml}
    <div class="card-corner">
      <div class="card-rank">${escHtml(card.rank)}</div>
      <div class="card-suit-sm">${escHtml(card.suit)}</div>
    </div>
    <div class="card-suit-center">${escHtml(card.suit)}</div>
    <div class="card-corner bottom">
      <div class="card-rank">${escHtml(card.rank)}</div>
      <div class="card-suit-sm">${escHtml(card.suit)}</div>
    </div>
  `;

  if (selectable && !disabled) {
    div.addEventListener('click', () => {
      toggleCardSelection(card.id);
    });
  }
  return div;
}

/* ─── Card Selection & Ordering Logic ───────────────────────────────────────── */
function toggleCardSelection(id) {
  if (!gameState) return;
  const isMyTurn = gameState.currentPlayerId === myId;
  if (!isMyTurn) return;

  const idx = selectedCards.indexOf(id);
  if (idx !== -1) {
    // Unselect
    selectedCards.splice(idx, 1);
  } else {
    // Select in explicit chosen sequence
    selectedCards.push(id);
    sounds.playCardClick();
  }

  renderMyHand(gameState);
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

function moveStagedCard(fromIdx, direction) {
  const toIdx = fromIdx + direction;
  if (toIdx < 0 || toIdx >= selectedCards.length) return;
  const temp = selectedCards[fromIdx];
  selectedCards[fromIdx] = selectedCards[toIdx];
  selectedCards[toIdx] = temp;

  sounds.playCardClick();
  renderMyHand(gameState);
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

function removeStagedCard(idx) {
  if (idx < 0 || idx >= selectedCards.length) return;
  selectedCards.splice(idx, 1);

  renderMyHand(gameState);
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

function clearAllSelectedCards() {
  selectedCards = [];
  renderMyHand(gameState);
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

function reverseSelectedOrder() {
  selectedCards.reverse();
  sounds.playCardClick();
  renderMyHand(gameState);
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

/* ─── Staging Tray (Selected Cards Order Preview) ───────────────────────────── */
function renderStagingTray() {
  const tray = document.getElementById('staging-tray');
  const row  = document.getElementById('staging-cards-row');
  if (!tray || !row) return;

  if (selectedCards.length === 0) {
    tray.style.display = 'none';
    row.innerHTML = '';
    return;
  }

  tray.style.display = 'flex';
  row.innerHTML = '';

  const me = gameState?.players.find(p => p.hand !== undefined);
  if (!me) return;

  const handMap = new Map(me.hand.map(c => [c.id, c]));
  const currentClaim = gameState.declaredRank || selectedRank;

  selectedCards.forEach((cardId, index) => {
    const card = handMap.get(cardId);
    if (!card) return;

    const isTruth = currentClaim ? (card.rank === currentClaim) : null;
    const color   = cardColor(card.suit);

    const slot = document.createElement('div');
    slot.className = 'staged-slot';

    const truthBadge = isTruth === true
      ? `<span class="staged-truth-tag truth">🛡️ TRUTH</span>`
      : isTruth === false
      ? `<span class="staged-truth-tag bluff">🎭 BLUFF</span>`
      : `<span class="staged-truth-tag" style="color:var(--text-dim);">? CLAIM</span>`;

    slot.innerHTML = `
      <div class="staged-slot-badge">#${index + 1} TO PLAY</div>
      <div class="staged-slot-card ${color}">
        <div class="card-corner">
          <div class="card-rank">${escHtml(card.rank)}</div>
          <div class="card-suit-sm">${escHtml(card.suit)}</div>
        </div>
        <div class="card-suit-center">${escHtml(card.suit)}</div>
        <div class="card-corner bottom">
          <div class="card-rank">${escHtml(card.rank)}</div>
          <div class="card-suit-sm">${escHtml(card.suit)}</div>
        </div>
      </div>
      ${truthBadge}
      <div class="staged-controls">
        <button class="staged-move-btn" title="Move earlier in play order" ${index === 0 ? 'disabled' : ''} data-action="prev">◀</button>
        <button class="staged-move-btn" title="Move later in play order" ${index === selectedCards.length - 1 ? 'disabled' : ''} data-action="next">▶</button>
        <button class="staged-remove-btn" title="Remove from play" data-action="remove">✕</button>
      </div>
    `;

    slot.querySelector('[data-action="prev"]')?.addEventListener('click', () => moveStagedCard(index, -1));
    slot.querySelector('[data-action="next"]')?.addEventListener('click', () => moveStagedCard(index, 1));
    slot.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeStagedCard(index));

    row.appendChild(slot);
  });
}

function updateSelectedInfo() {
  const info = document.getElementById('selected-info');
  if (!info) return;
  if (selectedCards.length > 0) {
    info.style.display = 'inline-block';
    const claim = gameState?.declaredRank || selectedRank;
    const claimPart = claim ? ` as ${rankPluralName(claim)}` : '';
    info.textContent = `🎯 ${selectedCards.length} card(s) staged in order${claimPart}`;
  } else {
    info.style.display = 'none';
  }
}

/* ─── Rank Selector (First Play) ────────────────────────────────────────────── */
function buildRankSelector() {
  const container = document.getElementById('rank-buttons-container');
  if (!container) return;
  container.innerHTML = '';
  RANKS.forEach(rank => {
    const btn = document.createElement('button');
    btn.className = 'rank-btn';
    btn.textContent = rankDisplayName(rank);
    btn.dataset.rank = rank;
    btn.addEventListener('click', () => selectRank(rank));
    container.appendChild(btn);
  });
}
buildRankSelector();

function selectRank(rank) {
  selectedRank = rank;
  document.querySelectorAll('.rank-btn').forEach(b => b.classList.toggle('selected', b.dataset.rank === rank));
  sounds.playCardClick();
  renderStagingTray();
  updateActionButtons(gameState);
  updateSelectedInfo();
}

/* ─── Render Full Game State ────────────────────────────────────────────────── */
function renderGameState(state) {
  if (!state) return;

  const me = state.players.find(p => p.hand !== undefined);
  if (me) {
    myId = me.id;
    ls.set('playerId', myId);
  }

  const isMyTurn = state.currentPlayerId === myId;
  const isEnded  = state.phase === 'ended';

  // Locked temp pile count
  const tempEl = document.getElementById('temp-pile-count');
  if (tempEl) tempEl.textContent = state.tempPileCount;

  // Turn banner
  const turnBanner = document.getElementById('turn-banner');
  const bannerText = turnBanner?.querySelector('.turn-banner-text');
  if (turnBanner && bannerText) {
    if (isEnded) {
      bannerText.textContent = 'Game Over!';
      turnBanner.className = 'turn-banner other-turn';
    } else if (isMyTurn) {
      const pendingOpp = state.players.find(p => p.pendingFinish && p.id !== myId);
      if (pendingOpp) {
        bannerText.textContent = `🚨 ${pendingOpp.name} played their last cards! Dare them or Pass!`;
      } else {
        bannerText.textContent = '✨ YOUR TURN — Select cards in order, Dare or Pass!';
      }
      turnBanner.className = 'turn-banner my-turn';
    } else {
      const cur = state.players.find(p => p.id === state.currentPlayerId);
      if (cur && cur.connected === false) {
        const turnSec = state.turnDeadline ? Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000)) : 15;
        bannerText.textContent = `⏳ ${cur.name} is offline — auto-move in ${turnSec}s...`;
      } else {
        bannerText.textContent = cur ? `${cur.name} is thinking...` : 'Waiting for next player...';
      }
      turnBanner.className = 'turn-banner other-turn';
    }
  }

  // Declared rank display
  const rankVal = document.getElementById('declared-rank-val');
  const ruleTag = document.getElementById('declared-rule-tag');
  if (rankVal) {
    if (state.declaredRank) {
      rankVal.textContent = rankPluralName(state.declaredRank);
      rankVal.style.color = 'var(--gold)';
      if (ruleTag) ruleTag.textContent = `Claim: All played cards must be ${rankPluralName(state.declaredRank)}!`;
    } else {
      rankVal.textContent = '—';
      rankVal.style.color = 'var(--text-dim)';
      if (ruleTag) ruleTag.textContent = 'First player selects the claimed rank!';
    }
  }

  // Discard pile & opponents
  renderDiscardPile(state);
  renderOpponents(state);

  // My Hand & Staging Tray
  renderMyHand(state);
  renderStagingTray();

  // Rank selector visibility
  const rankSel = document.getElementById('rank-selector');
  if (rankSel) {
    const showRank = isMyTurn && !isEnded && state.discardPile.length === 0;
    rankSel.classList.toggle('hidden', !showRank);
    if (!showRank) {
      selectedRank = null;
      document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('selected'));
    }
  }

  // Clear selections if turn passed to someone else
  if (!isMyTurn) {
    selectedCards = [];
    renderStagingTray();
    updateSelectedInfo();
  }

  // Action buttons
  updateActionButtons(state);

  // Game log
  renderGameLog(state.gameLog);

  // Game end
  if (isEnded && endModalTimer === null && !document.getElementById('end-modal')?.classList.contains('open')) {
    const delay = dareResolved ? 1600 : 1200;
    endModalTimer = setTimeout(() => {
      endModalTimer = null;
      if (gameState?.phase === 'ended') {
        closeModal('dare-modal');
        showEndModal(gameState);
      }
    }, delay);
  }
}

/* ─── Render Discard Pile ───────────────────────────────────────────────────── */
function renderDiscardPile(state) {
  const stack       = document.getElementById('discard-stack');
  const emptyMsg    = document.getElementById('discard-empty-msg');
  const totalBadge  = document.getElementById('discard-total-badge');
  const lastPlayInd = document.getElementById('last-play-indicator');
  if (!stack) return;

  const totalCards = state.discardPile.reduce((sum, e) => sum + e.count, 0);
  if (totalBadge) totalBadge.textContent = `${totalCards} card${totalCards !== 1 ? 's' : ''}`;

  if (state.discardPile.length === 0) {
    stack.innerHTML = '';
    if (emptyMsg) { emptyMsg.style.display = 'flex'; stack.appendChild(emptyMsg); }
    if (lastPlayInd) lastPlayInd.style.display = 'none';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  stack.innerHTML = '';
  state.discardPile.forEach((entry, i) => {
    const isLast = (i === state.discardPile.length - 1);
    const div = document.createElement('div');
    div.className = `discard-entry${isLast ? ' is-last-play' : ''}`;

    const cardsHtml = Array.from({ length: entry.count }, () =>
      `<div class="discard-mini-card"></div>`
    ).join('');

    div.innerHTML = `
      <div class="discard-entry-name">${escHtml(entry.playerName)} ${isLast ? '🎯' : ''}</div>
      <div class="discard-entry-cards">${cardsHtml}</div>
      <div class="discard-entry-meta">${entry.count} card${entry.count > 1 ? 's' : ''} in order</div>
    `;
    stack.appendChild(div);
  });
}

/* ─── Render Opponents ──────────────────────────────────────────────────────── */
function renderOpponents(state) {
  const row = document.getElementById('opponents-row');
  if (!row) return;

  const me = state.players.find(p => p.hand !== undefined);
  const opponents = state.players.filter(p => p.id !== (me?.id));

  row.innerHTML = '';
  opponents.forEach(p => {
    const isCurrentTurn = p.id === state.currentPlayerId;
    const isPassed      = p.passed;
    const isFinished    = p.finished;
    const isLoser       = p.isLoser;
    const isWinner      = state.winner?.id === p.id;
    const isDareTarget  = state.lastPlayerId === p.id && state.discardPile.length > 0;

    const panel = document.createElement('div');
    panel.id = `opp-panel-${p.id}`;
    panel.className = `opponent-panel${isCurrentTurn ? ' is-turn' : ''}${isDareTarget ? ' dare-target' : ''}${isFinished ? ' finished' : ''}${isPassed ? ' passed' : ''}`;

    let statusTxt   = '';
    let statusClass = '';
    const now = Date.now();
    const isDisconnected = p.connected === false && !isFinished;

    if (isWinner) {
      statusTxt = '🏆 WINNER'; statusClass = 'status-finished';
    } else if (isLoser) {
      statusTxt = '💀 LOSER'; statusClass = 'status-passed';
    } else if (isDisconnected) {
      let secondsLeft = 60;
      if (p.disconnectDeadline) {
        secondsLeft = Math.max(0, Math.ceil((p.disconnectDeadline - now) / 1000));
      }
      if (isCurrentTurn && state.turnDeadline) {
        const turnSec = Math.max(0, Math.ceil((state.turnDeadline - now) / 1000));
        statusTxt = `⏳ Turn (${turnSec}s)`;
        statusClass = 'status-disconnected';
      } else {
        statusTxt = `📴 Offline (${secondsLeft}s)`;
        statusClass = 'status-disconnected';
      }
    } else if (p.pendingFinish) {
      statusTxt = '⚠️ Empty!'; statusClass = 'status-empty';
    } else if (isFinished) {
      statusTxt = '✅ Finished'; statusClass = 'status-finished';
    } else if (isPassed) {
      statusTxt = '🚫 Passed'; statusClass = 'status-passed';
    } else if (isCurrentTurn) {
      statusTxt = '🤔 Turn...'; statusClass = 'status-turn';
    } else if (isDareTarget) {
      statusTxt = '🎯 Dare'; statusClass = 'status-empty';
    } else {
      statusTxt = `${p.handCount} cards`;
    }

    panel.innerHTML = `
      <div class="opp-avatar-wrap">
        <div class="opp-avatar ${p.isAI ? 'ai' : ''} ${isFinished ? 'finished' : ''} ${isLoser ? 'loser' : ''} ${isDisconnected ? 'disconnected' : ''}">
          ${isCurrentTurn ? '<div class="turn-ring"></div>' : ''}
          ${p.isAI ? '🤖' : escHtml(p.name.charAt(0).toUpperCase())}
        </div>
      </div>
      <div class="opp-info-col">
        <div class="opp-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
        <div class="opp-status-badge ${statusClass}">${statusTxt}</div>
      </div>
      <div class="opp-card-chip">${p.handCount} 🂠</div>
    `;
    row.appendChild(panel);
  });

  // Also render "Me" in the row
  if (me) {
    const isMeTurn = me.id === state.currentPlayerId;
    const mePanel = document.createElement('div');
    mePanel.id = `opp-panel-${me.id}`;
    mePanel.className = `opponent-panel${isMeTurn ? ' is-turn' : ''}`;

    mePanel.innerHTML = `
      <div class="opp-avatar-wrap">
        <div class="opp-avatar me">
          ${isMeTurn ? '<div class="turn-ring"></div>' : ''}
          ${escHtml(myName.charAt(0).toUpperCase())}
          <div class="badge-you-tag">YOU</div>
        </div>
      </div>
      <div class="opp-info-col">
        <div class="opp-name" title="${escHtml(myName)}">${escHtml(myName)}</div>
        <div class="opp-status-badge ${isMeTurn ? 'status-turn' : ''}">
          ${isMeTurn ? '⚡ Your Turn' : `${me.handCount} cards`}
        </div>
      </div>
      <div class="opp-card-chip">${me.handCount} 🂠</div>
    `;
    row.appendChild(mePanel);
  }
}

/* ─── Render My Hand ────────────────────────────────────────────────────────── */
function renderMyHand(state) {
  const container = document.getElementById('my-hand-cards');
  const countEl   = document.getElementById('my-card-count');
  if (!container) return;

  const me = state.players.find(p => p.hand !== undefined);
  if (!me) return;

  if (countEl) countEl.textContent = me.hand.length;

  const isMyTurn  = state.currentPlayerId === myId;
  const isEnded   = state.phase === 'ended';

  container.innerHTML = '';

  // Clean up any stale selected card IDs
  const validIds = new Set(me.hand.map(c => c.id));
  selectedCards = selectedCards.filter(id => validIds.has(id));

  // Sort hand based on active mode
  const sorted = [...me.hand].sort((a, b) => {
    if (handSortMode === 'suit') {
      const si = a.suit.localeCompare(b.suit);
      return si !== 0 ? si : RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    }
    const ri = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    return ri !== 0 ? ri : a.suit.localeCompare(b.suit);
  });

  // Calculate dynamic overlap based on total card count
  // When holding 26 cards, overlap more closely (-30px) so they fan beautifully
  const overlapMargin = sorted.length > 20 ? '-30px' : sorted.length > 12 ? '-24px' : '-16px';

  sorted.forEach(card => {
    const isSelected = selectedCards.includes(card.id);
    const orderIndex = isSelected ? selectedCards.indexOf(card.id) : null;
    const isDisabled = !isMyTurn || isEnded;

    const el = buildPlayingCard(card, {
      selectable: true,
      selected: isSelected,
      orderIndex,
      disabled: isDisabled
    });
    el.style.marginRight = overlapMargin;
    container.appendChild(el);
  });

  updateSelectedInfo();
}

/* ─── Update Action Buttons ─────────────────────────────────────────────────── */
function updateActionButtons(state) {
  if (!state) return;
  const passBtn = document.getElementById('btn-pass');
  const dareBtn = document.getElementById('btn-dare');
  const playBtn = document.getElementById('btn-play');
  if (!passBtn || !dareBtn || !playBtn) return;

  const isMyTurn    = state.currentPlayerId === myId;
  const isEnded     = state.phase === 'ended';
  const hasDiscard  = state.discardPile.length > 0;
  const isFirstPlay = !hasDiscard;
  const canDare     = hasDiscard && state.lastPlayerId !== myId;

  let canPlay = isMyTurn && !isEnded && selectedCards.length > 0;
  if (isFirstPlay) {
    canPlay = canPlay && selectedRank !== null;
  }

  passBtn.disabled = !isMyTurn || isEnded;
  dareBtn.disabled = !isMyTurn || isEnded || !canDare;
  playBtn.disabled = !canPlay;

  // Update dynamic dare label
  const dareLabel = document.getElementById('dare-btn-label');
  if (dareLabel) {
    if (canDare && state.lastPlayerName) {
      dareLabel.innerHTML = `Challenge <strong>${escHtml(state.lastPlayerName)}</strong> <kbd class="kbd-hint">D</kbd>`;
    } else {
      dareLabel.innerHTML = `Reveal a card <kbd class="kbd-hint">D</kbd>`;
    }
  }

  // Update dynamic play label
  const playLabel = document.getElementById('play-btn-label');
  if (playLabel) {
    const cnt = selectedCards.length;
    if (cnt === 0) {
      playLabel.innerHTML = isFirstPlay ? `Select cards + rank <kbd class="kbd-hint">Space</kbd>` : `Select cards in order <kbd class="kbd-hint">Space</kbd>`;
    } else {
      const claim = isFirstPlay ? selectedRank : state.declaredRank;
      const claimTxt = claim ? rankPluralName(claim) : '—';
      playLabel.innerHTML = `Play <strong>${cnt}</strong> card${cnt > 1 ? 's' : ''} as <strong>${claimTxt}</strong> <kbd class="kbd-hint">Space</kbd>`;
    }
  }
}

/* ─── Game Log ──────────────────────────────────────────────────────────────── */
function renderGameLog(logEntries) {
  const container = document.getElementById('log-entries');
  if (!container || !logEntries) return;

  container.innerHTML = '';
  logEntries.slice(0, 25).forEach(entry => {
    const msg = typeof entry === 'string' ? entry : entry.msg;
    const el  = document.createElement('div');
    let type  = 'play';
    if (msg.includes('dared'))             type = 'dare';
    else if (msg.includes('passed'))       type = 'pass';
    else if (msg.includes('LOSER') || msg.includes('finished')) type = 'finish';
    else if (msg.includes('All players passed') || msg.includes('temp pile')) type = 'allpass';

    el.className = `log-entry type-${type}`;
    el.textContent = msg;
    container.appendChild(el);
  });
}

/* ─── Show Emote Reaction ───────────────────────────────────────────────────── */
function showPlayerEmote(playerId, emote) {
  const panel = document.getElementById(`opp-panel-${playerId}`);
  if (!panel) return;

  const bubble = document.createElement('div');
  bubble.className = 'floating-emote';
  bubble.textContent = emote;
  panel.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2300);
}

/* ─── Game End Modal ────────────────────────────────────────────────────────── */
function showEndModal(state) {
  const trophy  = document.getElementById('end-trophy');
  const title   = document.getElementById('end-title');
  const message = document.getElementById('end-message');

  const me = state.players.find(p => p.id === myId);
  const isLoser = me?.isLoser || (state.loser?.id === myId);
  const isWinner = state.winner?.id === myId;

  if (trophy) trophy.textContent = isLoser ? '💀' : '🏆';
  if (title) {
    title.textContent = isLoser ? 'YOU LOSE!' : isWinner ? 'YOU WIN!' : 'GAME OVER';
    title.className = `end-title ${isLoser ? 'lose' : 'win'}`;
  }
  if (message) {
    if (isLoser) {
      message.textContent = state.winner
        ? `${state.winner.name} won after you left or disconnected.`
        : `You were the last player holding cards! Better luck next round, ${myName}!`;
    } else if (isWinner) {
      message.textContent = `You emptied your hand and won the game! Spectacular victory, ${myName}! 🎉`;
    } else if (state.winner) {
      message.textContent = `${state.winner.name} won the game! Better luck next round, ${myName}.`;
    } else if (state.loser) {
      message.textContent = `${state.loser.name} was caught holding cards at the end. Spectacular victory, ${myName}! 🎉`;
    } else {
      message.textContent = 'Game concluded! All opponents finished.';
    }
  }

  openModal('end-modal');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ACTION HANDLERS & INTERACTIONS
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ─── Play Cards Handler ────────────────────────────────────────────────────── */
function submitPlayCards() {
  if (!gameState) return;
  const isFirstPlay = gameState.discardPile.length === 0;
  const cardIds = [...selectedCards]; // Exact chosen order!

  if (cardIds.length === 0) {
    showToast('Select at least 1 card to play', 'error');
    return;
  }
  if (isFirstPlay && !selectedRank) {
    showToast('Choose a rank to declare for the first play!', 'error');
    return;
  }

  const btn = document.getElementById('btn-play');
  if (btn) btn.disabled = true;

  sounds.playCardPlay();

  socket.emit('playCards', {
    roomCode,
    cardIds,
    declaredRank: isFirstPlay ? selectedRank : gameState.declaredRank
  }, (res) => {
    if (!res.ok) {
      showToast(res.err, 'error');
      if (btn) btn.disabled = false;
    } else {
      selectedCards = [];
      selectedRank = null;
      document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('selected'));
      renderStagingTray();
      updateSelectedInfo();
    }
  });
}

document.getElementById('btn-play')?.addEventListener('click', submitPlayCards);

/* ─── Dare Challenge Handler ────────────────────────────────────────────────── */
function renderDareCardSlots(count, selectable) {
  const cardRow = document.getElementById('dare-cards-row');
  if (!cardRow) return;

  cardRow.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'dare-card';
    card.dataset.index = i;
    card.innerHTML = `
      <div class="dare-card-slot-label">CARD #${i + 1}</div>
      <div class="dare-card-symbol">🂠</div>
    `;
    if (selectable) card.addEventListener('click', () => selectDareCard(i));
    cardRow.appendChild(card);
  }
}

function openDareModal() {
  if (!gameState) return;
  const last = gameState.discardPile[gameState.discardPile.length - 1];
  if (!last) { showToast('Nothing to dare!', 'error'); return; }

  dareCardIdx  = null;
  dareResolved = false;

  const subEl      = document.getElementById('dare-modal-sub');
  const nameEl     = document.getElementById('dare-target-name');
  const banner     = document.getElementById('dare-result-banner');
  const confirmBtn = document.getElementById('dare-confirm-btn');

  if (nameEl) nameEl.textContent = last.playerName;
  if (subEl) subEl.textContent = `Choose which card to reveal from ${last.playerName}'s play (${last.count} cards played in order):`;
  if (banner) banner.style.display = 'none';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '🎯 Reveal Selected Card';
  }

  sounds.playDare();

  renderDareCardSlots(last.count, true);

  openModal('dare-modal');
}

function selectDareCard(idx) {
  if (dareResolved) return;
  dareCardIdx = idx;
  sounds.playCardClick();
  document.querySelectorAll('.dare-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
  });
  const confirmBtn = document.getElementById('dare-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = `🎯 Reveal Card #${idx + 1}`;
  }
}

document.getElementById('btn-dare')?.addEventListener('click', openDareModal);

document.getElementById('dare-confirm-btn')?.addEventListener('click', () => {
  if (dareCardIdx === null) {
    showToast('Select a card to reveal!', 'error');
    return;
  }
  if (dareResolved) return;

  const confirmBtn = document.getElementById('dare-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Revealing Card...';

  socket.emit('dare', { roomCode, cardIndex: dareCardIdx }, (res) => {
    if (!res.ok) {
      showToast(res.err, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '🎯 Reveal Selected Card';
    }
  });
});

function handleDareResult(result) {
  dareResolved = true;
  const banner     = document.getElementById('dare-result-banner');
  const cardRow    = document.getElementById('dare-cards-row');
  const confirmBtn = document.getElementById('dare-confirm-btn');
  const revealedIndex = Number.isInteger(result.cardIndex) ? result.cardIndex : dareCardIdx;

  if (!document.getElementById('dare-modal')?.classList.contains('open')) {
    const count = Math.max(result.cardCount || gameState?.lastPlayedCount || 0, revealedIndex + 1);
    const nameEl = document.getElementById('dare-target-name');
    const subEl = document.getElementById('dare-modal-sub');
    if (nameEl) nameEl.textContent = result.lastPlayerName;
    if (subEl) subEl.textContent = `Revealed from ${result.lastPlayerName}'s play:`;
    renderDareCardSlots(count, false);
    openModal('dare-modal');
  }
  dareCardIdx = revealedIndex;

  // Flip revealed card
  if (cardRow) {
    const cards = cardRow.querySelectorAll('.dare-card');
    cards.forEach((c) => {
      if (parseInt(c.dataset.index) === revealedIndex) {
        c.classList.add('revealed');
        const card  = result.chosenCard;
        const color = RED_SUITS.has(card.suit) ? '#dc2626' : '#111827';
        c.innerHTML = `
          <div style="color:${color};display:flex;flex-direction:column;align-items:center;font-weight:800;">
            <div style="font-size:1.3rem;">${escHtml(card.rank)}</div>
            <div style="font-size:2.2rem;line-height:1;">${escHtml(card.suit)}</div>
            <div style="font-size:0.65rem;margin-top:4px;color:var(--text-dim);">#${dareCardIdx + 1}</div>
          </div>
        `;
      }
    });
  }

  // Audio feedback & banner
  if (result.isCorrect) {
    sounds.playTruthFanfare();
  } else {
    sounds.playLieBuzzer();
  }

  if (banner) {
    banner.style.display = 'block';
    banner.className = `dare-result-banner ${result.isCorrect ? 'truth' : 'lie'}`;
    banner.innerHTML = `
      <div>${result.isCorrect ? '🛡️ CARD WAS TRUTHFUL!' : '🎭 CARD WAS A BLUFF / LIE!'}</div>
      <div class="dare-result-cards">${escHtml(result.message)}</div>
    `;
  }

  if (confirmBtn) {
    confirmBtn.textContent = '✓ Close';
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => closeModal('dare-modal');
  }

  // Auto close after 3.8s
  setTimeout(() => closeModal('dare-modal'), 3800);
}

document.getElementById('dare-cancel-btn')?.addEventListener('click', () => {
  if (!dareResolved) closeModal('dare-modal');
});

/* ─── Pass Handler ──────────────────────────────────────────────────────────── */
function submitPass() {
  const btn = document.getElementById('btn-pass');
  if (btn) btn.disabled = true;

  sounds.playPass();

  socket.emit('pass', { roomCode }, (res) => {
    if (!res.ok) {
      showToast(res.err, 'error');
      if (btn) btn.disabled = false;
    } else {
      clearAllSelectedCards();
      selectedRank = null;
    }
  });
}

document.getElementById('btn-pass')?.addEventListener('click', submitPass);

/* ─── Tactical Tray Controls ────────────────────────────────────────────────── */
document.getElementById('clear-selected-btn')?.addEventListener('click', clearAllSelectedCards);
document.getElementById('reverse-order-btn')?.addEventListener('click', reverseSelectedOrder);

/* ─── Sort Controls ─────────────────────────────────────────────────────────── */
document.getElementById('sort-rank-btn')?.addEventListener('click', () => {
  handSortMode = 'rank';
  document.getElementById('sort-rank-btn')?.classList.add('active');
  document.getElementById('sort-suit-btn')?.classList.remove('active');
  renderMyHand(gameState);
});

document.getElementById('sort-suit-btn')?.addEventListener('click', () => {
  handSortMode = 'suit';
  document.getElementById('sort-suit-btn')?.classList.add('active');
  document.getElementById('sort-rank-btn')?.classList.remove('active');
  renderMyHand(gameState);
});

/* ─── Emote Reactions ───────────────────────────────────────────────────────── */
document.querySelectorAll('.emote-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emote = btn.dataset.emote;
    socket.emit('sendEmote', { roomCode, emote });
    showPlayerEmote(myId, emote);
    sounds.playEmote();
  });
});

/* ─── Audio Toggle ──────────────────────────────────────────────────────────── */
document.getElementById('nav-sound-btn')?.addEventListener('click', () => {
  const state = sounds.toggle();
  showToast(state ? 'Sound Effects Enabled' : 'Sound Effects Muted', 'info');
});

/* ─── Rules Modal ───────────────────────────────────────────────────────────── */
document.getElementById('nav-rules-btn')?.addEventListener('click', () => openModal('rules-modal'));
document.getElementById('rules-close-btn')?.addEventListener('click', () => closeModal('rules-modal'));
document.getElementById('rules-got-it-btn')?.addEventListener('click', () => closeModal('rules-modal'));

/* ─── Nav Room Code Copy ────────────────────────────────────────────────────── */
document.getElementById('nav-copy-btn')?.addEventListener('click', () => {
  if (roomCode) {
    navigator.clipboard.writeText(roomCode).then(() => showToast('Room code copied to clipboard!', 'success'));
  }
});

/* ─── Close Modals on Backdrop Click ────────────────────────────────────────── */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay && !dareResolved) overlay.classList.remove('open');
  });
});

/* ─── Log Panel Drawer Toggle (Mobile / Tablet) ─────────────────────────────── */
document.getElementById('nav-log-toggle')?.addEventListener('click', () => {
  document.getElementById('game-log-panel')?.classList.toggle('open');
});
document.getElementById('log-close-btn')?.addEventListener('click', () => {
  document.getElementById('game-log-panel')?.classList.remove('open');
});

/* ─── Keyboard Shortcuts ────────────────────────────────────────────────────── */
window.addEventListener('keydown', (e) => {
  // If in an input or modal is open (except dare selection)
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

  if (e.key === 'Escape') {
    if (document.getElementById('dare-modal')?.classList.contains('open') && !dareResolved) {
      closeModal('dare-modal');
    } else if (document.getElementById('rules-modal')?.classList.contains('open')) {
      closeModal('rules-modal');
    } else if (selectedCards.length > 0) {
      clearAllSelectedCards();
    }
  } else if (e.key === ' ' || e.key === 'Enter') {
    const playBtn = document.getElementById('btn-play');
    if (playBtn && !playBtn.disabled) {
      e.preventDefault();
      submitPlayCards();
    }
  } else if (e.key === 'd' || e.key === 'D') {
    const dareBtn = document.getElementById('btn-dare');
    if (dareBtn && !dareBtn.disabled && !document.getElementById('dare-modal')?.classList.contains('open')) {
      e.preventDefault();
      openDareModal();
    }
  } else if (e.key === 'p' || e.key === 'P') {
    const passBtn = document.getElementById('btn-pass');
    if (passBtn && !passBtn.disabled) {
      e.preventDefault();
      submitPass();
    }
  }
});

/* ─── Realtime Disconnect & Turn Countdown Ticker ────────────────────────── */
setInterval(() => {
  if (gameState && !document.hidden && gameState.phase !== 'ended') {
    const hasTimers = gameState.turnDeadline || gameState.players?.some(p => p.disconnectDeadline);
    if (hasTimers) {
      renderOpponents(gameState);
      const cur = gameState.players.find(p => p.id === gameState.currentPlayerId);
      if (cur && cur.connected === false && gameState.turnDeadline) {
        const bannerText = document.querySelector('.turn-banner-text');
        const turnSec = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
        if (bannerText) bannerText.textContent = `⏳ ${cur.name} is offline — auto-move in ${turnSec}s...`;
      }
    }
  }
}, 1000);
