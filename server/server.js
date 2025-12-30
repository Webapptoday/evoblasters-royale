/**
 * Evo Blast Royale - Local Multiplayer Server (Socket.IO)
 *
 * Quick Start (localhost):
 *   cd server && npm i && node server.js
 *   Server listens on http://localhost:3000
 *
 * Authoritative for bullets, damage, elimination, and respawn.
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- Game constants (match your client sizes) ---
const WORLD_W = 2600;
const WORLD_H = 1800;
const PLAYER_RADIUS = 16;

const TICK_HZ = 30;
const DT = 1 / TICK_HZ;

const MAX_PLAYERS = 2;

const START_HP = 100;
const RESPAWN_SECONDS = 3;

const WEAPONS = {
  basic: { name: "Basic Blaster", damage: 10, bulletSpeed: 900, ttl: 1.2, fireRateMs: 160 },
  rapid: { name: "Rapid Blaster", damage: 12, bulletSpeed: 1000, ttl: 1.2, fireRateMs: 140 },
};

let matchState = "LOBBY"; // LOBBY | RUNNING
let bullets = []; // {id, ownerId, x,y, vx,vy, damage, life}

// socket.id -> player
const players = {}; // { id: {name,x,y,hp,alive,lastShotAt,weaponKey,ready} }

function rand(min, max) { return Math.random() * (max - min) + min; }

function randomSpawn() {
  // spawn away from edges
  return { x: rand(200, WORLD_W - 200), y: rand(200, WORLD_H - 200) };
}

function broadcastLobby() {
  const list = Object.entries(players).map(([id, p]) => ({
    id, name: p.name, ready: p.ready
  }));
  io.emit("lobbyState", { matchState, players: list, count: list.length, max: MAX_PLAYERS });
}

function tryStartMatch() {
  const ids = Object.keys(players);
  if (ids.length !== MAX_PLAYERS) return;
  if (!ids.every(id => players[id].ready)) return;

  matchState = "RUNNING";

  // Reset players for match
  // MVP: spawn both players near center so they immediately see each other
  const centerX = WORLD_W / 2;
  const centerY = WORLD_H / 2;
  const spawnPoints = [
    { x: centerX - 120, y: centerY },
    { x: centerX + 120, y: centerY }
  ];

  ids.forEach((id, idx) => {
    const sp = spawnPoints[idx % spawnPoints.length];
    players[id].x = sp.x;
    players[id].y = sp.y;
    players[id].hp = START_HP;
    players[id].alive = true;
    players[id].weaponKey = "basic";
    players[id].lastShotAt = 0;
  });

  bullets = [];

  io.emit("matchStart", {
    world: { w: WORLD_W, h: WORLD_H },
    players: Object.fromEntries(ids.map(id => [id, {
      name: players[id].name, x: players[id].x, y: players[id].y, hp: players[id].hp, alive: players[id].alive,
      weaponKey: players[id].weaponKey
    }]))
  });

  broadcastLobby();
}

function endMatchToLobby() {
  matchState = "LOBBY";
  bullets = [];
  // keep names, reset ready so they must click ready again
  Object.values(players).forEach(p => { p.ready = false; p.alive = true; p.hp = START_HP; });
  io.emit("matchEnded", {});
  broadcastLobby();
}

// --- Authoritative bullet simulation ---
let bulletSeq = 1;

function spawnBullet(ownerId, x, y, dx, dy) {
  const p = players[ownerId];
  if (!p || !p.alive) return;

  const w = WEAPONS[p.weaponKey] || WEAPONS.basic;

  const len = Math.hypot(dx, dy);
  if (len < 0.0001) return;
  dx /= len; dy /= len;

  const id = String(bulletSeq++);
  const vx = dx * w.bulletSpeed;
  const vy = dy * w.bulletSpeed;

  bullets.push({
    id,
    ownerId,
    x,
    y,
    vx,
    vy,
    damage: w.damage,
    life: w.ttl
  });

  // tell clients to render this bullet
  io.emit("bulletSpawn", { id, ownerId, x, y, vx, vy, ttl: w.ttl });
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function damagePlayer(targetId, amount, attackerId) {
  const t = players[targetId];
  if (!t || !t.alive) return;

  t.hp = Math.max(0, t.hp - amount);
  io.emit("hpUpdate", { id: targetId, hp: t.hp });

  if (t.hp <= 0) {
    t.alive = false;
    io.emit("eliminated", { id: targetId, by: attackerId });

    setTimeout(() => {
      // only respawn if match still running and player still connected
      if (matchState !== "RUNNING") return;
      if (!players[targetId]) return;

      // Respawn near center for MVP to keep players engaged
      const centerX = WORLD_W / 2;
      const centerY = WORLD_H / 2;
      const jitter = 140; // small offset range
      const rx = centerX + rand(-jitter, jitter);
      const ry = centerY + rand(-jitter, jitter);
      players[targetId].x = rx;
      players[targetId].y = ry;
      players[targetId].hp = START_HP;
      players[targetId].alive = true;
      players[targetId].weaponKey = "basic";

      io.emit("respawn", { id: targetId, x: rx, y: ry, hp: START_HP, weaponKey: "basic" });
    }, RESPAWN_SECONDS * 1000);
  }
}

setInterval(() => {
  if (matchState !== "RUNNING") return;

  // move bullets + collisions
  const aliveIds = Object.keys(players).filter(id => players[id].alive);

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    b.x += b.vx * DT;
    b.y += b.vy * DT;
    b.life -= DT;

    // expire/out of bounds
    if (b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
      bullets.splice(i, 1);
      io.emit("bulletDespawn", { id: b.id });
      continue;
    }

    // hit test against players (except owner)
    for (const pid of aliveIds) {
      if (pid === b.ownerId) continue;
      const p = players[pid];
      const hit = dist2(b.x, b.y, p.x, p.y) <= (PLAYER_RADIUS * PLAYER_RADIUS);
      if (hit) {
        // remove bullet
        bullets.splice(i, 1);
        io.emit("bulletDespawn", { id: b.id });

        damagePlayer(pid, b.damage, b.ownerId);
        break;
      }
    }
  }
}, 1000 / TICK_HZ);

// --- Socket handling ---
io.on("connection", (socket) => {
  // deny if full
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit("serverFull", { max: MAX_PLAYERS });
    socket.disconnect(true);
    return;
  }

  players[socket.id] = {
    name: "Player",
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    hp: START_HP,
    alive: true,
    weaponKey: "basic",
    lastShotAt: 0,
    ready: false
  };

  socket.emit("connected", { id: socket.id, matchState });
  broadcastLobby();

  socket.on("setName", ({ name }) => {
    const p = players[socket.id];
    if (!p) return;
    p.name = String(name || "Player").slice(0, 16);
    broadcastLobby();
    io.emit("nameUpdate", { id: socket.id, name: p.name });
  });

  socket.on("ready", ({ ready }) => {
    const p = players[socket.id];
    if (!p) return;
    p.ready = !!ready;
    broadcastLobby();
    tryStartMatch();
  });

  socket.on("move", ({ x, y }) => {
    const p = players[socket.id];
    if (!p || matchState !== "RUNNING" || !p.alive) return;

    // accept client position (MVP)
    p.x = Math.max(0, Math.min(WORLD_W, x));
    p.y = Math.max(0, Math.min(WORLD_H, y));

    socket.broadcast.emit("playerMoved", { id: socket.id, x: p.x, y: p.y });
  });

  socket.on("shoot", ({ x, y, dx, dy, t }) => {
    const p = players[socket.id];
    if (!p || matchState !== "RUNNING" || !p.alive) return;

    const w = WEAPONS[p.weaponKey] || WEAPONS.basic;
    const now = Date.now();
    if (now - p.lastShotAt < w.fireRateMs) return; // fire rate gate
    p.lastShotAt = now;

    spawnBullet(socket.id, x, y, dx, dy);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", { id: socket.id });

    // if someone leaves during match, end match back to lobby
    if (matchState === "RUNNING") endMatchToLobby();
    else broadcastLobby();
  });
});

server.listen(3000, () => console.log("Server on http://localhost:3000"));
