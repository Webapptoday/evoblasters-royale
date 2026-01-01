import { net } from "./net.js";

export class LobbyScene extends Phaser.Scene {
  constructor() { super("LobbyScene"); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1).setOrigin(0,0);

    this.title = this.add.text(cx, cy - 140, "MATCH LOBBY", {
      fontFamily: "monospace", fontSize: "42px", color: "#ffffff"
    }).setOrigin(0.5);

    this.status = this.add.text(cx, cy - 40, "Waiting for match to start...", {
      fontFamily: "monospace", fontSize: "18px", color: "#b7c5ff"
    }).setOrigin(0.5);

    this.list = this.add.text(cx, cy + 10, "", {
      fontFamily: "monospace", fontSize: "18px", color: "#ffffff", align: "center"
    }).setOrigin(0.5);

    // ✅ Wait for 2 players to join, then auto-start (no ready button)
    // Monitor room state changes
    if (net.room) {
      net.room.onStateChange(() => {
        // Update player list from net.players
        const lines = Array.from(net.players.values()).map(p => p.name);
        this.list.setText(lines.join("\n") || "(waiting for players)");
        console.log("[LobbyScene] Players in room:", net.players.size);
      });
    }

    // Auto-start game only when 2+ players have joined
    this.checkReadyInterval = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        console.log("[LobbyScene] Checking: players.size=", net.players.size);
        if (net.players.size >= 2) {
          console.log("[LobbyScene] ✅ 2+ players detected, starting game...");
          this.checkReadyInterval.remove();
          this.scene.start("WaitingScene");
        }
      }
    });
  }
}
