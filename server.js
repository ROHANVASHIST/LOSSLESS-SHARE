const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_ROOM_AGE = 15 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL = 60000;
const HEARTBEAT_INTERVAL = 25000;
const HEARTBEAT_TIMEOUT = 30000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_ACTIONS_PER_WINDOW = 30;

const DIST_DIR = path.join(__dirname, 'dist');
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATIC_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : PUBLIC_DIR;

const rooms = new Map();
const clients = new Map();
const rateLimit = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

class Room {
  constructor(id, expiryMinutes = 15) {
    this.id = id;
    this.participants = [];
    this.createdAt = Date.now();
    this.expiryMs = expiryMinutes * 60 * 1000;
  }
  add(socket) {
    if (!this.participants.includes(socket)) {
      this.participants.push(socket);
    }
  }
  remove(socket) {
    this.participants = this.participants.filter(p => p !== socket);
  }
  others(socket) {
    return this.participants.filter(p => p !== socket && p.readyState === 1);
  }
  broadcast(data, exclude = null) {
    this.participants.forEach(p => {
      if (p !== exclude && p.readyState === 1) {
        p.send(data);
      }
    });
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimit.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 0, windowStart: now };
    rateLimit.set(ip, entry);
  }
  entry.count++;
  return entry.count <= MAX_ACTIONS_PER_WINDOW;
}

setInterval(() => {
  const now = Date.now();
  rateLimit.forEach((entry, ip) => {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  });
}, RATE_LIMIT_WINDOW);

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');

  let url = req.url === '/' ? '/index.html' : decodeURIComponent(req.url);

  if (STATIC_DIR === DIST_DIR && url.startsWith('/ws')) {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('Upgrade Required');
    return;
  }

  const filePath = path.join(STATIC_DIR, url);

  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isMedia = ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.mp4' || ext === '.webm';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isMedia ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(data);
  });
});

const { Server: WSServer } = require('ws');
const wss = new WSServer({ server });

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIp)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Please slow down.' }));
    ws.close(1008, 'Rate limited');
    return;
  }

  const id = crypto.randomUUID();
  ws.id = id;
  ws.room = null;
  ws.isAlive = true;
  ws.aliveSince = Date.now();
  clients.set(id, ws);

  ws.on('pong', heartbeat);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!checkRateLimit(clientIp)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded. Please slow down.' }));
        return;
      }
      handleMessage(ws, msg);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    if (ws.room) {
      const room = ws.room;
      room.remove(ws);
      room.broadcast(JSON.stringify({ type: 'peer-left', id: ws.id }));
      if (room.participants.length === 0) {
        rooms.delete(room.id);
      }
    }
    clients.delete(ws.id);
  });

  ws.on('error', () => {
    clients.delete(ws.id);
  });

  ws.send(JSON.stringify({ type: 'connected', id: ws.id }));
});

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      clients.delete(ws.id);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatTimer);
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'create': {
      let roomId = msg.roomId;
      if (!roomId || !/^[A-Z0-9]{6}$/.test(roomId)) {
        roomId = generateRoomId();
      }
      if (rooms.has(roomId)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room already exists. Try joining instead.' }));
        return;
      }
      const expiryMin = Math.max(1, Math.min(1440, msg.expiry || 15));
      ws.room = rooms.get(roomId) || new Room(roomId, expiryMin);
      ws.room.add(ws);
      rooms.set(roomId, ws.room);
      ws.send(JSON.stringify({ type: 'room-created', roomId, expiry: expiryMin }));
      break;
    }

    case 'join': {
      const roomId = msg.roomId;
      if (!roomId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room ID is required' }));
        return;
      }
      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found. It may have expired.' }));
        return;
      }
      if (room.participants.length >= 10) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full (max 10 participants)' }));
        return;
      }
      ws.room = room;
      room.add(ws);

      const peerList = room.participants
        .filter(p => p !== ws && p.readyState === 1)
        .map(p => p.id);

      room.broadcast(JSON.stringify({ type: 'peer-joined', id: ws.id }), ws);
      ws.send(JSON.stringify({ type: 'room-joined', roomId, peers: peerList }));
      break;
    }

    case 'offer':
    case 'answer':
    case 'ice-candidate':
      relayToOthers(ws, msg);
      break;

    case 'file-chunk':
      relayFileChunk(ws, msg);
      break;

    case 'leave':
      if (ws.room) {
        const room = ws.room;
        room.remove(ws);
        room.broadcast(JSON.stringify({ type: 'peer-left', id: ws.id }));
        if (room.participants.length === 0) {
          rooms.delete(room.id);
        }
        ws.room = null;
      }
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

function relayToOthers(ws, msg) {
  if (!ws.room) return;
  const { type, to, ...rest } = msg;
  if (to) {
    const recipient = clients.get(to);
    if (recipient && recipient.readyState === 1) {
      recipient.send(JSON.stringify({ type, from: ws.id, ...rest }));
    }
  } else {
    ws.room.broadcast(JSON.stringify({ type, from: ws.id, ...rest }), ws);
  }
}

function relayFileChunk(ws, msg) {
  if (!ws.room) return;
  const payload = {
    type: 'file-chunk',
    from: ws.id,
    fileId: msg.fileId,
    index: msg.index,
    data: Array.isArray(msg.data) ? msg.data : Array.from(new Uint8Array(msg.data)),
    done: !!msg.done,
  };
  ws.room.broadcast(JSON.stringify(payload), ws);
}

function generateRoomId() {
  let id;
  do {
    id = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(id));
  return id;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, id) => {
    room.participants = room.participants.filter(p => p.readyState === 1);
    const roomAge = room.expiryMs || MAX_ROOM_AGE;
    if (now - room.createdAt > roomAge || room.participants.length === 0) {
      room.broadcast(JSON.stringify({ type: 'room-closed', reason: 'Room expired' }));
      rooms.delete(id);
    }
  });
}, ROOM_CLEANUP_INTERVAL);

function gracefulShutdown() {
  console.log('\nShutting down gracefully...');
  clearInterval(heartbeatTimer);
  clearInterval(cleanupTimer);

  wss.clients.forEach(ws => {
    ws.close(1001, 'Server shutting down');
  });

  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

server.listen(PORT, () => {
  console.log(`FlashShare server running on http://localhost:${PORT}`);
});
