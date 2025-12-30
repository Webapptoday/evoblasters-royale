import { net } from "./net.js";

export class StartScene extends Phaser.Scene {
  constructor() {
    super("StartScene");
    this._connecting = false;
  }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1)
      .setOrigin(0, 0);

    this.add
      .text(cx, cy - 120, "EVO BLAST ROYALE", {
        fontFamily: "monospace",
        fontSize: "44px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 40, "Enter your name:", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#b7c5ff",
      })
      .setOrigin(0.5);

    // HTML input overlay
    const input = document.createElement("input");
    input.maxLength = 16;
    input.value = "Player";
    input.style.position = "absolute";
    input.style.left = "50%";
    input.style.top = "50%";
    input.style.transform = "translate(-50%, -50%)";
    input.style.fontSize = "18px";
    input.style.padding = "10px 12px";
    input.style.borderRadius = "10px";
    input.style.border = "2px solid #b7c5ff";
    input.style.outline = "none";
    document.body.appendChild(input);

    const btn = this.add
      .text(cx, cy + 80, "START", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: { left: 18, right: 18, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerdown", async () => {
      // Prevent double-click / double-fire
      if (this._connecting) return;
      this._connecting = true;
      btn.disableInteractive();
      btn.setAlpha(0.6);

      const name = input.value.trim() || "Player";
      this.game.playerName = name;
      localStorage.setItem("playerName", name);

      console.log("[StartScene] START clicked, connecting as:", name);

      try {
        await net.connect(name);
        input.remove();
        this.scene.start("LobbyScene");
      } catch (error) {
        console.error("[StartScene] Failed to connect:", error);

        // Re-enable button so user can retry
        this._connecting = false;
        btn.setAlpha(1);
        btn.setInteractive({ useHandCursor: true });

        alert("Could not connect to game server. Check console for details.");
      }
    });

    this.events.once("shutdown", () => {
      if (input && input.parentNode) input.remove();
    });
  }
}
