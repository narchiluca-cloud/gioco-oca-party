/**
 * ============================================================================
 * IL NOBILE GIOCO DELL'OCA (PARTY EDITION) - BACKEND SERVER
 * ============================================================================
 * Server Authoritative, Real-Time WebSockets via Socket.io + Express.
 * Progettato per resistere a cheat, riconnessioni Wi-Fi e disconnessioni tipiche delle feste.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_MASTER_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_MASTER_PASSWORD) {
  console.warn('[AVVISO] ADMIN_PASSWORD non impostata: le funzioni Admin non saranno accessibili.');
}

// Servizio dei file statici del client
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Endpoint di controllo salute / status
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: Object.keys(rooms).length, timestamp: Date.now() });
});

/**
 * STRUTTURA DATI STANZE IN MEMORIA
 * Chiave: roomId (es. 'OCA-42')
 */
const rooms = {};

// ============================================================================
// TAVERNA SOCIALE — stato opzionale e validazione (livello COSMETICO)
// Questi dati NON toccano mai position, turno, dadi o vittoria.
// ============================================================================
const TAVERN_BOUNDS = { minX: -128, maxX: 128, minZ: -106, maxZ: 106 };

// Rettangoli XZ che l'avatar non può attraversare (gli stessi del client).
const TAVERN_OBSTACLES = [
  { minX: -82, maxX: 82, minZ: -62, maxZ: 62 },   // tavolo centrale
  { minX: 26, maxX: 98, minZ: -100, maxZ: -84 },  // bancone
  { minX: -118, maxX: -100, minZ: -78, maxZ: -62 }, // botte sinistra
  { minX: 102, maxX: 118, minZ: -76, maxZ: -60 }, // botte destra
  { minX: -110, maxX: -82, minZ: 34, maxZ: 44 },  // panchina sinistra
  { minX: 82, maxX: 110, minZ: 34, maxZ: 44 }     // panchina destra
];

// Punti di interazione: il server verifica la distanza prima di accettare l'azione.
const TAVERN_SPOTS = [
  { id: 'bar', x: 62, z: -79, radius: 9 },
  { id: 'chair-left', x: -96, z: 28, radius: 8 },
  { id: 'chair-right', x: 96, z: 28, radius: 8 },
  { id: 'fireplace', x: -48, z: -88, radius: 9 },
  { id: 'table', x: 0, z: 72, radius: 10 }
];

// Posti di partenza fuori dal tavolo, uno per ogni giocatore (max 12).
const DEFAULT_AVATAR_SEATS = [
  { x: -96, z: -20 }, { x: -96, z: 20 },
  { x: 96, z: -20 }, { x: 96, z: 20 },
  { x: -50, z: 72 }, { x: 50, z: 72 },
  { x: 0, z: 78 }, { x: -40, z: -70 },
  { x: 40, z: -70 }, { x: 0, z: -76 },
  { x: -100, z: 52 }, { x: 100, z: 52 }
];

function createDefaultAvatar(index) {
  const seat = DEFAULT_AVATAR_SEATS[index % DEFAULT_AVATAR_SEATS.length];
  return { mode: 'seat', x: seat.x, z: seat.z, yaw: 0, spot: null, drinks: 0 };
}

function isInsideTavernObstacle(x, z) {
  return TAVERN_OBSTACLES.some(o =>
    x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ
  );
}

function clampTavernPosition(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  x = Math.min(TAVERN_BOUNDS.maxX, Math.max(TAVERN_BOUNDS.minX, x));
  z = Math.min(TAVERN_BOUNDS.maxZ, Math.max(TAVERN_BOUNDS.minZ, z));
  if (isInsideTavernObstacle(x, z)) return null;
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}

// Rate Limiting per prevenire Brute-Force sulla password Admin
const loginAttempts = new Map(); // ip/socketId -> { count, lockedUntil }

function isRateLimited(identifier) {
  const now = Date.now();
  const record = loginAttempts.get(identifier);
  if (!record) return false;
  if (record.lockedUntil && now < record.lockedUntil) return true;
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(identifier);
    return false;
  }
  return false;
}

function recordFailedLogin(identifier) {
  const now = Date.now();
  const record = loginAttempts.get(identifier) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + (5 * 60 * 1000); // 5 minuti di blocco
  }
  loginAttempts.set(identifier, record);
}

function clearFailedLogin(identifier) {
  loginAttempts.delete(identifier);
}

// Generatore codici stanza brevissimi a 4 cifre numeriche (es. '4821')
function generateRoomCode() {
  const code = crypto.randomInt(1000, 10000).toString(); // Es. 1000 - 9999
  return code;
}

// Confronto sicuro contro Timing Attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Sanitizzazione stringhe contro attacchi XSS
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, 40)
    .replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
}

/**
 * GESTIONE SOCKET.IO IN TEMPO REALE
 */
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;

  // 1. ADMIN CREA UNA STANZA
  socket.on('admin_create_room', (data, callback) => {
    const { password, roomName } = data || {};

    if (isRateLimited(clientIp)) {
      return callback({ success: false, message: 'Troppi tentativi errati. Riprova tra 5 minuti.' });
    }

    if (!safeCompare(password, ADMIN_MASTER_PASSWORD)) {
      recordFailedLogin(clientIp);
      return callback({ success: false, message: 'Password Admin errata.' });
    }

    clearFailedLogin(clientIp);

    const roomId = generateRoomCode();
    const adminToken = crypto.randomBytes(24).toString('hex');

    rooms[roomId] = {
      id: roomId,
      name: sanitizeText(roomName) || 'Tavolata Goliardica',
      adminToken: adminToken,
      adminSocketId: socket.id,
      state: 'LOBBY', // LOBBY, PLAYING, FINISHED
      currentTurnIndex: 0,
      isRolling: false,
      players: [],
      history: []
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.isAdmin = true;

    callback({
      success: true,
      roomId: roomId,
      adminToken: adminToken,
      roomName: rooms[roomId].name
    });

    console.log(`[ROOM CREATED] Stanza ${roomId} creata dall'Admin.`);
  });

  // 2. GIOCATORE ENTRA NELLA STANZA
  socket.on('player_join_room', (data, callback) => {
    const { roomId, playerName } = data || {};
    const room = rooms[roomId];

    if (!room) {
      return callback({ success: false, message: 'Codice Stanza non trovato.' });
    }

    const cleanName = sanitizeText(playerName);
    if (!cleanName) {
      return callback({ success: false, message: 'Nome non valido.' });
    }

    if (room.players.length >= 12) {
      return callback({ success: false, message: 'Stanza al completo (max 12 giocatori).' });
    }

    // Creazione session token per riconnessioni in caso di perdita Wi-Fi
    const sessionToken = crypto.randomBytes(16).toString('hex');
    const player = {
      id: socket.id,
      sessionToken: sessionToken,
      name: cleanName,
      position: 0,
      missTurns: 0,
      isFirstTurn: true,
      isOnline: true,
      // Campo opzionale: i client vecchi lo ignorano, quelli nuovi lo usano.
      avatar: createDefaultAvatar(room.players.length)
    };

    room.players.push(player);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.sessionToken = sessionToken;

    callback({
      success: true,
      sessionToken: sessionToken,
      player: player,
      roomId: roomId,
      roomState: room
    });

    io.to(roomId).emit('room_state_updated', room);
    console.log(`[PLAYER JOINED] ${cleanName} è entrato nella stanza ${roomId}`);
  });

  // 3. RICONNESSIONE GIOCATORE (SALVATAGGIO STANDBY TELEFONO)
  socket.on('player_reconnect', (data, callback) => {
    const { roomId, sessionToken } = data || {};
    const room = rooms[roomId];

    if (!room) {
      return callback({ success: false, message: 'Stanza non più attiva.' });
    }

    const player = room.players.find(p => p.sessionToken === sessionToken);
    if (!player) {
      return callback({ success: false, message: 'Sessione scaduta. Rientra col tuo nome.' });
    }

    // Aggiorna socket id
    player.id = socket.id;
    player.isOnline = true;
    if (!player.avatar) {
      player.avatar = createDefaultAvatar(room.players.indexOf(player));
    }
    socket.join(roomId);
    socket.roomId = roomId;
    socket.sessionToken = sessionToken;

    callback({ success: true, player: player, roomState: room });
    io.to(roomId).emit('room_state_updated', room);
    console.log(`[PLAYER RECONNECTED] ${player.name} si è riconnesso alla stanza ${roomId}`);
  });

  // 4. LANCIO DEL DADO (SERVER-AUTHORITATIVE: ZERO CHEAT)
  socket.on('request_roll_dice', (data, callback) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];

    if (!room || room.players.length === 0) {
      return callback && callback({ success: false, message: 'Partita non attiva.' });
    }

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || currentPlayer.id !== socket.id) {
      return callback && callback({ success: false, message: 'Non è il tuo turno!' });
    }

    if (room.isRolling) {
      return callback && callback({ success: false, message: 'Lancio già in corso.' });
    }

    room.isRolling = true;

    // Due dadi crittograficamente sicuri, come nelle regole classiche.
    const d1 = crypto.randomInt(1, 7);
    const d2 = crypto.randomInt(1, 7);
    const rollValue = d1 + d2;

    // Calcolo posizione con rimbalzo oltre il 63 (Il Castello).
    const bounce = (raw) => (raw > 63 ? 63 - (raw - 63) : raw);

    let newPos;
    const opening63 = (d1 === 6 && d2 === 3) || (d1 === 3 && d2 === 6);
    const opening53 = (d1 === 5 && d2 === 4) || (d1 === 4 && d2 === 5);

    if (currentPlayer.isFirstTurn) {
      currentPlayer.isFirstTurn = false;
      if (opening63) newPos = 26;
      else if (opening53) newPos = 53;
      else newPos = bounce(currentPlayer.position + rollValue);
    } else {
      newPos = bounce(currentPlayer.position + rollValue);
    }

    currentPlayer.position = newPos;

    // Stato autoritativo aggiornato subito: tutti i client vedono la nuova casella.
    io.to(roomId).emit('room_state_updated', room);

    // Notifica tutti i telefoni contemporaneamente (anche chi ha lanciato).
    io.to(roomId).emit('dice_rolled', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      dice1: d1,
      dice2: d2,
      rollValue: rollValue,
      newPosition: newPos,
      openingSpecial: opening63 || opening53
    });

    // Controllo vittoria al Castello (Casella 63)
    if (newPos === 63) {
      room.state = 'FINISHED';
      io.to(roomId).emit('player_won', { winner: currentPlayer });
    }

    room.isRolling = false;
    if (callback) callback({ success: true, dice1: d1, dice2: d2, rollValue: rollValue });
  });

  // 5. COMPLETAMENTO SFIDA & CAMBIO TURNO (Autorizzato solo per il giocatore di turno o l'Admin)
  socket.on('resolve_turn', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room || room.players.length === 0) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (currentPlayer && currentPlayer.id !== socket.id && !socket.isAdmin) {
      return; // Ignora chiamate non autorizzate
    }

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    io.to(roomId).emit('room_state_updated', room);
  });

  // 6. AZIONI SEGRETE DELL'ADMIN (GOD MODE)
  socket.on('admin_god_action', (data, callback) => {
    const { roomId, adminToken, action, targetPlayerIndex, customMessage } = data || {};
    const room = rooms[roomId];

    if (!room || room.adminToken !== adminToken) {
      return callback && callback({ success: false, message: 'Non autorizzato.' });
    }

    if (action === 'RESET_GAME') {
      room.players.forEach((p, i) => {
        p.position = 0;
        p.missTurns = 0;
        p.isFirstTurn = true;
        p.avatar = createDefaultAvatar(i); // torna al posto, drink sociali azzerati
      });
      room.currentTurnIndex = 0;
      io.to(roomId).emit('room_state_updated', room);
      io.to(roomId).emit('admin_broadcast_alert', '👑 L\'Admin ha resettato le posizioni alla partenza!');
    } else if (action === 'FORCE_CASCADE') {
      io.to(roomId).emit('admin_cascade_drink', {
        message: '🌊 CASCATA GENERALE SCATENATA DALL\'ADMIN! Tutti bevono ora!'
      });
    } else if (action === 'CUSTOM_CHALLENGE' && customMessage) {
      io.to(roomId).emit('admin_custom_challenge_drop', {
        message: sanitizeText(customMessage)
      });
    } else if (action === 'KICK_PLAYER' && targetPlayerIndex !== undefined) {
      if (room.players[targetPlayerIndex]) {
        const kicked = room.players.splice(targetPlayerIndex, 1)[0];
        if (room.currentTurnIndex >= room.players.length) {
          room.currentTurnIndex = 0;
        }
        io.to(roomId).emit('room_state_updated', room);
        io.to(roomId).emit('admin_broadcast_alert', `👑 L'Admin ha espulso ${kicked.name}.`);
      }
    } else if (action === 'TELEPORT' && targetPlayerIndex !== undefined) {
      const p = room.players[targetPlayerIndex];
      if (p) {
        p.position = Math.min(63, Math.max(0, parseInt(data.newPosition) || 0));
        io.to(roomId).emit('room_state_updated', room);
      }
    }

    if (callback) callback({ success: true });
  });

  // 7a. MOVIMENTO AVATAR TAVERNA (10 Hz, validato, separato dallo stato partita)
  socket.on('avatar_update', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!player.avatar) player.avatar = createDefaultAvatar(room.players.indexOf(player));

    const now = Date.now();
    if (now - (socket.lastAvatarUpdateAt || 0) < 90) return; // max ~10 Hz per client
    socket.lastAvatarUpdateAt = now;

    const requestedX = Number(data && data.x);
    const requestedZ = Number(data && data.z);
    if (!Number.isFinite(requestedX) || !Number.isFinite(requestedZ)) return;

    // Clamp di velocità: nessun teleport. 1.8 unità / 100ms ≈ 18 unità/s.
    const dx = requestedX - player.avatar.x;
    const dz = requestedZ - player.avatar.z;
    const dist = Math.hypot(dx, dz);
    let nextX = player.avatar.x;
    let nextZ = player.avatar.z;
    if (dist > 0.001) {
      const step = Math.min(dist, 1.8);
      nextX += (dx / dist) * step;
      nextZ += (dz / dist) * step;
    }

    const valid = clampTavernPosition(nextX, nextZ);
    if (!valid) return;

    player.avatar.x = valid.x;
    player.avatar.z = valid.z;

    const yaw = Number(data && data.yaw);
    if (Number.isFinite(yaw)) {
      player.avatar.yaw = Math.round(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 100) / 100;
    }
    if (data && (data.mode === 'roam' || data.mode === 'seat')) {
      player.avatar.mode = data.mode;
    }

    // Evento leggero: solo questo avatar, non l'intera stanza.
    io.to(roomId).emit('avatar_state_updated', {
      playerId: player.id,
      avatar: player.avatar
    });
  });

  // 7b. AZIONI SOCIALI (drink/sit/stand): cosmetiche, con cooldown
  socket.on('avatar_action', (data) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!player.avatar) player.avatar = createDefaultAvatar(room.players.indexOf(player));

    const action = data && data.action;
    if (action === 'drink') {
      const spot = TAVERN_SPOTS.find(s => s.id === (data && data.spotId));
      if (!spot) return;
      const distance = Math.hypot(player.avatar.x - spot.x, player.avatar.z - spot.z);
      if (distance > spot.radius + 2) return;

      const now = Date.now();
      if (now - (player.avatar.lastDrinkAt || 0) < 1800) return; // cooldown anti-spam
      player.avatar.lastDrinkAt = now;
      player.avatar.drinks = (player.avatar.drinks || 0) + 1;
      player.avatar.spot = spot.id;
    } else if (action === 'sit') {
      player.avatar.mode = 'seat';
      player.avatar.spot = (data && data.spotId) || null;
    } else if (action === 'stand') {
      player.avatar.mode = 'roam';
      player.avatar.spot = null;
    } else {
      return;
    }

    io.to(roomId).emit('avatar_state_updated', {
      playerId: player.id,
      avatar: player.avatar,
      action
    });
  });

  // 7. DISCONNESSIONE SOCKET
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.isOnline = false;
      io.to(roomId).emit('room_state_updated', room);
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`   🪿 IL NOBILE GIOCO DELL'OCA - SERVER ATTIVO!`);
  console.log(`   Porta: ${PORT}`);
  const adminStatus = ADMIN_MASTER_PASSWORD ? '[configurata]' : '[NON IMPOSTATA]';
  console.log('   Admin Password: ' + adminStatus);
  console.log(`   Apri nel browser: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
