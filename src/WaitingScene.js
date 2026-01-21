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
      
      let gameStarted = false;
      
      // ✅ Safety timeout: if game_can_start doesn't arrive in 20 seconds, go back to lobby
      this.time.delayedCall(20000, () => {
        if (!gameStarted) {
          console.warn("[WaitingScene] Timeout waiting for opponent! Going back to lobby.");
          this.status.setText("Opponent not found, returning to lobby...");
          this.status.setColor("#ff6b6b");
          this.time.delayedCall(1000, () => {
            this.scene.start("LobbyScene");
          });
        }
      });
      
      // Wait for battleRoom to be ready (it may still be joining)
      this.time.delayedCall(100, () => {
        // Send ready signal to server
        console.log("[WaitingScene] Sending game_ready...");
        net.battleRoom.send("game_ready", { timestamp: Date.now() });
      });
      
      // Wait for both players to be ready before starting
      net.battleRoom.onMessage("game_can_start", (msg) => {
        console.log("[WaitingScene] ✅ Server says game can start!");
        gameStarted = true;
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
