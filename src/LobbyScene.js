import { net } from "./net.js";

export class LobbyScene extends Phaser.Scene {
  constructor() { super("LobbyScene"); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1).setOrigin(0,0);

    this.title = this.add.text(cx, cy - 140, "FINDING MATCH", {
      fontFamily: "monospace", fontSize: "42px", color: "#ffffff"
    }).setOrigin(0.5);

    this.status = this.add.text(cx, cy - 40, "Waiting for opponent...", {
      fontFamily: "monospace", fontSize: "18px", color: "#b7c5ff"
    }).setOrigin(0.5);

    this.opponent = this.add.text(cx, cy + 40, "", {
      fontFamily: "monospace", fontSize: "18px", color: "#00ff00", align: "center"
    }).setOrigin(0.5);

    // ✅ Set callback for when match is found
    net.matchFoundCallback = (matchInfo) => {
      console.log("[LobbyScene] Match found! Opponent:", matchInfo.opponent);
      this.opponent.setText("vs " + matchInfo.opponent);
      this.status.setText("Match starting...");
      
      // Auto-transition after brief delay for visual effect
      this.time.delayedCall(500, () => {
        this.scene.start("WaitingScene");
      });
    };

    console.log("[LobbyScene] Waiting in matchmaking queue...");
  }

  shutdown() {
    net.matchFoundCallback = null;
  }
}
