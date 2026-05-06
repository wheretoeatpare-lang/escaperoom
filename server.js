// server.js — Simple Node.js WebSocket server for multiplayer escape room
// Run: node server.js   (requires: npm install)

const { WebSocketServer } = require('ws');

const PORT = 8080;
const wss  = new WebSocketServer({ port: PORT });

// ── State ───────────────────────────────────
const players = new Map();   // id → playerData
let   puzzleSolved = false;
const COLORS = ['#ff4444','#44aaff','#44ff88','#ffaa22','#dd44ff','#ff88aa'];
let   colorIdx = 0;

// ── Broadcast helper ────────────────────────
function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== excludeWs && client.readyState === 1 /* OPEN */) {
      client.send(msg);
    }
  }
}

// ── Connection ──────────────────────────────
wss.on('connection', ws => {
  const id    = `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const color = COLORS[colorIdx++ % COLORS.length];

  const pData = { id, color, x:0, y:1.72, z:3.5, ry:0 };
  players.set(id, pData);

  // 1. Send full init to new player
  ws.send(JSON.stringify({
    type: 'init',
    id,
    color,
    players: [...players.values()],
    puzzleSolved,
  }));

  // 2. Announce new player to everyone else
  broadcast({ type:'playerJoined', player: pData }, ws);

  log(`+ ${id} (${color}) joined. Total: ${players.size}`);

  // ── Incoming messages ──────────────────────
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'move') {
      const p = players.get(id);
      if (p) Object.assign(p, { x:msg.x, y:msg.y, z:msg.z, ry:msg.ry });
      // Relay to all other clients
      broadcast({ type:'playerMoved', id, x:msg.x, y:msg.y, z:msg.z, ry:msg.ry }, ws);
    }

    if (msg.type === 'puzzleSolved' && !puzzleSolved) {
      puzzleSolved = true;
      log(`🔓 Puzzle solved by ${id}!`);
      broadcast({ type:'puzzleSolved' }); // tell everyone (including sender)
    }
  });

  // ── Disconnect ─────────────────────────────
  ws.on('close', () => {
    players.delete(id);
    broadcast({ type:'playerLeft', id });
    log(`- ${id} left. Total: ${players.size}`);
  });

  ws.on('error', err => {
    console.error(`[${id}] ws error:`, err.message);
  });
});

// ── Admin endpoint: reset puzzle state ──────
// Send a POST to ws:// doesn't exist — but you can restart the server to reset.

function log(msg) {
  const ts = new Date().toTimeString().slice(0,8);
  console.log(`[${ts}] ${msg}`);
}

console.log(`\n🎮  Escape Room Server`);
console.log(`    WebSocket: ws://localhost:${PORT}`);
console.log(`    Supports up to ${COLORS.length} simultaneous players\n`);
