import { net } from "./net.js";

export class WaitingScene extends Phaser.Scene {
  constructor() { super("WaitingScene"); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1).setOrigin(0,0);

    this.title = this.add.text(cx, cy - 20, "Game Loading...", {
      fontFamily: "monospace", fontSize: "46px", color: "#ffffff"
    }).setOrigin(0.5);

    this.status = this.add.text(cx, cy + 40, "Waiting for opponent...", {
      fontFamily: "monospace", fontSize: "22px", color: "#b7c5ff"
    }).setOrigin(0.5);

    // ✅ Don't auto-transition - wait for server's game_can_start message
    if (net.battleRoom) {
      console.log("[WaitingScene] Battle room connected, waiting for server signal...");
      
      // Send ready signal to server
      net.battleRoom.send("game_ready", { timestamp: Date.now() });
      
      // Wait for both players to be ready before starting
      net.battleRoom.onMessage("game_can_start", (msg) => {
        console.log("[WaitingScene] ✅ Server says game can start!");
        this.status.setText("Starting!");
        this.status.setColor("#00ff00");
        
        this.time.delayedCall(300, () => {
          this.scene.start("GameScene");
        });
      });
    } else {
      console.error("[WaitingScene] No battle room!");
      this.time.delayedCall(1000, () => {
        this.scene.start("LobbyScene");
      });
    }
  }
}
