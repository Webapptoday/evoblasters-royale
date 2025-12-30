// Colyseus is loaded from CDN in index.html
const ENDPOINT = "wss://evoblasters-server-production.up.railway.app";

export const net = {
  client: null,
  room: null,
  sessionId: null,
  players: new Map(),

  async connect(playerName = "Player") {
    this.client = new Colyseus.Client(ENDPOINT);

    this.room = await this.client.joinOrCreate("battle");
    this.sessionId = this.room.sessionId;

    this.room.send("set_name", { name: playerName });

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
