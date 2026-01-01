import { getWeaponByLevel } from "./WeaponSystem.js";
import { net } from "./net.js";

const WORLD_W = 2600;
const WORLD_H = 1800;

const SHRINK_START_SECONDS = 20;
const SHRINK_DURATION_SECONDS = 15;
const START_SAFE_RADIUS = 900;
const END_SAFE_RADIUS = 320;

const OUTSIDE_DAMAGE_PER_SEC = 4;
const STARTING_HP = 100;

const CHEST_COUNT = 10;
const CHEST_INTERACT_DIST = 70;

const POTION_HEAL = 20;
// --- Inventory constants ---
const INV_SLOTS = 5;
const INV_SLOT_SIZE = 54;
const INV_BOTTOM_PADDING = 10;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    // Assets are next to index.html (project root)
    this.load.image("bullet", "bullet.png");
    this.load.image("chest", "treasure.png");
    this.load.image("potion", "potion.png");

    // gun icon for inventory - TODO: add basicblaster.png to root
    // this.load.image("gunIcon", "basicblaster.png");

    // Log any loader errors to the console for quick diagnosis
    this.load.on("loaderror", (file) => {
      console.error("LOAD ERROR:", file.key, file.src);
    });
  }

  create() {
    // --- keyboard capture ---
    this.input.keyboard.enabled = true;
    this.input.keyboard.clearCaptures();
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.F,
      Phaser.Input.Keyboard.KeyCodes.R,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);

    // World bounds
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // White map background
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0xffffff, 1).setDepth(-10);
    this.drawGrid();

    // Keys
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keySPACE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

    // Bullet group
    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image });

    // Player
    this.player = this.physics.add.image(WORLD_W / 2, WORLD_H / 2, this.makeCircleTexture(0x6ee7ff));
    this.player.setCircle(16);
    this.player.setCollideWorldBounds(true);

    // --- Aim system (reliable) ---
    this.aim = { x: this.player.x + 200, y: this.player.y }; // default aim right

    this.input.on("pointermove", (p) => {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.aim.x = wp.x;
      this.aim.y = wp.y;
    });

    // Also update aim when you click (helps if you don't move mouse)
    this.input.on("pointerdown", (p) => {
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.aim.x = wp.x;
      this.aim.y = wp.y;
    });

    // Stats
    this.player.maxHp = STARTING_HP;
    this.player.hp = STARTING_HP;

    this.player.weapon = getWeaponByLevel(1); // Basic blaster (10 dmg)
    this.player.ammo = this.player.weapon.magSize;
    this.player.reloading = false;
    this.player.reloadEndsAt = 0;
    this.player.lastShotAt = 0;

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.10, 0.10);

    // Health bar
    this.hpBar = this.add.graphics().setDepth(999);

    // ---------- Network/Remote Players ----------
    this.remoteSprites = new Map();
    this.myId = null;

    // Update remote player positions every 50ms
    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!net.room) return;
        this.myId = net.sessionId;

        // ✅ one-time snap to server spawn position
        if (!this._snappedToServer && net.players.has(net.sessionId)) {
          const me = net.players.get(net.sessionId);
          this.player.x = me.x;
          this.player.y = me.y;
          this._snappedToServer = true;
        }

        // Create/update sprites for every player in state
        for (const [id, p] of net.players.entries()) {
          if (net.sessionId && id === net.sessionId) continue; // ✅ don't create a remote sprite for yourself
          let spr = this.remoteSprites.get(id);
          if (!spr) {
            // Create sprite for remote player (use same color as other players in your game)
            spr = this.physics.add.image(p.x, p.y, this.makeCircleTexture(0xff6e6e));
            spr.setCircle(16);
            spr.body.allowGravity = false;
            spr.setImmovable(true);
            spr.setDepth(2);
            this.remoteSprites.set(id, spr);
          }
          spr.x = p.x;
          spr.y = p.y;
        }

        // Remove sprites for players who left
        for (const [id, spr] of this.remoteSprites.entries()) {
          if (!net.players.has(id)) {
            spr.destroy();
            this.remoteSprites.delete(id);
          }
        }
      }
    });

    // ✅ Listen for shots (spawn bullets for EVERYONE + show hits)
    this._wiredShots = false;

    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this._wiredShots) return;
        if (!net.room) return;

        this._wiredShots = true;
        console.log("[GameScene] Wiring shot listener...");

        net.room.onMessage("shot", (msg) => {
          console.log("[GameScene] Received shot event:", msg);
          const dir = new Phaser.Math.Vector2(msg.dx, msg.dy).normalize();

          // Spawn bullet visuals for everyone (including you)
          const b = this.fireBullet(msg.x, msg.y, dir, this.player.weapon);

          // If server says it hit someone, end bullet early (visual)
          if (msg.hitId && b) {
            this.time.delayedCall(60, () => {
              if (b && b.active) b.destroy();
            });

            // flash the hit player if we have their sprite
            const targetSpr = this.remoteSprites.get(msg.hitId);
            if (targetSpr) {
              targetSpr.setAlpha(0.3);
              this.time.delayedCall(80, () => targetSpr.setAlpha(1));
            }
          }
        });
      }
    });

    // Safe zone
    this.safeCenter = new Phaser.Math.Vector2(WORLD_W / 2, WORLD_H / 2);
    this.safeRadius = START_SAFE_RADIUS;
    this.safeGfx = this.add.graphics().setDepth(5);

    // Timers
    this.matchStartTime = this.time.now;
    this.shrinkStartsAt = this.matchStartTime + SHRINK_START_SECONDS * 1000;
    this.shrinkEndsAt = this.shrinkStartsAt + SHRINK_DURATION_SECONDS * 1000;

    // ---------- Inventory ----------
    // Keep it simple: 1 gun upgrade slot + potion count
    this.inventory = {
      hasGunUpgrade: false, // “Rapid Blaster” (12 dmg)
      potions: 0
    };

    // ---------- Chests ----------
    // Use a deterministic RNG so all clients see the same map
    this.rng = new Phaser.Math.RandomDataGenerator(["evo-blast-royale-match"]);
    this.chests = [];

    for (let i = 0; i < CHEST_COUNT; i++) {
      const x = this.rng.between(120, WORLD_W - 120);
      const y = this.rng.between(120, WORLD_H - 120);

      const chest = this.physics.add.image(x, y, "chest");
      chest.setImmovable(true);
      chest.body.allowGravity = false;
      chest.setDepth(2);

      // scale if your PNG is huge
      chest.setScale(0.16);

      // Random loot: either gun upgrade or potion (or both sometimes)
      const roll = this.rng.between(1, 100);
      chest.loot = {
        gunUpgrade: (roll <= 45),        // 45% chance
        potion: (roll > 45 && roll <= 95) // 50% chance
      };
      // 5% chance: both (rare)
      if (roll > 95) chest.loot = { gunUpgrade: true, potion: true };

      chest.opened = false;

      this.chests.push(chest);
    }

    // ---------- UI ----------
    this.uiPanel = this.add.rectangle(0, 0, 260, 190, 0x000000, 0.45)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.uiText = this.add.text(0, 0, "", { fontSize: "16px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(1001);

    // On-screen prompt messages
    this.promptText = this.add.text(500, 540, "", {
      fontSize: "18px",
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.55)",
      padding: { left: 10, right: 10, top: 6, bottom: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
    this.promptText.setVisible(false);

    // --- Inventory: 5 empty boxes (no text) ---
    this.inventory = { potions: 0 };

    this.invGfx = this.add.graphics().setScrollFactor(0).setDepth(1500);

    // slot positions
    this.invSlots = [];
    this.invPotionIcons = []; // images shown inside slots

    const totalW = INV_SLOTS * INV_SLOT_SIZE + (INV_SLOTS - 1) * 10;
    const centerX = this.scale.width / 2;
    let startX = centerX - totalW / 2;

    // NEW: compute Y from the current screen height
    this.invY = this.scale.height - INV_SLOT_SIZE - INV_BOTTOM_PADDING;

    for (let i = 0; i < INV_SLOTS; i++) {
      const x = startX + i * (INV_SLOT_SIZE + 10);
      this.invSlots.push({ x, y: this.invY });

      // create hidden potion icon per slot (turn on when filled)
      const icon = this.add.image(
        x + INV_SLOT_SIZE / 2,
        this.invY + INV_SLOT_SIZE / 2,
        "potion"
      )
        .setScrollFactor(0)
        .setDepth(1501)
        .setVisible(false);

      // fit icon nicely inside slot
      icon.setDisplaySize(INV_SLOT_SIZE * 0.75, INV_SLOT_SIZE * 0.75);

      this.invPotionIcons.push(icon);
    }

    // draw slots once
    this.updateInventoryUI();

    // Which inventory slot is selected (0-4). -1 = none
    this.selectedPotionSlot = -1;

    // Click to select a potion slot
    this.input.on("pointerdown", (p) => {
      const x = p.x;
      const y = p.y;

      for (let i = 0; i < this.invSlots.length; i++) {
        const s = this.invSlots[i];
        const left = s.x;
        const top = s.y;
        const right = s.x + INV_SLOT_SIZE;
        const bottom = s.y + INV_SLOT_SIZE;

        if (x >= left && x <= right && y >= top && y <= bottom) {
          if (i < this.inventory.potions) {
            this.selectedPotionSlot = i;
          } else {
            this.selectedPotionSlot = -1;
          }
          this.updateInventoryUI();
          return;
        }
      }
    });

    // track drops on the ground
    this.lootDrops = [];

    // Shooting: SPACE fires (hold)
    this.input.keyboard.on("keydown-SPACE", () => this.tryFireBullet(this.time.now));

    // E = interact / equip
    this.input.keyboard.on("keydown-E", () => this.handleEPress());

    // F = use potion
    this.input.keyboard.on("keydown-F", () => this.usePotion());

    // R = reload
    this.input.keyboard.on("keydown-R", () => this.tryReload(this.time.now));

    // (debug text removed per request)

    // Position HUD top-right initially
    this.positionHud();

    // Keep inventory at bottom on resize
    this.scale.on("resize", () => {
      this.invY = this.scale.height - INV_SLOT_SIZE - INV_BOTTOM_PADDING;

      // recompute horizontal center for slots
      const totalW = INV_SLOTS * INV_SLOT_SIZE + (INV_SLOTS - 1) * 10;
      const centerX = this.scale.width / 2;
      const startX = centerX - totalW / 2;

      for (let i = 0; i < this.invSlots.length; i++) {
        const x = startX + i * (INV_SLOT_SIZE + 10);
        this.invSlots[i].x = x;
        this.invSlots[i].y = this.invY;
        this.invPotionIcons[i].x = x + INV_SLOT_SIZE / 2;
        this.invPotionIcons[i].y = this.invY + INV_SLOT_SIZE / 2;
      }

      this.updateInventoryUI();

      // Reposition HUD on resize
      this.positionHud();
    });

    this.gameOver = false;
  }

  update(time, delta) {
    if (this.gameOver) return;

    this.updateMovement();
    this.updateReload(time);

    // Hold SPACE for continuous fire
    if (this.keySPACE.isDown) {
      this.tryFireBullet(time);
    }

    this.updateSafeZone(time);
    this.applyZoneDamage(delta);

    this.drawSafeZone();
    this.drawHealthBar();
    this.updateUI(time);
    this.updateChestPrompt();

    this.cleanupBullets();

    // Send movement via Colyseus network
    if (net.room) {
      if (!this._lastNetMove || time - this._lastNetMove > 50) {
        this._lastNetMove = time;
        net.sendMove(this.player.x, this.player.y);
      }
    }

    if (this.player.hp <= 0) {
      // If the server eliminated us (by another player), don't end the game; we will respawn.
      if (!this.elimCause) {
        this.endGame("You were eliminated by the storm (MVP)");
      }
    }
  }

  // ---------- Movement ----------
  updateMovement() {
    const speed = 240;
    let vx = 0, vy = 0;

    const up = this.cursors.up.isDown || this.keyW.isDown;
    const down = this.cursors.down.isDown || this.keyS.isDown;
    const left = this.cursors.left.isDown || this.keyA.isDown;
    const right = this.cursors.right.isDown || this.keyD.isDown;

    if (up) vy -= 1;
    if (down) vy += 1;
    if (left) vx -= 1;
    if (right) vx += 1;

    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 0) v.normalize().scale(speed);

    this.player.setVelocity(v.x, v.y);
  }

  // ---------- Aim helper ----------
  getAimDirection() {
    const dx = this.aim.x - this.player.x;
    const dy = this.aim.y - this.player.y;

    // If aim somehow matches player position, aim right
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
      return new Phaser.Math.Vector2(1, 0);
    }

    const dir = new Phaser.Math.Vector2(dx, dy);
    if (dir.lengthSq() < 0.0001) return new Phaser.Math.Vector2(1, 0);
    return dir.normalize();
  }

  // ---------- Reload ----------
  updateReload(time) {
    if (this.player.reloading && time >= this.player.reloadEndsAt) {
      this.player.reloading = false;
      this.player.ammo = this.player.weapon.magSize;
    }
  }

  tryReload(time) {
    if (this.player.reloading) return;
    if (this.player.ammo === this.player.weapon.magSize) return;
    this.player.reloading = true;
    this.player.reloadEndsAt = time + this.player.weapon.reloadMs;
  }

  // ---------- Shooting ----------
  tryFireBullet(time) {
    if (this.player.reloading) return;

    const w = this.player.weapon;
    if (time - this.player.lastShotAt < w.fireRateMs) return;

    if (this.player.ammo <= 0) {
      this.tryReload(time);
      return;
    }

    this.player.lastShotAt = time;
    this.player.ammo -= 1;

    const dir = this.getAimDirection();

    // Spawn position slightly in front of player
    const muzzle = 26;
    const sx = this.player.x + dir.x * muzzle;
    const sy = this.player.y + dir.y * muzzle;

    // Send to server (server will broadcast "shot" event for all clients)
    if (net.room) {
      console.log("[tryFireBullet] Sending shoot to server:", { sx, sy, dx: dir.x, dy: dir.y });
      net.room.send("shoot", { x: sx, y: sy, dx: dir.x, dy: dir.y });
    } else {
      console.warn("[tryFireBullet] net.room not ready");
    }
  }

  fireBullet(x, y, dir, weapon) {
    const fallbackKey = "fallback_bullet";
    if (!this.textures.exists(fallbackKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 6);
      g.generateTexture(fallbackKey, 16, 16);
      g.destroy();
    }

    const tex = this.textures.get("bullet");
    const hasRealBullet =
      tex &&
      tex.getSourceImage &&
      tex.getSourceImage() &&
      tex.getSourceImage().width > 0;

    const keyToUse = hasRealBullet ? "bullet" : fallbackKey;

    const b = this.physics.add.image(x, y, keyToUse);
    b.setDepth(20);
    b.body.allowGravity = false;

    b.setDisplaySize(14, 14);
    b.body.setSize(10, 10, true);
    b.setAlpha(1);
    b.setTint(0xffff00);

    const speed = weapon.bulletSpeed;
    b.setVelocity(dir.x * speed, dir.y * speed);

    this.time.delayedCall(0, () => {
      if (b && b.active) b.setVelocity(dir.x * speed, dir.y * speed);
    });

    this.bullets.add(b);

    this.time.delayedCall(1200, () => {
      if (b && b.active) b.destroy();
    });

    return b; // ✅ critical
  }

  // ---- Multiplayer helpers ----
  spawnOtherPlayer(id, name, x, y, hp = 100) {
    const s = this.physics.add.image(x, y, this.makeCircleTexture(0xff6e6e));
    s.setCircle(16);
    s.body.allowGravity = false;
    s.setImmovable(true);
    s.setDepth(2);
    this.otherPlayers[id] = s;
    this.otherHp[id] = hp;

    const tag = this.add.text(x, y - 34, name || "Player", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.35)",
      padding: { left: 6, right: 6, top: 2, bottom: 2 }
    }).setOrigin(0.5).setDepth(2000);

    this.nameTags[id] = tag;

    // Simple HP bar above the other player
    const bar = this.add.graphics().setDepth(2001);
    this.otherHpBars[id] = bar;
    this.updateOtherHpBar(id);
  }

  cleanupBullets() {
    this.bullets.getChildren().forEach(b => {
      if (!b.active) return;
      const out = (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H);
      if (out) b.destroy();
    });
  }

  updateOtherHpBar(id) {
    const s = this.otherPlayers[id];
    const hp = this.otherHp[id];
    const bar = this.otherHpBars[id];
    if (!s || !bar || typeof hp !== "number") return;

    const pct = Phaser.Math.Clamp(hp / 100, 0, 1);
    const barW = 42, barH = 6;
    const x = s.x - barW / 2;
    const y = s.y - 46; // slightly above name tag

    bar.clear();
    bar.fillStyle(0x000000, 0.6);
    bar.fillRoundedRect(x, y, barW, barH, 3);
    bar.fillStyle(0x34d399, 1);
    bar.fillRoundedRect(x + 1, y + 1, (barW - 2) * pct, barH - 2, 3);
  }

  // ---------- Chests / Interaction ----------
  getNearestChest() {
    let best = null;
    let bestD = CHEST_INTERACT_DIST;

    for (const c of this.chests) {
      if (!c.active || c.opened) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  updateChestPrompt() {
    const chest = this.getNearestChest();

    // If a chest is near, show prompt based on loot
    if (chest) {
      const lines = [];
      if (chest.loot.gunUpgrade && this.player.weapon.level < 2) {
        lines.push("Chest: Damage Boost found!");
        lines.push("Increase bullet damage from 10 to 12!");
        lines.push("Press E to upgrade.");
      } else if (chest.loot.gunUpgrade && this.player.weapon.level >= 2) {
        lines.push("Chest: Damage Boost found (you already have it).");
        lines.push("Press E to loot other items.");
      }

      if (chest.loot.potion) {
        lines.push("Shield Potion found (+20 HP). Press E to pick up.");
      }

      if (lines.length === 0) {
        lines.push("Chest is empty (MVP).");
      }

      this.showPrompt(lines.join("\n"));
    } else {
      this.hidePrompt();
    }
  }

  handleEPress() {
    // If a potion is selected, use it on E
    if (this.selectedPotionSlot >= 0 && this.selectedPotionSlot < this.inventory.potions) {
      this.useSelectedPotion();
      return;
    }
    // Priority 0: pickup potion drop if near
    let nearestDrop = null;
    let bestD = CHEST_INTERACT_DIST;
    for (const d of this.lootDrops) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y);
      if (dist < bestD) { bestD = dist; nearestDrop = d; }
    }
    if (nearestDrop && nearestDrop.dropType === "potion") {
      const added = this.addPotionToInventory();
      if (added) {
        nearestDrop.destroy();
        this.lootDrops = this.lootDrops.filter(x => x !== nearestDrop);
      }
      return;
    }

    // Priority 1: chest interaction if near
    const chest = this.getNearestChest();
    if (chest) {
      this.openChest(chest);
      return;
    }

    // Priority 2: equip gun upgrade from inventory (disabled by new inventory model)
  }

  openChest(chest) {
    if (chest.opened) return;
    chest.opened = true;

    const cx = chest.x;
    const cy = chest.y;

    // remove chest
    chest.destroy();

    // spawn loot based on chest contents
    if (chest.loot.gunUpgrade) {
      // Apply damage upgrade directly
      this.equipGunUpgrade();
    }

    if (chest.loot.potion) {
      // spawn potion on the map
      const drop = this.physics.add.image(cx, cy, "potion");
      drop.setDepth(3);
      drop.body.allowGravity = false;
      drop.setDisplaySize(40, 40);
      drop.dropType = "potion";
      this.lootDrops.push(drop);
    }
  }

  equipGunUpgrade() {
    // Equip Rapid Blaster (level 2, 12 dmg)
    this.player.weapon = getWeaponByLevel(2);
    this.player.ammo = this.player.weapon.magSize;
    this.player.reloading = false;

    // Keep it in inventory or consume it — your choice.
    // Fortnite-style = consume upgrade:
    this.inventory.hasGunUpgrade = false;

    this.showPrompt("Upgraded! Rapid Blaster equipped.\n12 damage per bullet!");
  }

  usePotion() {
    if (this.inventory.potions <= 0) return;
    if (this.player.hp >= this.player.maxHp) return;

    this.inventory.potions -= 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + POTION_HEAL);

    this.updateInventoryUI();
  }

  showPrompt(text) {
    this.promptText.setText(text);
    this.promptText.setVisible(true);

    // auto-hide after a bit (unless player stays near chest; prompt may re-show)
    if (this.promptTimer) this.promptTimer.remove(false);
    this.promptTimer = this.time.delayedCall(1800, () => {
      // only hide if not currently near a chest
      if (!this.getNearestChest()) this.hidePrompt();
    });
  }

  hidePrompt() {
    this.promptText.setVisible(false);
  }

  getPlayerNameById(id) {
    if (!id) return null;
    const tag = this.nameTags[id];
    if (tag && typeof tag.text === "string" && tag.text.length) return tag.text;
    return null;
  }

  // ---------- Inventory UI ----------
  updateInventoryUI() {
    this.invGfx.clear();

    // draw 5 empty slot boxes
    this.invGfx.fillStyle(0x000000, 0.35);
    this.invGfx.lineStyle(2, 0xffffff, 0.35);

    for (let i = 0; i < INV_SLOTS; i++) {
      const s = this.invSlots[i];
      this.invGfx.fillRoundedRect(s.x, s.y, INV_SLOT_SIZE, INV_SLOT_SIZE, 10);
      this.invGfx.strokeRoundedRect(s.x, s.y, INV_SLOT_SIZE, INV_SLOT_SIZE, 10);
    }

    // Draw selection highlight (if a valid slot is selected)
    if (this.selectedPotionSlot >= 0 && this.selectedPotionSlot < this.inventory.potions) {
      const s = this.invSlots[this.selectedPotionSlot];
      this.invGfx.lineStyle(3, 0xffff00, 0.95);
      this.invGfx.strokeRoundedRect(s.x - 2, s.y - 2, INV_SLOT_SIZE + 4, INV_SLOT_SIZE + 4, 12);
    }

    // show potion icons based on count
    for (let i = 0; i < INV_SLOTS; i++) {
      this.invPotionIcons[i].setVisible(i < this.inventory.potions);
    }
  }

  addPotionToInventory() {
    if (this.inventory.potions >= INV_SLOTS) {
      // inventory full; ignore pickup
      return false;
    }
    this.inventory.potions += 1;
    // auto-select the newest potion
    this.selectedPotionSlot = this.inventory.potions - 1;
    this.updateInventoryUI();
    return true;
  }

  useSelectedPotion() {
    if (this.inventory.potions <= 0) return;
    if (this.player.hp >= this.player.maxHp) return;

    // Consume one potion
    this.inventory.potions -= 1;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + POTION_HEAL);

    // Adjust selection
    if (this.inventory.potions === 0) {
      this.selectedPotionSlot = -1;
    } else if (this.selectedPotionSlot >= this.inventory.potions) {
      this.selectedPotionSlot = this.inventory.potions - 1;
    }

    this.updateInventoryUI();
  }

  // ---------- Safe Zone ----------
  updateSafeZone(time) {
    if (time < this.shrinkStartsAt) return;

    if (time <= this.shrinkEndsAt) {
      const t = (time - this.shrinkStartsAt) / (this.shrinkEndsAt - this.shrinkStartsAt);
      this.safeRadius = Phaser.Math.Linear(START_SAFE_RADIUS, END_SAFE_RADIUS, Phaser.Math.Clamp(t, 0, 1));
    } else {
      this.safeRadius = END_SAFE_RADIUS;
    }
  }

  applyZoneDamage(delta) {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.safeCenter.x, this.safeCenter.y);
    const outside = dist > this.safeRadius;

    if (outside) {
      const dtSec = delta / 1000;
      this.player.hp -= OUTSIDE_DAMAGE_PER_SEC * dtSec;
      if (this.player.hp < 0) this.player.hp = 0;
    }
  }

  drawSafeZone() {
    this.safeGfx.clear();
    this.safeGfx.lineStyle(6, 0x1f6feb, 0.9);
    this.safeGfx.strokeCircle(this.safeCenter.x, this.safeCenter.y, this.safeRadius);
  }

  // ---------- Health Bar ----------
  drawHealthBar() {
    this.hpBar.clear();

    const barW = 48, barH = 8;
    const x = this.player.x - barW / 2;
    const y = this.player.y - 36;

    const pct = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);

    this.hpBar.fillStyle(0x000000, 0.60);
    this.hpBar.fillRoundedRect(x, y, barW, barH, 3);

    this.hpBar.fillStyle(0x34d399, 1);
    this.hpBar.fillRoundedRect(x + 1, y + 1, (barW - 2) * pct, barH - 2, 3);
  }

  // ---------- UI ----------
  updateUI(time) {
    const w = this.player.weapon;

    let mapText = "";
    if (time < this.shrinkStartsAt) {
      const s = Math.ceil((this.shrinkStartsAt - time) / 1000);
      mapText = `Map closing in: ${s}s`;
    } else if (time <= this.shrinkEndsAt) {
      const s = Math.ceil((this.shrinkEndsAt - time) / 1000);
      mapText = `Map shrinking: ${s}s`;
    } else {
      mapText = `Map closed`;
    }

    const reloadText = this.player.reloading
      ? `Reloading: ${Math.max(0, Math.ceil((this.player.reloadEndsAt - time) / 1000))}s`
      : "";

    this.uiText.setText(
      `${mapText}\n` +
      `HP: ${Math.ceil(this.player.hp)}/${this.player.maxHp}\n` +
      `Gun: ${w.name} (${w.damage} dmg)\n` +
      `Ammo: ${this.player.ammo}/${w.magSize} ${reloadText}\n` +
      `SPACE: shoot • E: interact/equip • F: potion`
    );
  }

  // Top-right HUD positioning helper
  positionHud() {
    const pad = 12;
    const panelX = this.scale.width - pad;
    const panelY = pad;

    this.uiPanel.setPosition(panelX, panelY);

    // Place text inside panel with padding (top-left of panel)
    const textX = panelX - this.uiPanel.width + pad;
    const textY = panelY + pad;
    this.uiText.setPosition(textX, textY);
  }

  endGame(message) {
    this.gameOver = true;
    this.player.setVelocity(0, 0);

    this.add.rectangle(500, 300, 620, 220, 0x000000, 0.7)
      .setScrollFactor(0).setDepth(2000);

    this.add.text(500, 300, `${message}\n\nRefresh to play again (MVP)`, {
      fontSize: "22px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2001);
  }

  // ---------- Helpers ----------
  makeCircleTexture(tint) {
    const key = `circle_${tint.toString(16)}`;
    if (this.textures.exists(key)) return key;

    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(tint, 1);
    g.fillCircle(16, 16, 16);
    g.lineStyle(3, 0x04203f, 1);
    g.strokeCircle(16, 16, 16);
    g.generateTexture(key, 32, 32);
    g.destroy();
    return key;
  }

  drawGrid() {
    const g = this.add.graphics().setDepth(-9);
    g.lineStyle(1, 0x1f6feb, 0.12);
    const step = 100;

    for (let x = 0; x <= WORLD_W; x += step) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WORLD_H); g.strokePath();
    }
    for (let y = 0; y <= WORLD_H; y += step) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(WORLD_W, y); g.strokePath();
    }
  }
}
