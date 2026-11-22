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
      isOnline: true
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

    // Generazione casuale crittograficamente sicura (1 a 6)
    const rollValue = crypto.randomInt(1, 7);

    // Calcolo posizione con rimbalzo oltre il 63 (Il Castello)
    let newPos = currentPlayer.position + rollValue;
    if (newPos > 63) {
      const overshoot = newPos - 63;
      newPos = 63 - overshoot;
    }

    currentPlayer.position = newPos;

    // Notifica tutti i telefoni contemporaneamente
    io.to(roomId).emit('dice_rolled', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      rollValue: rollValue,
      newPosition: newPos
    });

    // Controllo vittoria al Castello (Casella 63)
    if (newPos === 63) {
      room.state = 'FINISHED';
      io.to(roomId).emit('player_won', { winner: currentPlayer });
    }

    room.isRolling = false;
    if (callback) callback({ success: true, rollValue: rollValue });
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
      room.players.forEach(p => { p.position = 0; p.missTurns = 0; });
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
  console.log(`   Admin Password: ${ADMIN_MASTER_PASSWORD ? '[configurata]' : '[NON IMPOSTATA]'});
  console.log(`   Apri nel browser: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
