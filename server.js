const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 20000,
  connectTimeout: 20000
});


app.use((req, res, next) => {
  const host = (req.headers.host || "")
    .split(":")[0]
    .toLowerCase();

  if (host === "lier-s-card.onrender.com") {
    return res.redirect(
      301,
      `https://liarscard.site${req.originalUrl}`
    );
  }

  next();
});


app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];
const BOT_NAMES = ['Luna','Blaze','Nova','Zephyr','Cipher','Axiom'];

// ─── Utilities ────────────────────────────────────────────────────────────────
function createDeck() {
  const deck = [];
  for (const rank of RANKS)
    for (const suit of SUITS)
      deck.push({ rank, suit, id: `${rank}${suit}` });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function normalizePlayerName(name) {
  return typeof name === 'string' && name.trim()
    ? name.trim().slice(0, 20)
    : 'Player';
}

// ─── Game Class ───────────────────────────────────────────────────────────────
class LiarsGame {
  constructor(playerDefs, mode) {
    this.mode = mode;
    this.phase = 'playing'; // 'playing' | 'ended'
    this.players = playerDefs.map((p, i) => ({
      id: p.id, name: normalizePlayerName(p.name), isAI: p.isAI || false,
      connected: p.connected !== false,
      disconnectDeadline: p.disconnectDeadline || null,
      hand: [], finished: false, pendingFinish: false, isLoser: false, order: i
    }));
    this.discardPile   = []; // [{cards, declaredRank, playerId, playerName}]
    this.tempPile      = [];
    this.passedThisRound = new Set();
    this.declaredRank  = null;
    this.currentPlayerIndex  = 0;
    this.roundStarterIndex   = 0;
    this.winner        = null;
    this.loser         = null;
    this.log           = [];
    this.aiTimerActive = false;
    this.turnDeadline  = null;
  }

  get activePlayers() { return this.players.filter(p => !p.finished); }
  get currentPlayer()  { return this.players[this.currentPlayerIndex]; }

  addLog(msg) {
    this.log.unshift({ msg, ts: Date.now() });
    if (this.log.length > 40) this.log.pop();
  }

  /* advance to next non-finished, non-passed player */
  advancePlayer() {
    const n = this.players.length;
    let tries = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % n;
      tries++;
    } while (
      tries < n &&
      (this.players[this.currentPlayerIndex].finished ||
       this.players[this.currentPlayerIndex].hand.length === 0 ||
       this.passedThisRound.has(this.players[this.currentPlayerIndex].id))
    );
  }

  allPassed() {
    return this.activePlayers.every(p => this.passedThisRound.has(p.id) || p.hand.length === 0);
  }

  startNewRound(starterIdx) {
    this.discardPile = [];
    this.declaredRank = null;
    this.passedThisRound.clear();
    this.currentPlayerIndex = starterIdx;
    this.roundStarterIndex  = starterIdx;
    if (this.players[this.currentPlayerIndex]?.finished || this.players[this.currentPlayerIndex]?.hand.length === 0) {
      this.advancePlayer();
    }
  }

  checkEnd() {
    // If any player is awaiting a challenge on their last play, don't end yet
    if (this.players.some(p => p.pendingFinish)) {
      return false;
    }

    if (this.winner) {
      this.phase = 'ended';
      return true;
    }

    const active = this.activePlayers;
    if (active.length <= 1) {
      this.phase = 'ended';
      if (active.length === 1) {
        active[0].isLoser = true;
        this.loser = active[0];
        this.addLog(`💀 ${active[0].name} is the LOSER — last one holding cards!`);
      }
      return true;
    }
    return false;
  }

  confirmPendingWinner() {
    const winner = this.players.find(p => p.pendingFinish);
    if (!winner) return false;

    winner.pendingFinish = false;
    winner.finished = true;
    this.winner = winner;
    this.phase = 'ended';
    this.addLog(`🏆 ${winner.name} emptied their hand and won the game!`);
    return true;
  }

  leavePlayer(playerId, reason = 'left the game') {
    if (this.phase === 'ended') return false;
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.finished) return false;

    if (this.currentPlayer?.id === playerId && this.confirmPendingWinner()) {
      player.finished = true;
      player.pendingFinish = false;
      player.connected = false;
      player.isLoser = true;
      player.removed = true;
      this.loser = player;
      if (player.hand.length > 0) {
        this.tempPile.push(...player.hand);
        player.hand = [];
      }
      this.addLog(`${player.name} ${reason}`);
      return true;
    }

    player.finished = true;
    player.pendingFinish = false;
    player.connected = false;
    player.isLoser = true;
    player.removed = true;
    if (player.hand.length > 0) {
      this.tempPile.push(...player.hand);
      player.hand = [];
    }
    this.passedThisRound.delete(playerId);
    this.addLog(`${player.name} ${reason}`);

    if (this.currentPlayer?.id === playerId) {
      this.advancePlayer();
      this.roundStarterIndex = this.currentPlayerIndex;
    }

    const remainingPlayers = this.activePlayers;
    if (remainingPlayers.length <= 1) {
      if (remainingPlayers.length === 1) {
        this.winner = remainingPlayers[0];
        this.loser = player;
        this.phase = 'ended';
        this.addLog(`🏆 ${this.winner.name} wins by forfeit after ${player.name} ${reason}!`);
      } else {
        this.phase = 'ended';
      }
      return true;
    }

    if (this.allPassed()) {
      this.players.forEach(p => {
        if (p.pendingFinish) {
          p.pendingFinish = false;
          p.finished = true;
          this.addLog(`🎉 ${p.name} was not dared — confirmed finished!`);
        }
      });
      if (this.checkEnd()) return true;

      const discards = this.discardPile.flatMap(e => e.cards);
      this.tempPile.push(...discards);
      this.addLog(`😮 All remaining players passed! ${discards.length} card(s) locked in temp pile.`);
      this.startNewRound(this.roundStarterIndex);
    }

    this.checkEnd();
    return true;
  }

  // ── Play cards ──────────────────────────────────────────────────────────────
  playCards(playerId, cardIds, declaredRank) {
    if (this.phase === 'ended') return { ok: false, err: 'Game has ended' };
    const player = this.players.find(p => p.id === playerId);
    if (!player)                          return { ok: false, err: 'Player not found' };
    if (this.currentPlayer.id !== playerId) return { ok: false, err: 'Not your turn' };
    if (!cardIds || cardIds.length === 0) return { ok: false, err: 'Select at least 1 card' };

    const isFirstPlay = this.discardPile.length === 0;

    if (isFirstPlay && !declaredRank)
      return { ok: false, err: 'You must declare a rank for the first play' };

    const played = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    if (played.length !== cardIds.length) return { ok: false, err: 'Invalid card(s) selected' };

    // Playing instead of daring confirms the previous empty-handed player's win.
    if (this.confirmPendingWinner()) return { ok: true, gameEnded: true, winnerId: this.winner.id };

    // Remove from hand
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));

    // Lock declared rank on first play
    if (isFirstPlay) this.declaredRank = declaredRank;

    const entry = {
      cards: played,
      declaredRank: this.declaredRank,
      playerId: player.id,
      playerName: player.name
    };
    this.discardPile.push(entry);

    this.addLog(`${player.name} played ${played.length} card(s) claiming ${this.declaredRank}`);

    // Clear passed status because a new play was made to the table!
    this.passedThisRound.clear();

    if (player.hand.length === 0) {
      player.pendingFinish = true;
      this.addLog(`⚠️ ${player.name} played their last card(s)! Hand is empty — Dare or Pass!`);
    }

    if (this.checkEnd()) return { ok: true, gameEnded: true };
    this.advancePlayer();
    return { ok: true };
  }

  // ── Dare ────────────────────────────────────────────────────────────────────
  dare(darerId, cardIndex) {
    if (this.phase === 'ended') return { ok: false, err: 'Game has ended' };
    const darer = this.players.find(p => p.id === darerId);
    if (!darer)                            return { ok: false, err: 'Player not found' };
    if (this.currentPlayer.id !== darerId) return { ok: false, err: 'Not your turn' };
    if (this.discardPile.length === 0)     return { ok: false, err: 'Nothing to dare yet!' };

    const last = this.discardPile[this.discardPile.length - 1];
    if (last.playerId === darerId)         return { ok: false, err: "You can't dare yourself" };
    if (cardIndex < 0 || cardIndex >= last.cards.length) return { ok: false, err: 'Invalid card index' };

    const lastPlayer = this.players.find(p => p.id === last.playerId);
    const chosen    = last.cards[cardIndex];
    const isCorrect = chosen.rank === this.declaredRank; // card IS what was declared

    const allDiscards = this.discardPile.flatMap(e => e.cards);

    let penaltyPlayer, nextStarterIdx;
    if (isCorrect) {
      // Last player told truth → darer gets penalty
      penaltyPlayer  = darer;
      nextStarterIdx = this.players.findIndex(p => p.id === last.playerId);
      this.addLog(`🔍 ${darer.name} dared ${lastPlayer.name}! ${chosen.rank}${chosen.suit} — TRUTH! ${darer.name} takes ${allDiscards.length} cards!`);
      if (lastPlayer.pendingFinish) {
        lastPlayer.pendingFinish = false;
        lastPlayer.finished = true;
        this.winner = lastPlayer;
        this.phase = 'ended';
        this.addLog(`🏆 ${lastPlayer.name} told the truth on their last play and won the game!`);
      }
    } else {
      // Last player lied → they get penalty
      penaltyPlayer  = lastPlayer;
      nextStarterIdx = this.players.findIndex(p => p.id === darerId);
      this.addLog(`🔍 ${darer.name} dared ${lastPlayer.name}! ${chosen.rank}${chosen.suit} — LIE! ${lastPlayer.name} takes ${allDiscards.length} cards!`);
      if (lastPlayer.pendingFinish) {
        lastPlayer.pendingFinish = false;
        lastPlayer.finished = false;
        this.addLog(`😈 ${lastPlayer.name} was caught bluffing on their last play! Hand restored, game continues!`);
      }
    }

    // Give penalty cards (unfinish if they had none left)
    if (penaltyPlayer.finished) penaltyPlayer.finished = false;
    penaltyPlayer.pendingFinish = false;
    penaltyPlayer.hand.push(...allDiscards);

    const result = {
      ok: true,
      chosenCard: chosen,
      cardIndex,
      cardCount: last.cards.length,
      isCorrect,
      darerId,
      darerName: darer.name,
      lastPlayerId: last.playerId,
      lastPlayerName: lastPlayer.name,
      penaltyPlayerId: penaltyPlayer.id,
      penaltyPlayerName: penaltyPlayer.name,
      penaltyCount: allDiscards.length,
      message: isCorrect
        ? `${lastPlayer.name} was TRUTHFUL! ${darer.name} takes ${allDiscards.length} cards!`
        : `${lastPlayer.name} was LYING! They take ${allDiscards.length} cards!`
    };

    if (this.phase === 'ended') {
      result.gameEnded = true;
      return result;
    }

    this.startNewRound(nextStarterIdx);
    if (this.checkEnd()) result.gameEnded = true;
    return result;
  }

  // ── Pass ────────────────────────────────────────────────────────────────────
  pass(playerId) {
    if (this.phase === 'ended') return { ok: false, err: 'Game has ended' };
    const player = this.players.find(p => p.id === playerId);
    if (!player)                             return { ok: false, err: 'Player not found' };
    if (this.currentPlayer.id !== playerId)  return { ok: false, err: 'Not your turn' };

    player.passed = true; // cosmetic flag
    this.passedThisRound.add(playerId);
    this.addLog(`${player.name} passed`);

    // Passing instead of daring confirms the empty-handed player's win.
    if (this.confirmPendingWinner()) {
      return { ok: true, gameEnded: true, winnerId: this.winner.id };
    }

    if (this.allPassed()) {
      // In case any pendingFinish remains
      this.players.forEach(p => {
        if (p.pendingFinish) {
          p.pendingFinish = false;
          p.finished = true;
        }
      });
      if (this.checkEnd()) return { ok: true, gameEnded: true, allPassed: true };

      const discards = this.discardPile.flatMap(e => e.cards);
      this.tempPile.push(...discards);
      this.addLog(`😮 All players passed! ${discards.length} card(s) locked in temp pile.`);
      // Restart round with same starter
      this.startNewRound(this.roundStarterIndex);
      return { ok: true, allPassed: true };
    }

    this.advancePlayer();
    return { ok: true };
  }

  // ── State serializer ────────────────────────────────────────────────────────
  stateFor(viewerId) {
    const last = this.discardPile[this.discardPile.length - 1] || null;
    return {
      players: this.players.map(p => ({
        id: p.id, name: p.name, isAI: p.isAI,
        connected: p.connected,
        disconnectDeadline: p.disconnectDeadline || null,
        handCount: p.hand.length,
        hand: p.id === viewerId ? p.hand : undefined,
        passed: this.passedThisRound.has(p.id),
        finished: p.finished,
        pendingFinish: p.pendingFinish || false,
        isLoser: p.isLoser,
        order: p.order
      })),
      currentPlayerId: this.phase === 'ended' ? null : this.currentPlayer?.id,
      turnDeadline: this.turnDeadline || null,
      roundStarterId: this.players[this.roundStarterIndex]?.id,
      discardPile: this.discardPile.map(e => ({
        count: e.cards.length,
        declaredRank: e.declaredRank,
        playerId: e.playerId,
        playerName: e.playerName
      })),
      lastPlayedCount: last ? last.cards.length : 0,
      lastPlayerId:    last ? last.playerId : null,
      lastPlayerName:  last ? last.playerName : null,
      tempPileCount:   this.tempPile.length,
      declaredRank:    this.declaredRank,
      phase:           this.phase,
      winner:          this.winner ? { id: this.winner.id, name: this.winner.name } : null,
      loser:           this.loser ? { id: this.loser.id, name: this.loser.name } : null,
      gameLog:         this.log,
    };
  }
}

// ─── Room storage ─────────────────────────────────────────────────────────────
const rooms            = new Map(); // roomCode → room
const socketSessionMap = new Map(); // socketId → { playerId, roomCode, lastSeen }
const DISCONNECT_GRACE_MS = 60000;         // 60 seconds grace period before removing disconnected player
const DISCONNECTED_TURN_TIMEOUT = 15000;   // 15 seconds turn timeout for offline players before auto-action

function sanitize(room) {
  return {
    code: room.code,
    mode: room.mode,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    players: room.players.map(p => ({
      id: p.id,
      name: normalizePlayerName(p.name),
      isAI: p.isAI,
      connected: p.connected !== false,
      disconnectDeadline: p.disconnectDeadline || null
    }))
  };
}

function deal(game) {
  const deck = shuffle(createDeck());
  const n = game.players.length;
  const per = Math.floor(deck.length / n);
  game.players.forEach((p, i) => { p.hand = deck.slice(i * per, (i + 1) * per); });
}

// ─── AI logic ─────────────────────────────────────────────────────────────────
function aiMove(game, botId) {
  const bot = game.players.find(p => p.id === botId);
  if (!bot || bot.hand.length === 0) return { action: 'pass' };

  const { discardPile, declaredRank } = game;

  if (discardPile.length === 0) {
    const rank  = RANKS[Math.floor(Math.random() * RANKS.length)];
    const cnt   = Math.min(bot.hand.length, Math.ceil(Math.random() * 3));
    const ids   = shuffle(bot.hand).slice(0, cnt).map(c => c.id);
    return { action: 'play', cardIds: ids, declaredRank: rank };
  }

  const last = discardPile[discardPile.length - 1];
  const lastPlayer = game.players.find(p => p.id === last?.playerId);
  if (last && last.playerId !== botId) {
    const isOpponentEmpty = lastPlayer?.hand.length === 0 || lastPlayer?.pendingFinish;
    const dareChance = isOpponentEmpty ? 0.70 : 0.28;
    if (Math.random() < dareChance) {
      return { action: 'dare', cardIndex: Math.floor(Math.random() * last.cards.length) };
    }
  }
  if (Math.random() < 0.07) return { action: 'pass' };

  const cnt = Math.min(bot.hand.length, Math.ceil(Math.random() * 2));
  const ids = shuffle(bot.hand).slice(0, cnt).map(c => c.id);
  return { action: 'play', cardIds: ids, declaredRank };
}

function broadcastStates(room) {
  if (!room.game) return;
  if (room.game.phase === 'ended') room.status = 'ended';
  room.players.forEach(p => {
    if (!p.isAI) {
      const s = io.sockets.sockets.get(p.socketId);
      if (s) s.emit('gameState', room.game.stateFor(p.id));
    }
  });
}

function broadcastDare(room, result) {
  io.to(room.code).emit('dareResult', result);
}

function runAI(room) {
  const g = room.game;
  if (!g || g.phase === 'ended' || g.aiTimerActive) return;
  const cur = g.currentPlayer;
  if (!cur || !cur.isAI) return;

  g.aiTimerActive = true;
  const delay = 1100 + Math.random() * 900;

  setTimeout(() => {
    g.aiTimerActive = false;
    if (room.game !== g || room.game.phase === 'ended') return;
    if (room.game.currentPlayer?.id !== cur.id) return;

    const move = aiMove(g, cur.id);

    if (move.action === 'dare') {
      const r = g.dare(cur.id, move.cardIndex);
      if (r.ok) {
        broadcastDare(room, r);
        setTimeout(() => {
          if (room.game !== g) return;
          broadcastStates(room);
          handleTurnProgress(room);
        }, 2200);
        return;
      }
      // dare failed, fall through to pass
      g.pass(cur.id);
    } else if (move.action === 'play') {
      g.playCards(cur.id, move.cardIds, move.declaredRank);
    } else {
      g.pass(cur.id);
    }

    broadcastStates(room);
    handleTurnProgress(room);
  }, delay);
}

function handleTurnProgress(room) {
  if (!room || !room.game || room.game.phase === 'ended') {
    if (room?.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    if (room?.game) room.game.turnDeadline = null;
    return;
  }

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  room.game.turnDeadline = null;

  const cur = room.game.currentPlayer;
  if (!cur || cur.finished || cur.hand.length === 0) {
    room.game.advancePlayer();
  }

  const activeCur = room.game.currentPlayer;
  if (!activeCur || room.game.phase === 'ended') return;

  if (activeCur.isAI) {
    runAI(room);
    return;
  }

  if (!activeCur.connected) {
    room.game.turnDeadline = Date.now() + DISCONNECTED_TURN_TIMEOUT;
    broadcastStates(room);

    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      if (!room.game || room.game.phase === 'ended') return;
      const nowCur = room.game.currentPlayer;
      if (!nowCur || nowCur.id !== activeCur.id || nowCur.connected) return;

      console.log(`[!] Auto-turn for disconnected player ${nowCur.name} (${nowCur.id})`);
      room.game.addLog(`⏳ ${nowCur.name} is offline — auto-advancing turn.`);

      if (room.game.discardPile.length === 0 && nowCur.hand.length > 0) {
        const card = nowCur.hand[0];
        room.game.playCards(nowCur.id, [card.id], card.rank);
      } else {
        room.game.pass(nowCur.id);
      }

      broadcastStates(room);
      handleTurnProgress(room);
    }, DISCONNECTED_TURN_TIMEOUT);
    return;
  }

  broadcastStates(room);
}

function handlePlayerDisconnectTimeout(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.find(p => p.id === playerId);
  if (!player || player.connected) return;

  console.log(`[x] Disconnect timeout reached for player ${player.name} (${playerId}) in room ${roomCode}`);

  if (room.status === 'waiting') {
    room.players = room.players.filter(p => p.id !== playerId);
    const remainingHumans = room.players.filter(p => !p.isAI);
    if (remainingHumans.length === 0) {
      console.log(`[x] Room ${roomCode} removed: all human players left.`);
      rooms.delete(roomCode);
      return;
    }
    if (room.hostId === playerId) {
      room.hostId = remainingHumans[0].id;
    }
    io.to(roomCode).emit('roomUpdate', sanitize(room));
    return;
  }

  if (room.game && room.game.phase !== 'ended') {
    room.game.leavePlayer(playerId, 'was removed after disconnecting');
    room.players = room.players.filter(p => p.id !== playerId);

    const remainingHumans = room.players.filter(p => !p.isAI);
    if (room.hostId === playerId && remainingHumans.length > 0) {
      room.hostId = remainingHumans[0].id;
    }

    if (remainingHumans.length === 0) {
      console.log(`[x] Room ${roomCode} removed: all human players disconnected.`);
      rooms.delete(roomCode);
      return;
    }

    if (room.game.phase === 'ended') {
      room.status = 'ended';
    } else {
      handleTurnProgress(room);
    }

    io.to(roomCode).emit('roomUpdate', sanitize(room));
    broadcastStates(room);
  }
}

// ─── Socket events ────────────────────────────────────────────────────────────
function broadcastOnlineCount() {
  const count = io.engine.clientsCount;
  io.emit('onlineCount', { count });
}

io.on('connection', socket => {
  console.log('[+]', socket.id);
  broadcastOnlineCount();

  // Create room
  socket.on('createRoom', ({ mode, playerName, playerId, botCount }, cb) => {
    const pId = playerId || `u_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    const code = generateCode();
    const maxP = 6;
    const room = {
      code,
      mode,
      hostId: pId,
      status: 'waiting',
      maxPlayers: maxP,
      players: [{
        id: pId,
        socketId: socket.id,
        name: normalizePlayerName(playerName),
        isAI: false,
        connected: true,
        disconnectTimer: null,
        disconnectDeadline: null
      }],
      game: null,
      turnTimer: null
    };

    if (mode === 'ai') {
      // Default to 1 AI bot if not specified, min 1, max 5
      const cnt = Math.min(Math.max(parseInt(botCount) || 1, 1), 5);
      for (let i = 0; i < cnt; i++) {
        room.players.push({
          id: `bot_${Date.now()}_${i}`,
          socketId: null,
          name: BOT_NAMES[i % BOT_NAMES.length],
          isAI: true,
          connected: true,
          disconnectTimer: null,
          disconnectDeadline: null
        });
      }
    }

    rooms.set(code, room);
    socketSessionMap.set(socket.id, { playerId: pId, roomCode: code });
    socket.join(code);
    cb({ ok: true, roomCode: code, room: sanitize(room) });
  });

  // Join room by code / reconnect to existing session
  socket.on('joinRoom', ({ roomCode, playerName, playerId }, cb) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, err: 'Room not found — check the code!' });

    const pId = playerId || `u_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    const existing = room.players.find(p => p.id === pId);

    if (existing) {
      const wasConnected = existing.connected !== false;
      // Reclaiming slot (e.g. navigated from index to lobby or game, or page refreshed)
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
      }
      existing.disconnectDeadline = null;
      existing.socketId = socket.id;
      existing.connected = true;

      const gamePlayer = room.game?.players.find(p => p.id === pId);
      if (gamePlayer) {
        gamePlayer.connected = true;
        gamePlayer.disconnectDeadline = null;
      }
      if (typeof playerName === 'string' && playerName.trim()) {
        existing.name = normalizePlayerName(playerName);
      }

      socketSessionMap.set(socket.id, { playerId: pId, roomCode: code, lastSeen: Date.now() });
      socket.join(code);
      io.to(code).emit('roomUpdate', sanitize(room));

      if (room.game) {
        if (!wasConnected) room.game.addLog(`🎉 ${existing.name} reconnected!`);
        broadcastStates(room);
        handleTurnProgress(room);
      }
      return cb({ ok: true, roomCode: code, room: sanitize(room), isHost: room.hostId === pId });
    }

    // New player joining
    if (room.status !== 'waiting') return cb({ ok: false, err: 'Game already in progress or you were removed due to timeout.' });
    if (room.players.length >= room.maxPlayers) return cb({ ok: false, err: 'Room is full' });

    room.players.push({
      id: pId,
      socketId: socket.id,
      name: normalizePlayerName(playerName),
      isAI: false,
      connected: true,
      disconnectTimer: null,
      disconnectDeadline: null
    });
    socketSessionMap.set(socket.id, { playerId: pId, roomCode: code, lastSeen: Date.now() });
    socket.join(code);
    io.to(code).emit('roomUpdate', sanitize(room));
    cb({ ok: true, roomCode: code, room: sanitize(room), isHost: false });
  });

  // Random matchmaking
  socket.on('joinRandom', ({ playerName, playerId }, cb) => {
    const pId = playerId || `u_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    const open = [...rooms.values()].find(r =>
      r.mode === 'random' && r.status === 'waiting' && r.players.length < r.maxPlayers
    );
    if (open) {
      const existing = open.players.find(p => p.id === pId);
      if (existing) {
        if (existing.disconnectTimer) {
          clearTimeout(existing.disconnectTimer);
          existing.disconnectTimer = null;
        }
        existing.disconnectDeadline = null;
        existing.socketId = socket.id;
        existing.connected = true;
      } else {
        open.players.push({
          id: pId,
          socketId: socket.id,
          name: normalizePlayerName(playerName),
          isAI: false,
          connected: true,
          disconnectTimer: null,
          disconnectDeadline: null
        });
      }
      socketSessionMap.set(socket.id, { playerId: pId, roomCode: open.code, lastSeen: Date.now() });
      socket.join(open.code);
      io.to(open.code).emit('roomUpdate', sanitize(open));

      if (open.players.length >= open.maxPlayers) {
        const g = new LiarsGame(open.players, 'random');
        deal(g); open.game = g; open.status = 'playing';
        io.to(open.code).emit('gameStarted', { roomCode: open.code });
        broadcastStates(open);
        handleTurnProgress(open);
      }
      cb({ ok: true, roomCode: open.code, room: sanitize(open) });
    } else {
      const code = generateCode();
      const room = {
        code,
        mode: 'random',
        hostId: pId,
        status: 'waiting',
        maxPlayers: 4,
        players: [{
          id: pId,
          socketId: socket.id,
          name: normalizePlayerName(playerName),
          isAI: false,
          connected: true,
          disconnectTimer: null,
          disconnectDeadline: null
        }],
        game: null,
        turnTimer: null
      };
      rooms.set(code, room);
      socketSessionMap.set(socket.id, { playerId: pId, roomCode: code, lastSeen: Date.now() });
      socket.join(code);
      cb({ ok: true, roomCode: code, room: sanitize(room), waiting: true });
    }
  });

  // Add AI Bot to lobby
  socket.on('addBot', ({ roomCode }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room) return cb({ ok: false, err: 'Room not found' });
    const pId = session ? session.playerId : null;
    if (room.hostId !== pId) return cb({ ok: false, err: 'Only the host can add bots' });
    if (room.status !== 'waiting') return cb({ ok: false, err: 'Cannot add bots after game started' });
    if (room.players.length >= room.maxPlayers) return cb({ ok: false, err: `Room is full (max ${room.maxPlayers} players)` });

    const existingNames = new Set(room.players.map(p => p.name));
    const botName = BOT_NAMES.find(n => !existingNames.has(n)) || `Bot ${room.players.length + 1}`;
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    room.players.push({
      id: botId,
      socketId: null,
      name: botName,
      isAI: true,
      connected: true,
      disconnectTimer: null
    });

    io.to(roomCode).emit('roomUpdate', sanitize(room));
    cb({ ok: true, room: sanitize(room) });
  });

  // Remove player or bot (host only, lobby only)
  socket.on('removePlayer', ({ roomCode, targetPlayerId, playerId }, cb) => {
    const targetId = targetPlayerId || playerId;
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room) return cb({ ok: false, err: 'Room not found' });
    const pId = session ? session.playerId : null;
    if (room.hostId !== pId) return cb({ ok: false, err: 'Only the host can remove players' });
    if (targetId === room.hostId) return cb({ ok: false, err: "Can't remove yourself" });
    if (room.status !== 'waiting') return cb({ ok: false, err: 'Cannot remove players after game started' });

    const idx = room.players.findIndex(p => p.id === targetId);
    if (idx === -1) return cb({ ok: false, err: 'Player not found in room' });

    const [removed] = room.players.splice(idx, 1);
    if (!removed.isAI && removed.socketId) {
      socketSessionMap.delete(removed.socketId);
      const targetSocket = io.sockets.sockets.get(removed.socketId);
      if (targetSocket) {
        targetSocket.emit('kicked', { message: 'You were removed from the lobby by the host.' });
        targetSocket.leave(roomCode);
      }
    }

    io.to(roomCode).emit('roomUpdate', sanitize(room));
    cb({ ok: true, room: sanitize(room) });
  });

  // Leave a lobby or active game explicitly
  socket.on('leaveRoom', ({ roomCode }, cb) => {
    const code = (roomCode || '').toUpperCase().trim();
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(code);
    if (!room || !session || session.roomCode !== code) {
      return cb?.({ ok: false, err: 'Room not found' });
    }

    const playerId = session.playerId;
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return cb?.({ ok: false, err: 'Player not found in room' });

    const [player] = room.players.splice(playerIndex, 1);
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.connected = false;
    socketSessionMap.delete(socket.id);

    if (room.game) room.game.leavePlayer(playerId);

    const remainingHumans = room.players.filter(p => !p.isAI);
    if (room.hostId === playerId && remainingHumans.length > 0) {
      room.hostId = remainingHumans[0].id;
    }

    socket.leave(code);
    cb?.({ ok: true });

    if (remainingHumans.length === 0) {
      rooms.delete(code);
      return;
    }

    io.to(code).emit('roomUpdate', sanitize(room));
    if (room.game) {
      broadcastStates(room);
      handleTurnProgress(room);
    }
  });

  // Start game
  socket.on('startGame', ({ roomCode }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room) return cb({ ok: false, err: 'Room not found' });
    const pId = session ? session.playerId : null;
    if (room.hostId !== pId) return cb({ ok: false, err: 'Only the host can start' });
    if (room.players.length < 2) return cb({ ok: false, err: 'Need at least 2 players' });
    if (room.status !== 'waiting') return cb({ ok: false, err: 'Game already started' });

    const g = new LiarsGame(room.players, room.mode);
    deal(g); room.game = g; room.status = 'playing';
    io.to(roomCode).emit('gameStarted', { roomCode });
    broadcastStates(room);
    handleTurnProgress(room);
    cb({ ok: true });
  });

  socket.on('playAgain', ({ roomCode }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb({ ok: false, err: 'Room not found' });
    if (!session || session.roomCode !== code || !room.players.some(p => p.id === session.playerId)) {
      return cb({ ok: false, err: 'You are not a player in this room' });
    }
    if (!room.game || room.game.phase !== 'ended') {
      return cb({ ok: false, err: 'The current game has not ended yet' });
    }

    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }
    const game = new LiarsGame(room.players, room.mode);
    deal(game);
    room.game = game;
    room.status = 'playing';
    io.to(code).emit('gameRestarted');
    broadcastStates(room);
    handleTurnProgress(room);
    cb({ ok: true });
  });

  // Play cards
  socket.on('playCards', ({ roomCode, cardIds, declaredRank }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room?.game) return cb({ ok: false, err: 'No active game' });
    const pId = session ? session.playerId : socket.id;
    const r = room.game.playCards(pId, cardIds, declaredRank);
    if (!r.ok) return cb(r);
    broadcastStates(room); cb({ ok: true });
    handleTurnProgress(room);
  });

  // Dare
  socket.on('dare', ({ roomCode, cardIndex }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room?.game) return cb({ ok: false, err: 'No active game' });
    const pId = session ? session.playerId : socket.id;
    const r = room.game.dare(pId, cardIndex);
    if (!r.ok) return cb(r);
    broadcastDare(room, r);
    cb({ ok: true, result: r });
    const game = room.game;
    setTimeout(() => {
      if (room.game !== game) return;
      broadcastStates(room);
      handleTurnProgress(room);
    }, 2500);
  });

  // Pass
  socket.on('pass', ({ roomCode }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room?.game) return cb({ ok: false, err: 'No active game' });
    const pId = session ? session.playerId : socket.id;
    const r = room.game.pass(pId);
    if (!r.ok) return cb(r);
    broadcastStates(room); cb({ ok: true });
    handleTurnProgress(room);
  });

  // Client heartbeat to maintain connection and self-heal session
  socket.on('clientHeartbeat', ({ playerId, roomCode } = {}) => {
    let session = socketSessionMap.get(socket.id);
    if (session) {
      session.lastSeen = Date.now();
    } else if (playerId && roomCode) {
      session = { playerId, roomCode: roomCode.toUpperCase().trim(), lastSeen: Date.now() };
      socketSessionMap.set(socket.id, session);
      socket.join(session.roomCode);
    }

    if (playerId && roomCode) {
      const code = roomCode.toUpperCase().trim();
      const room = rooms.get(code);
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.socketId = socket.id;
          player.connected = true;
          player.disconnectDeadline = null;
          if (player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
            player.disconnectTimer = null;
          }
          const gamePlayer = room.game?.players.find(p => p.id === playerId);
          if (gamePlayer) {
            gamePlayer.connected = true;
            gamePlayer.disconnectDeadline = null;
          }
        }
      }
    }
  });

  // Emote reaction
  socket.on('sendEmote', ({ roomCode, emote }, cb) => {
    const session = socketSessionMap.get(socket.id);
    const room = rooms.get(roomCode);
    if (!room) return cb?.({ ok: false, err: 'Room not found' });
    const pId = session ? session.playerId : socket.id;
    const player = room.players.find(p => p.id === pId);
    if (player) {
      io.to(roomCode).emit('playerEmote', { playerId: player.id, playerName: player.name, emote });
      cb?.({ ok: true });
    }
  });

  // Disconnect with 60s grace period and auto-turn progress
  socket.on('disconnect', (reason) => {
    console.log(`[-] Socket ${socket.id} disconnected (${reason})`);
    broadcastOnlineCount();
    const session = socketSessionMap.get(socket.id);
    if (!session) return;
    const { playerId, roomCode } = session;
    socketSessionMap.delete(socket.id);

    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    // CRITICAL: If the player has already connected on a new socket (e.g. page navigation from lobby to game),
    // this disconnected socket is STALE and must NOT mark the active player as disconnected!
    if (player.socketId && player.socketId !== socket.id) {
      console.log(`[i] Ignoring stale socket ${socket.id} disconnect for ${player.name} (active socket: ${player.socketId})`);
      return;
    }

    player.connected = false;
    player.socketId = null;
    const deadline = Date.now() + DISCONNECT_GRACE_MS;
    player.disconnectDeadline = deadline;

    const gamePlayer = room.game?.players.find(p => p.id === playerId);
    if (gamePlayer) {
      gamePlayer.connected = false;
      gamePlayer.disconnectDeadline = deadline;
    }

    if (room.status === 'waiting') {
      io.to(roomCode).emit('roomUpdate', sanitize(room));
    } else if (room.game && room.game.phase !== 'ended') {
      room.game.addLog(`⚠️ ${player.name} disconnected (reconnect window: 60s)`);
      broadcastStates(room);
      handleTurnProgress(room);
    }

    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = setTimeout(() => {
      handlePlayerDisconnectTimeout(roomCode, playerId);
    }, DISCONNECT_GRACE_MS);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n🃏  Liar's Cards  →  http://localhost:${PORT}\n`);
  });
}

module.exports = { LiarsGame, createDeck, shuffle, server, app };
