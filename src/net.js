// Colyseus is loaded from CDN in index.html
const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),

  async connect(playerName = "Player") {
    this.client = new Colyseus.Client(ENDPOINT);

    // joins or creates the "battle" room (matches server: define("battle", ...))
    this.room = await this.client.joinOrCreate("battle");
    this.sessionId = this.room.sessionId;

    // optional: set name
    this.room.send("set_name", { name: playerName });

    // state sync
    this.room.onStateChange((state) => {
      // state.players is a MapSchema
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

    // handle leave / errors
    this.room.onLeave(() => {
      console.warn("Left room");
      this.room = null;
    });

    console.log("Connected!", this.sessionId);
    return this.room;
  },

  sendMove(x, y) {
    if (!this.room) return;
    this.room.send("move", { x, y });
  },
};
