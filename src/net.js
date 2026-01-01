// Colyseus is loaded from CDN in index.html
const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

let connectingPromise = null;

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),

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

      const room = await this.client.joinOrCreate("battle");
      this.room = room;
      this.sessionId = room.sessionId;

      console.log("Joined room:", room.name, this.sessionId);

      // ✅ send name AFTER join
      room.send("set_name", { name: playerName });

      room.onStateChange((state) => {
        this.players.clear();
        state.players.forEach((p, id) => {
          this.players.set(id, {
            x: p.x,
            y: p.y,
            hp: p.hp,
            alive: p.alive,
            name: p.name,
          });
        });
      });

      room.onLeave((code) => {
        console.warn("Left room, code:", code);
        this.room = null;
        connectingPromise = null;
      });

      room.onError((code, message) => {
        console.error("Room error:", code, message);
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
