import { StartScene } from "./StartScene.js";
import { LobbyScene } from "./LobbyScene.js";
import { WaitingScene } from "./WaitingScene.js";
import { GameScene } from "./GameScene.js";
import { net } from "./net.js";

// ✅ Set global net reference at startup (before Phaser initializes)
window.net = net;

// Debug logging
console.log("[BOOT] window.net set:", !!window.net);
console.log("[BOOT] net keys:", Object.keys(window.net || {}));
console.log("[BOOT] Colyseus available:", typeof Colyseus !== "undefined");

// Connect to network on startup
// DISABLED: net.connect() is now called when START button is clicked
// (async () => {
//   try {
//     let name =
//       localStorage.getItem("playerName") ||
//       `Player${Math.floor(Math.random() * 10000)}`;
//     localStorage.setItem("playerName", name);
//     await net.connect(name || "Player");
//   } catch (error) {
//     console.error("Failed to connect to server:", error);
//     alert("Could not connect to game server. Check console for details.");
//   }
// })();

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#ffffff",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    }
  },
  scene: [StartScene, LobbyScene, WaitingScene, GameScene],
};

new Phaser.Game(config);

