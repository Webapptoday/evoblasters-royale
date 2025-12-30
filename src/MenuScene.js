export class MenuScene extends Phaser.Scene {
  constructor() { super("MenuScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#071226");

    // Create UI elements once
    this.titleText = this.add.text(0, 0, "EVO BLAST ROYALE", {
      fontSize: "44px",
      color: "#ffffff",
      fontStyle: "800"
    }).setOrigin(0.5);

    this.subtitleText = this.add.text(0, 0, "Kids Edition (MVP)", {
      fontSize: "18px",
      color: "#c7d2fe"
    }).setOrigin(0.5);

    this.startBtnRect = this.add.rectangle(0, 0, 320, 70, 0x2563eb, 1)
      .setStrokeStyle(3, 0x93c5fd)
      .setInteractive({ useHandCursor: true });

    this.startBtnText = this.add.text(0, 0, "START GAME", {
      fontSize: "26px",
      color: "#ffffff"
    }).setOrigin(0.5);

    this.helpText = this.add.text(0, 0,
      "Move: WASD/Arrows • Shoot: hold SPACE • Reload: R",
      { fontSize: "16px", color: "#e5e7eb" }
    ).setOrigin(0.5);

    // Center layout helper
    this.layoutMenu = () => {
      const cx = this.cameras.main.centerX;
      const cy = this.cameras.main.centerY;
      this.titleText.setPosition(cx, cy - 140);
      this.subtitleText.setPosition(cx, cy - 90);
      this.startBtnRect.setPosition(cx, cy);
      this.startBtnText.setPosition(cx, cy);
      this.helpText.setPosition(cx, cy + 100);
    };

    // Initial layout + handle future resizes
    this.layoutMenu();
    this.scale.on("resize", this.layoutMenu, this);

    this.startBtnRect.on("pointerdown", () => this.scene.start("LobbyScene"));
  }
}
