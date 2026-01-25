const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

let connectingPromise = null;

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),
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
        console.log("[net] Connecting to", ENDPOINT);

        if (!this.client) {
          console.log("[net] Creating Colyseus client...");
          this.client = new Colyseus.Client(ENDPOINT);
        }

        // Direct join to "battle" room with timeout
        console.log("[net] Joining battle room...");
        
        // Add 15 second timeout for connection
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout - server may be down")), 15000)
        );

        const room = await Promise.race([
          this.client.joinOrCreate("battle", {
            name: playerName.slice(0, 16),
          }),
          timeout
        ]);

        if (!room) {
          throw new Error("joinOrCreate returned null/undefined");
        }

        this.room = room;
        this.sessionId = room.sessionId;
        
        console.log("[net] ✅ Joined battle room:", room.roomId);
        console.log("[net] ✅ My sessionId:", this.sessionId.slice(0, 8));

        // ✅ Listen to room state updates
        if (room.onStateChange) {
          room.onStateChange.once((state) => {
            console.log("[net] Initial state received, players:", state.players?.size || 0);
          });

          room.onStateChange((state) => {
            this.players.clear();
            if (state.players) {
              for (const [id, p] of state.players.entries()) {
                this.players.set(id, p);
              }
            }
            console.log(`[net] State updated - ${this.players.size} players`);
          });
        }

        // ✅ Match started - game can begin
        if (room.onMessage) {
          room.onMessage("match_start", (msg) => {
            console.log("[net] ✅ MATCH_START - game ready!");
          });

          // ✅ Bullets fired (server broadcast) - spawn on all clients
          room.onMessage("shot", (msg) => {
            console.log(`[net] SHOT: from=${msg.fromId.slice(0, 8)} hitId=${msg.hitId ? msg.hitId.slice(0, 8) : "MISS"}`);
            this.onShotCallbacks.forEach((cb) => cb(msg));
          });

          // ✅ Player joined
          room.onMessage("player_joined", (msg) => {
            console.log(`[net] PLAYER_JOINED: ${msg.name}`);
          });

          // ✅ Player left
          room.onMessage("player_left", (msg) => {
            console.log(`[net] PLAYER_LEFT`);
          });

          // ✅ Waiting for opponent
          room.onMessage("waiting_for_opponent", (msg) => {
            console.log("[net] WAITING_FOR_OPPONENT - waiting for 2nd player...");
          });
        }

        room.onError = (code, err) => {
          console.error("[net] Room error (code " + code + "):", err);
        };

        room.onLeave = (code) => {
          console.warn("[net] Left room, code:", code);
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

  sendShoot(x, y, dx, dy) {
    if (!this.room) return;
    this.room.send("shoot", { x, y, dx, dy });
  },

  async disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.players.clear();
    connectingPromise = null;
  },
};
