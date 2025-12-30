export class LobbyScene extends Phaser.Scene {
  constructor() { super("LobbyScene"); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1).setOrigin(0,0);

    this.title = this.add.text(cx, cy - 140, "MATCH LOBBY", {
      fontFamily: "monospace", fontSize: "42px", color: "#ffffff"
    }).setOrigin(0.5);

    this.status = this.add.text(cx, cy - 40, "Connecting...", {
      fontFamily: "monospace", fontSize: "18px", color: "#b7c5ff"
    }).setOrigin(0.5);

    this.list = this.add.text(cx, cy + 10, "", {
      fontFamily: "monospace", fontSize: "18px", color: "#ffffff", align: "center"
    }).setOrigin(0.5);

    this.readyBtn = this.add.text(cx, cy + 120, "READY", {
      fontFamily: "monospace", fontSize: "26px", color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { left: 18, right: 18, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.ready = false;

    const socket = this.game.socket;

    // Connection status helpers
    if (!socket) {
      this.status.setText("Socket not initialized. Go back and Start.");
    } else {
      if (socket.connected) {
        this.status.setText("Connected. Waiting for players...");
      } else {
        this.status.setText("Connecting to server...");
      }

      socket.on("connect", () => {
        this.status.setText("Connected. Waiting for players...");
      });
      socket.on("connect_error", () => {
        this.status.setText("Cannot connect. Is server running on :3000?");
      });
      socket.on("disconnect", () => {
        this.status.setText("Disconnected from server.");
      });
    }

    this.readyBtn.on("pointerdown", () => {
      this.ready = !this.ready;
      this.readyBtn.setText(this.ready ? "READY ✅" : "READY");
      socket.emit("ready", { ready: this.ready });
    });

    socket.on("serverFull", () => {
      this.status.setText("Server is full (max 2 players).");
      this.readyBtn.disableInteractive();
    });

    socket.on("lobbyState", ({ matchState, players, count, max }) => {
      if (matchState === "LOBBY") {
        this.status.setText(`Waiting for ${max} players... (${count}/${max})`);
      }

      const lines = players.map(p => `${p.name}${p.ready ? " ✅" : ""}`);
      this.list.setText(lines.join("\n") || "(no players)");
    });

    socket.on("matchStart", (payload) => {
      // Cache match info so GameScene can initialize even if the event fired earlier
      this.game.matchInfo = payload;
      this.scene.start("WaitingScene");
    });
  }
}
