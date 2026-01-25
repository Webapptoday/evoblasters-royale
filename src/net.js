const ENDPOINT_HTTP = "https://evoblasters-server-production.up.railway.app";
const ENDPOINT_WS = "wss://evoblasters-server-production.up.railway.app";

let connectingPromise = null;

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),
  bullets: new Map(),
  onShotCallbacks: [],

  registerShotListener(callback) {
    this.onShotCallbacks.push(callback);
    console.log("[net] Registered shot listener");
  },

  async connect(playerName = "Player") {
    if (this.room) {
      console.warn("[net] Already in battle room");
      return this.room;
    }

    if (connectingPromise) {
      return connectingPromise;
    }

    connectingPromise = (async () => {
      try {
        console.log("[net] 1. Calling matchmaker...");
        
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Matchmaker timeout")), 10000)
        );

        const resp = await Promise.race([
          fetch(`${ENDPOINT_HTTP}/matchmake`),
          timeout
        ]);

        if (!resp.ok) {
          throw new Error(`Matchmaker error: ${resp.status}`);
        }

        const data = await resp.json();
        const roomId = data.roomId;

        if (!roomId) {
          throw new Error("No roomId from matchmaker");
        }

        console.log("[net] 2. Got roomId:", roomId.slice(0, 8));
        console.log("[net] 3. Connecting to WebSocket...");

        if (!this.client) {
          this.client = new Colyseus.Client(ENDPOINT_WS);
        }

        const timeout2 = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("WebSocket timeout")), 15000)
        );

        this.room = await Promise.race([
          this.client.joinById(roomId, { name: playerName.slice(0, 16) }),
          timeout2
        ]);

        if (!this.room) {
          throw new Error("Failed to join room (returned null)");
        }

        this.sessionId = this.room.sessionId;

        console.log("[net] ✅ Joined room:", roomId.slice(0, 8));
        console.log("[net] ✅ My sessionId:", this.sessionId.slice(0, 8));

        // Listen to state changes
        this.room.onStateChange((state) => {
          // Sync players
          this.players.clear();
          if (state.players) {
            state.players.forEach((p, id) => {
              this.players.set(id, {
                x: p.x,
                y: p.y,
                hp: p.hp,
                alive: p.alive,
                name: p.name,
              });
            });
          }

          // Sync bullets
          this.bullets.clear();
          if (state.bullets) {
            state.bullets.forEach((b, id) => {
              this.bullets.set(id, {
                id: b.id,
                owner: b.owner,
                x: b.x,
                y: b.y,
                vx: b.vx,
                vy: b.vy,
              });
            });
          }

          console.log(`[net] State: ${this.players.size} players, ${this.bullets.size} bullets`);
        });

        // Error handler
        this.room.onError = (code, msg) => {
          console.error("[net] Room error:", code, msg);
        };

        // Leave handler
        this.room.onLeave = () => {
          console.warn("[net] Left room");
          this.room = null;
        };

        return this.room;
      } catch (err) {
        console.error("[net] ❌ Connection failed:", err.message || err);
        connectingPromise = null;
        throw err;
      }
    })();

    return connectingPromise;
  },

  sendMove(x, y) {
    if (!this.room) return;
    this.room.send("move", { x, y });
  },

  shoot(dirx, diry) {
    if (!this.room) return;
    console.log("[net] Sending shoot:", { dirx, diry });
    this.room.send("shoot", { dirx, diry });
  },

  async disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.players.clear();
    this.bullets.clear();
    connectingPromise = null;
  },
};

export default net;
