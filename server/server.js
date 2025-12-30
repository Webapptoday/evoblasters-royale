const http = require("http");
const express = require("express");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { Room } = require("colyseus");

class BattleRoom extends Room {
  onCreate() {
    this.setState({ players: {} });

    this.onMessage("move", (client, data) => {
      if (!this.state.players[client.sessionId]) return;
      this.state.players[client.sessionId].x = data.x;
      this.state.players[client.sessionId].y = data.y;
    });

    this.onMessage("set_name", (client, data) => {
      if (!this.state.players[client.sessionId]) return;
      this.state.players[client.sessionId].name = data.name || "Player";
    });
  }

  onJoin(client) {
    this.state.players[client.sessionId] = {
      x: 400,
      y: 300,
      hp: 100,
      alive: true,
      name: "Player",
    };
  }

  onLeave(client) {
    delete this.state.players[client.sessionId];
  }
}

const app = express();

// IMPORTANT for Railway healthchecks
app.get("/", (req, res) => res.status(200).send("OK"));

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("battle", BattleRoom);

// Railway provides PORT
const PORT = process.env.PORT || 8080;

gameServer.listen(PORT);
console.log("Server listening on port", PORT);
