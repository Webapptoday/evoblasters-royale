// Colyseus is loaded from CDN in index.html
const ENDPOINT = "https://evoblasters-server-production.up.railway.app";

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),

  async connect(playerName = "Player") {
    try {
      console.log("Connecting to Colyseus server…");

      this.client = new Colyseus.Client(ENDPOINT);

      this.room = await this.client.joinOrCreate("battle", {
        name: playerName,
      });

      this.sessionId = this.room.sessionId;

      console.log("Joined room:", this.room.name, this.sessionId);

      this.room.onStateChange((state) => {
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

      this.room.onLeave((code) => {
        console.warn("Left room, code:", code);
        this.room = null;
      });

      this.room.onError((code, message) => {
        console.error("Room error:", code, message);
      });

      return this.room;
    } catch (err) {
      console.error("FAILED to connect to Colyseus:", err);
      throw err;
    }
  },

  sendMove(x, y) {
    if (!this.room) return;
    this.room.send("move", { x, y });
  },
};
