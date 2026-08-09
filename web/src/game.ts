import Phaser from "phaser";

// ─── Virtual canvas ────────────────────────────────────────────────────────────
const VW = 420;
const VH = 680;

// ─── Candy definitions ─────────────────────────────────────────────────────────
interface CandyDef {
  color: number;
  outline: number;
  points: number;
  radius: number;
  label: string;
}

const CANDIES: CandyDef[] = [
  { color: 0xff4d6d, outline: 0xc9184a, points: 1, radius: 14, label: "🍬" },
  { color: 0xff9f1c, outline: 0xe07b00, points: 2, radius: 13, label: "🍭" },
  { color: 0x2ec4b6, outline: 0x1a8a82, points: 3, radius: 12, label: "🍡" },
  { color: 0xffd60a, outline: 0xc9a600, points: 2, radius: 13, label: "⭐" },
  { color: 0xa855f7, outline: 0x7e22ce, points: 4, radius: 11, label: "💜" },
  { color: 0xf472b6, outline: 0xbe185d, points: 1, radius: 15, label: "🌸" },
];

// Bomb — lose a life if caught
const BOMB_COLOR = 0x1e293b;
const BOMB_OUTLINE = 0x0f172a;

// ─── Colour palette ────────────────────────────────────────────────────────────
const BG_TOP = 0x1a0533;
const BG_BOT = 0x3b0764;
const BASKET_COLOR = 0xffd60a;
const BASKET_OUTLINE = 0xb45309;
const STRIPE_COLOR = 0xff4d6d;

// ─── Level thresholds ──────────────────────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 10, 25, 45, 70, 100, 140, 190];

function levelFromScore(score: number): number {
  let lv = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= (LEVEL_THRESHOLDS[i] ?? 9999)) lv = i + 1;
  }
  return lv;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function spawnDelay(level: number): number {
  return Math.max(350, 900 - level * 70);
}
function dropSpeed(level: number): number {
  return Math.min(420, 130 + level * 38);
}
function bombChance(level: number): number {
  return Math.min(0.18, 0.04 + level * 0.02);
}

// ─── Particle burst (pure Phaser graphics, no asset needed) ───────────────────
function burstAt(scene: Phaser.Scene, x: number, y: number, color: number): void {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = Phaser.Math.Between(22, 48);
    const dot = scene.add.circle(x, y, Phaser.Math.Between(3, 6), color, 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 380,
      ease: "Quad.easeOut",
      onComplete: () => dot.destroy(),
    });
  }
}

function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  msg: string,
  color: string,
): void {
  const t = scene.add
    .text(x, y, msg, {
      fontFamily: "Fraunces, serif",
      fontSize: "22px",
      color,
      stroke: "#000",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(20);
  scene.tweens.add({
    targets: t,
    y: y - 55,
    alpha: 0,
    duration: 700,
    ease: "Quad.easeOut",
    onComplete: () => t.destroy(),
  });
}

// ─── Candy drop object ─────────────────────────────────────────────────────────
interface DropObject extends Phaser.GameObjects.Container {
  isBomb: boolean;
  points: number;
  candyColor: number;
}

// ─── Menu Scene ────────────────────────────────────────────────────────────────
class MenuScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;
  private readonly getHigh: () => number;

  constructor(onScore: (n: number) => void, getHigh: () => number) {
    super("menu");
    this.onScore = onScore;
    this.getHigh = getHigh;
  }

  create(): void {
    this.onScore(0);

    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(BG_TOP, BG_TOP, BG_BOT, BG_BOT, 1);
    bg.fillRect(0, 0, VW, VH);

    // Floating candy decorations
    this.spawnDecorations();

    // Title
    this.add
      .text(VW / 2, 130, "🍭", { fontSize: "64px" })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(VW / 2, 200, "Candy Store", {
        fontFamily: "Fraunces, serif",
        fontSize: "42px",
        color: "#ffd60a",
        stroke: "#7e22ce",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(VW / 2, 248, "2", {
        fontFamily: "Fraunces, serif",
        fontSize: "56px",
        color: "#ff4d6d",
        stroke: "#7e22ce",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);

    // High score
    const high = this.getHigh();
    if (high > 0) {
      this.add
        .text(VW / 2, 305, `🏆 Best: ${high}`, {
          fontFamily: "Manrope, sans-serif",
          fontSize: "20px",
          color: "#ffd60a",
        })
        .setOrigin(0.5)
        .setDepth(5);
    }

    // Play button
    const btn = this.add.graphics().setDepth(5);
    const btnX = VW / 2 - 90;
    const btnY = 360;
    const btnW = 180;
    const btnH = 58;
    btn.fillStyle(0xff4d6d, 1);
    btn.fillRoundedRect(btnX, btnY, btnW, btnH, 29);
    btn.lineStyle(4, 0xffd60a, 1);
    btn.strokeRoundedRect(btnX, btnY, btnW, btnH, 29);

    this.add
      .text(VW / 2, btnY + btnH / 2, "▶  PLAY", {
        fontFamily: "Fraunces, serif",
        fontSize: "26px",
        color: "#fff",
        stroke: "#c9184a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Tap anywhere hint
    this.add
      .text(VW / 2, 450, "Catch the candy — dodge the bombs!", {
        fontFamily: "Manrope, sans-serif",
        fontSize: "15px",
        color: "#c4b5fd",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // How-to icons
    const icons = [
      { x: VW / 2 - 90, icon: "🍬", label: "1 pt" },
      { x: VW / 2 - 30, icon: "🍭", label: "2 pts" },
      { x: VW / 2 + 30, icon: "💜", label: "4 pts" },
      { x: VW / 2 + 90, icon: "💣", label: "-1 ❤️" },
    ];
    icons.forEach(({ x, icon, label }) => {
      this.add
        .text(x, 500, icon, { fontSize: "26px" })
        .setOrigin(0.5)
        .setDepth(5);
      this.add
        .text(x, 530, label, {
          fontFamily: "Manrope, sans-serif",
          fontSize: "12px",
          color: "#e9d5ff",
        })
        .setOrigin(0.5)
        .setDepth(5);
    });

    // Tap to start
    this.input.once("pointerdown", () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("play");
      });
    });
    this.input.keyboard?.once("keydown-SPACE", () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("play");
      });
    });
  }

  private spawnDecorations(): void {
    const emojis = ["🍬", "🍭", "🍡", "⭐", "🌸", "💜"];
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(20, VW - 20);
      const y = Phaser.Math.Between(0, VH);
      const em = Phaser.Utils.Array.GetRandom(emojis) as string;
      const t = this.add
        .text(x, y, em, { fontSize: `${Phaser.Math.Between(18, 32)}px`, alpha: 0.25 })
        .setOrigin(0.5)
        .setDepth(1);
      this.tweens.add({
        targets: t,
        y: y - Phaser.Math.Between(60, 120),
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        ease: "Sine.easeInOut",
      });
    }
  }
}

// ─── Play Scene ────────────────────────────────────────────────────────────────
class PlayScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;
  private readonly onHigh: (n: number) => void;
  private readonly getHigh: () => number;

  private score = 0;
  private lives = 3;
  private level = 1;
  private combo = 0;
  private over = false;

  private basket!: Phaser.GameObjects.Container;
  private basketBody!: Phaser.GameObjects.Rectangle;
  private drops!: Phaser.Physics.Arcade.Group;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private spawnTimer?: Phaser.Time.TimerEvent;

  private scoreTxt!: Phaser.GameObjects.Text;
  private livesTxt!: Phaser.GameObjects.Text;
  private levelTxt!: Phaser.GameObjects.Text;
  private levelBanner!: Phaser.GameObjects.Container;

  private pointerX = VW / 2;
  private basketSpeed = 7;

  constructor(
    onScore: (n: number) => void,
    onHigh: (n: number) => void,
    getHigh: () => number,
  ) {
    super("play");
    this.onScore = onScore;
    this.onHigh = onHigh;
    this.getHigh = getHigh;
  }

  create(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.combo = 0;
    this.over = false;
    this.pointerX = VW / 2;
    this.onScore(0);

    // ── Background ──
    const bg = this.add.graphics();
    bg.fillGradientStyle(BG_TOP, BG_TOP, BG_BOT, BG_BOT, 1);
    bg.fillRect(0, 0, VW, VH);

    // Twinkling stars
    for (let i = 0; i < 30; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, VW),
        Phaser.Math.Between(0, VH * 0.7),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.8),
      );
      this.tweens.add({
        targets: star,
        alpha: Phaser.Math.FloatBetween(0.05, 0.3),
        duration: Phaser.Math.Between(800, 2400),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // ── HUD strip ──
    const hud = this.add.graphics().setDepth(10);
    hud.fillStyle(0x000000, 0.35);
    hud.fillRoundedRect(8, 8, VW - 16, 44, 12);

    this.scoreTxt = this.add
      .text(16, 30, "Score: 0", {
        fontFamily: "Manrope, sans-serif",
        fontSize: "17px",
        color: "#ffd60a",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.livesTxt = this.add
      .text(VW / 2, 30, "❤️❤️❤️", {
        fontFamily: "Manrope, sans-serif",
        fontSize: "17px",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(11);

    this.levelTxt = this.add
      .text(VW - 16, 30, "Lv 1", {
        fontFamily: "Manrope, sans-serif",
        fontSize: "17px",
        color: "#c4b5fd",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5)
      .setDepth(11);

    // ── Basket ──
    // Visual: rounded rect body + stripe
    const basketGfx = this.add.graphics();
    basketGfx.fillStyle(BASKET_COLOR, 1);
    basketGfx.fillRoundedRect(-44, -14, 88, 28, 10);
    basketGfx.lineStyle(3, BASKET_OUTLINE, 1);
    basketGfx.strokeRoundedRect(-44, -14, 88, 28, 10);
    // Candy stripe
    basketGfx.fillStyle(STRIPE_COLOR, 0.7);
    basketGfx.fillRoundedRect(-44, -5, 88, 10, 4);

    // Invisible physics hitbox
    this.basketBody = this.add.rectangle(0, 0, 88, 28, 0xffffff, 0);
    this.physics.add.existing(this.basketBody);
    const bBody = this.basketBody.body as Phaser.Physics.Arcade.Body;
    bBody.setImmovable(true);
    bBody.setAllowGravity(false);

    this.basket = this.add.container(VW / 2, VH - 52, [basketGfx, this.basketBody]);
    this.basket.setDepth(8);

    // Pointer tracking
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.pointerX = Phaser.Math.Clamp(p.x, 46, VW - 46);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerX = Phaser.Math.Clamp(p.x, 46, VW - 46);
    });

    this.cursors = this.input.keyboard?.createCursorKeys();

    // ── Drop group ──
    this.drops = this.physics.add.group();

    // Overlap: basket vs drops
    this.physics.add.overlap(this.basketBody, this.drops, (_bkt, dropObj) => {
      const drop = dropObj as unknown as DropObject;
      if (!drop.active) return;
      this.catchDrop(drop);
    });

    // ── Spawn timer ──
    this.resetSpawnTimer();

    // ── Level banner (hidden initially) ──
    this.levelBanner = this.add.container(VW / 2, VH / 2).setDepth(30).setAlpha(0);
    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(0x000000, 0.7);
    bannerBg.fillRoundedRect(-120, -35, 240, 70, 16);
    const bannerTxt = this.add
      .text(0, 0, "", {
        fontFamily: "Fraunces, serif",
        fontSize: "30px",
        color: "#ffd60a",
      })
      .setOrigin(0.5)
      .setName("bannerTxt");
    this.levelBanner.add([bannerBg, bannerTxt]);

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private resetSpawnTimer(): void {
    this.spawnTimer?.remove();
    this.spawnTimer = this.time.addEvent({
      delay: spawnDelay(this.level),
      loop: true,
      callback: () => this.spawnDrop(),
    });
  }

  private spawnDrop(): void {
    if (this.over) return;
    const x = Phaser.Math.Between(28, VW - 28);
    const isBomb = Math.random() < bombChance(this.level);

    if (isBomb) {
      this.spawnBomb(x);
    } else {
      const def = Phaser.Utils.Array.GetRandom(CANDIES) as CandyDef;
      this.spawnCandy(x, def);
    }
  }

  private spawnCandy(x: number, def: CandyDef): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(def.color, 1);
    gfx.fillCircle(0, 0, def.radius);
    gfx.lineStyle(3, def.outline, 1);
    gfx.strokeCircle(0, 0, def.radius);
    // Shine dot
    gfx.fillStyle(0xffffff, 0.5);
    gfx.fillCircle(-def.radius * 0.35, -def.radius * 0.35, def.radius * 0.28);

    // Physics proxy
    const hitbox = this.add.rectangle(0, 0, def.radius * 2, def.radius * 2, 0, 0);
    this.physics.add.existing(hitbox);
    const body = hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(dropSpeed(this.level));
    body.setCircle(def.radius);

    const container = this.add.container(x, -30, [gfx, hitbox]) as unknown as DropObject;
    container.isBomb = false;
    container.points = def.points;
    container.candyColor = def.color;
    container.setDepth(5);

    this.drops.add(hitbox);
    // Store reference so we can find container from hitbox
    (hitbox as unknown as Record<string, unknown>)["parentContainer"] = container;
  }

  private spawnBomb(x: number): void {
    const radius = 16;
    const gfx = this.add.graphics();
    // Bomb body
    gfx.fillStyle(BOMB_COLOR, 1);
    gfx.fillCircle(0, 4, radius);
    gfx.lineStyle(3, BOMB_OUTLINE, 1);
    gfx.strokeCircle(0, 4, radius);
    // Fuse
    gfx.lineStyle(3, 0x78716c, 1);
    gfx.beginPath();
    gfx.moveTo(0, -12);
    gfx.lineTo(6, -22);
    gfx.strokePath();
    // Spark
    gfx.fillStyle(0xfbbf24, 1);
    gfx.fillCircle(6, -22, 4);

    const hitbox = this.add.rectangle(0, 4, radius * 2, radius * 2, 0, 0);
    this.physics.add.existing(hitbox);
    const body = hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityY(dropSpeed(this.level) * 0.8);

    const container = this.add.container(x, -30, [gfx, hitbox]) as unknown as DropObject;
    container.isBomb = true;
    container.points = 0;
    container.candyColor = 0xff0000;
    container.setDepth(5);

    this.drops.add(hitbox);
    (hitbox as unknown as Record<string, unknown>)["parentContainer"] = container;
  }

  private catchDrop(hitbox: DropObject): void {
    // hitbox is actually the rectangle; get parent container
    const container = (hitbox as unknown as Record<string, unknown>)[
      "parentContainer"
    ] as DropObject | undefined;

    if (!container || !container.active) return;

    const cx = container.x;
    const cy = container.y;

    if (hitbox.isBomb || container.isBomb) {
      // Bomb caught → lose a life
      burstAt(this, cx, cy, 0xff4444);
      floatText(this, cx, cy - 10, "💣 -1 ❤️", "#ff4d6d");
      this.combo = 0;
      container.destroy();
      hitbox.destroy();
      this.lives -= 1;
      this.updateHUD();
      this.cameras.main.shake(180, 0.012);
      if (this.lives <= 0) {
        this.time.delayedCall(100, () => this.gameOver());
      }
    } else {
      // Candy caught → score
      this.combo += 1;
      const comboMult = this.combo >= 5 ? 3 : this.combo >= 3 ? 2 : 1;
      const earned = container.points * comboMult;
      this.score += earned;
      this.onScore(this.score);
      this.onHigh(this.score);

      burstAt(this, cx, cy, container.candyColor);
      const label =
        comboMult > 1
          ? `+${earned} ×${comboMult} COMBO!`
          : `+${earned}`;
      const col = comboMult >= 3 ? "#ffd60a" : comboMult === 2 ? "#f472b6" : "#ffffff";
      floatText(this, cx, cy - 10, label, col);

      container.destroy();
      hitbox.destroy();

      this.checkLevel();
      this.updateHUD();
    }
  }

  private checkLevel(): void {
    const newLevel = levelFromScore(this.score);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.resetSpawnTimer();
      this.showLevelBanner(`Level ${this.level}! 🎉`);
    }
  }

  private showLevelBanner(msg: string): void {
    const txt = this.levelBanner.getByName("bannerTxt") as Phaser.GameObjects.Text;
    txt.setText(msg);
    this.tweens.add({
      targets: this.levelBanner,
      alpha: 1,
      duration: 200,
      yoyo: true,
      hold: 900,
      onComplete: () => this.levelBanner.setAlpha(0),
    });
  }

  private updateHUD(): void {
    this.scoreTxt.setText(`Score: ${this.score}`);
    const hearts = "❤️".repeat(Math.max(0, this.lives));
    this.livesTxt.setText(hearts || "💔");
    this.levelTxt.setText(`Lv ${this.level}`);
  }

  update(_time: number, _delta: number): void {
    if (this.over) return;

    // Keyboard movement
    if (this.cursors?.left.isDown) {
      this.pointerX = Math.max(46, this.pointerX - this.basketSpeed * 2);
    }
    if (this.cursors?.right.isDown) {
      this.pointerX = Math.min(VW - 46, this.pointerX + this.basketSpeed * 2);
    }

    // Smooth basket follow
    const dx = this.pointerX - this.basket.x;
    this.basket.x += dx * 0.22;

    // Sync physics body position to container
    const bBody = this.basketBody.body as Phaser.Physics.Arcade.Body;
    bBody.reset(this.basket.x, this.basket.y);

    // Sync drop containers to their hitboxes
    for (const obj of this.drops.getChildren()) {
      const hitbox = obj as Phaser.GameObjects.Rectangle;
      const container = (hitbox as unknown as Record<string, unknown>)[
        "parentContainer"
      ] as Phaser.GameObjects.Container | undefined;
      if (container && container.active) {
        container.x = hitbox.x;
        container.y = hitbox.y;

        // Fell off bottom → miss
        if (hitbox.y > VH + 40) {
          if (!container.getData("missed")) {
            container.setData("missed", true);
            this.combo = 0;
            container.destroy();
            hitbox.destroy();
          }
        }
      }
    }
  }

  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.spawnTimer?.remove();

    // Clear remaining drops
    for (const obj of [...this.drops.getChildren()]) {
      const hitbox = obj as Phaser.GameObjects.Rectangle;
      const container = (hitbox as unknown as Record<string, unknown>)[
        "parentContainer"
      ] as Phaser.GameObjects.Container | undefined;
      container?.destroy();
      hitbox.destroy();
    }

    // Overlay
    const overlay = this.add.graphics().setDepth(25);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, VW, VH);

    const panel = this.add.graphics().setDepth(26);
    panel.fillStyle(0x1a0533, 1);
    panel.fillRoundedRect(VW / 2 - 140, VH / 2 - 130, 280, 260, 20);
    panel.lineStyle(4, 0xffd60a, 1);
    panel.strokeRoundedRect(VW / 2 - 140, VH / 2 - 130, 280, 260, 20);

    this.add
      .text(VW / 2, VH / 2 - 95, "Game Over!", {
        fontFamily: "Fraunces, serif",
        fontSize: "34px",
        color: "#ff4d6d",
        stroke: "#7e22ce",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(27);

    this.add
      .text(VW / 2, VH / 2 - 42, `🍬 Score: ${this.score}`, {
        fontFamily: "Manrope, sans-serif",
        fontSize: "22px",
        color: "#ffd60a",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(27);

    const high = this.getHigh();
    this.add
      .text(VW / 2, VH / 2, `🏆 Best: ${high}`, {
        fontFamily: "Manrope, sans-serif",
        fontSize: "18px",
        color: "#c4b5fd",
      })
      .setOrigin(0.5)
      .setDepth(27);

    this.add
      .text(VW / 2, VH / 2 + 36, `⭐ Level ${this.level} reached`, {
        fontFamily: "Manrope, sans-serif",
        fontSize: "16px",
        color: "#86efac",
      })
      .setOrigin(0.5)
      .setDepth(27);

    // Play Again button
    const btnY = VH / 2 + 78;
    const btnGfx = this.add.graphics().setDepth(27).setInteractive(
      new Phaser.Geom.Rectangle(VW / 2 - 85, btnY - 22, 170, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    btnGfx.fillStyle(0xff4d6d, 1);
    btnGfx.fillRoundedRect(VW / 2 - 85, btnY - 22, 170, 44, 22);
    btnGfx.lineStyle(3, 0xffd60a, 1);
    btnGfx.strokeRoundedRect(VW / 2 - 85, btnY - 22, 170, 44, 22);

    this.add
      .text(VW / 2, btnY, "▶ Play Again", {
        fontFamily: "Fraunces, serif",
        fontSize: "22px",
        color: "#fff",
        stroke: "#c9184a",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(28);

    const restart = (): void => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.restart();
      });
    };

    btnGfx.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-SPACE", restart);

    // Confetti burst on game over screen
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 120, () => {
        burstAt(
          this,
          Phaser.Math.Between(60, VW - 60),
          Phaser.Math.Between(VH / 4, VH * 0.6),
          Phaser.Utils.Array.GetRandom([
            0xff4d6d, 0xffd60a, 0xa855f7, 0x2ec4b6,
          ]) as number,
        );
      });
    }
  }
}

// ─── startGame ────────────────────────────────────────────────────────────────
export function startGame(
  parent: HTMLElement,
  onScore: (n: number) => void,
): () => void {
  // High score lives in a closure so both scenes can access it without React
  let highScore = (() => {
    const stored = localStorage.getItem("candystore2_highscore");
    return stored ? parseInt(stored, 10) || 0 : 0;
  })();

  const onHigh = (n: number): void => {
    if (n > highScore) {
      highScore = n;
      localStorage.setItem("candystore2_highscore", String(n));
    }
  };
  const getHigh = (): number => highScore;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VW,
    height: VH,
    backgroundColor: "#1a0533",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [
      new MenuScene(onScore, getHigh),
      new PlayScene(onScore, onHigh, getHigh),
    ],
    banner: false,
    audio: { disableWebAudio: false },
  });

  return () => game.destroy(true);
}
