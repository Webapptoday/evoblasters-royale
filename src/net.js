// Colyseus is loaded from CDN in index.html
const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

let connectingPromise = null;

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),
  onShotCallbacks: [], // ✅ list of handlers for shot events

  registerShotListener(callback) {
    this.onShotCallbacks.push(callback);
    console.log("[net.js] Registered shot listener, total:", this.onShotCallbacks.length);
  },

  async connect(playerName = "Player") {
    // ✅ prevent double connect
    if (this.room) {
      console.warn("Already connected, reusing room");
      return this.room;
    }

    if (connectingPromise) {
      return connectingPromise;
    }

    connectingPromise = (async () => {
      console.log("Connecting to Colyseus…");

      // ✅ create client ONCE
      if (!this.client) {
        this.client = new Colyseus.Client(ENDPOINT);
      }

      const room = await this.client.joinOrCreate("battle", { roomId: "global" });
      this.room = room;
      this.sessionId = room.sessionId;

      console.log("Joined room:", room.name, this.sessionId);

      // ✅ send name AFTER join
      room.send("set_name", { name: playerName });

      // ✅ Wire shot listener IMMEDIATELY when room joins
      room.onMessage("shot", (msg) => {
        console.log("[net.js] Shot event received on room:", msg);
        // Call all registered listeners
        this.onShotCallbacks.forEach(cb => {
          try {
            cb(msg);
          } catch (err) {
            console.error("[net.js] Error in shot callback:", err);
          }
        });
      });

      room.onStateChange((state) => {
        console.log("[net.js] Room state changed, players count:", state.players.size);
        this.players.clear();
        state.players.forEach((p, id) => {
          console.log("[net.js] Player in state:", id, { x: p.x, y: p.y, hp: p.hp, alive: p.alive, name: p.name });
          this.players.set(id, {
            x: p.x,
            y: p.y,
            hp: p.hp,
            alive: p.alive,
            name: p.name,
          });
        });
        console.log("[net.js] Total players in net.players:", this.players.size);
      });

      room.onLeave((code) => {
        console.warn("[net.js] Left room, code:", code);
        console.warn("[net.js] Code explanations: 1000=normal, 4000=abnormal, 4002=client disconnect");
        this.room = null;
        connectingPromise = null;
      });

      room.onError((code, message) => {
        console.error("[net.js] Room error code:", code, "message:", message);
      });

      return room;
    })();

    return connectingPromise;
  },

  sendMove(x, y) {
    if (!this.room) return;
    this.room.send("move", { x, y });
  },
};
