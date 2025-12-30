export class WaitingScene extends Phaser.Scene {
  constructor() { super("WaitingScene"); }

  create() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x050a18, 1).setOrigin(0,0);

    this.add.text(cx, cy - 20, "Waiting in Lobby...", {
      fontFamily: "monospace", fontSize: "46px", color: "#ffffff"
    }).setOrigin(0.5);

    this.add.text(cx, cy + 40, "Loading map...", {
      fontFamily: "monospace", fontSize: "22px", color: "#b7c5ff"
    }).setOrigin(0.5);

    this.time.delayedCall(600, () => this.scene.start("GameScene"));
  }
}
