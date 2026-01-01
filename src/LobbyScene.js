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

    this.status = this.add.text(cx, cy - 40, "Waiting for 2 players...", {
      fontFamily: "monospace", fontSize: "18px", color: "#b7c5ff"
    }).setOrigin(0.5);

    this.list = this.add.text(cx, cy + 10, "", {
      fontFamily: "monospace", fontSize: "18px", color: "#ffffff", align: "center"
    }).setOrigin(0.5);

    this.canStart = false; // ✅ LOCK: game cannot start until 2 players confirmed

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
        
        if (net.players.size >= 2 && !this.canStart) {
          console.log("[LobbyScene] ✅ 2+ players detected, unlocking game start...");
          this.canStart = true;
          this.status.setText("Ready! Starting...");
          this.status.setColor("#00ff00");
        }
        
        if (this.canStart) {
          console.log("[LobbyScene] LOCKING SCENE START - requesting server validation");
          this.checkReadyInterval.remove();
          
          // ✅ Request server validation before starting
          if (net.room) {
            net.room.send("start_game", { timestamp: Date.now() });
          }
        }
      }
    });

    // ✅ Listen for server approval/rejection
    if (net.room) {
      net.room.onMessage("game_start", (msg) => {
        console.log("[LobbyScene] Server approved! Starting WaitingScene...");
        this.scene.start("WaitingScene");
      });

      net.room.onMessage("start_blocked", (msg) => {
        console.log("[LobbyScene] Server blocked start:", msg.message);
        this.canStart = false;
        this.status.setText(msg.message);
        this.status.setColor("#ff6666");
        // Resume checking
        this.checkReadyInterval = this.time.addEvent({
          delay: 500,
          loop: true,
          callback: () => {
            if (net.players.size >= 2 && !this.canStart) {
              this.canStart = true;
              this.status.setText("Ready! Starting...");
              this.status.setColor("#00ff00");
            }
          }
        });
      });
    }
  }

  shutdown() {
    if (this.checkReadyInterval) {
      this.checkReadyInterval.remove();
    }
  }
}
