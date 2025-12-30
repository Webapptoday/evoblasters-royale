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

    this.readyBtn = this.add.text(cx, cy + 120, "READY", {
      fontFamily: "monospace", fontSize: "26px", color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.55)", padding: { left: 18, right: 18, top: 10, bottom: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.ready = false;

    this.readyBtn.on("pointerdown", () => {
      this.ready = !this.ready;
      this.readyBtn.setText(this.ready ? "READY ✅" : "READY");
      if (net.room) {
        net.room.send("ready", { ready: this.ready });
      }
    });

    // Monitor room state changes
    if (net.room) {
      net.room.onStateChange(() => {
        // Update player list from net.players
        const lines = Array.from(net.players.values()).map(p => p.name);
        this.list.setText(lines.join("\n") || "(waiting for players)");
      });
    }

    // Auto-start game after a delay (simulating match start)
    this.time.delayedCall(3000, () => {
      this.scene.start("WaitingScene");
    });
  }
}
