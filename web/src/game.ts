import Phaser from "phaser";

// ─── Constants ────────────────────────────────────────────────────────────────
const VW = 480;
const VH = 640;

const DAILY_RENT = 30;
const CANDY_PRICE = 8;          // per candy sold
const NEW_DAY_INTERVAL = 30000; // 30 s = one "day"

const JAR_TYPES = ["gummy", "sweet", "sour"] as const;
type CandyType = (typeof JAR_TYPES)[number];

interface Order {
  items: Partial<Record<CandyType, number>>; // e.g. { gummy: 2, sour: 1 }
  filled: Partial<Record<CandyType, number>>;
  bubbleGroup?: Phaser.GameObjects.Container;
}

// ─── Colour palette ───────────────────────────────────────────────────────────
const JAR_COLOURS: Record<CandyType, number> = {
  gummy: 0xff6ec7,   // pink
  sweet: 0xffd700,   // gold
  sour:  0x7cdd2a,   // lime green
};
const JAR_LABEL_BG: Record<CandyType, string> = {
  gummy: "#ff6ec7",
  sweet: "#ffd700",
  sour:  "#7cdd2a",
};
const JAR_EMOJI: Record<CandyType, string> = {
  gummy: "🐻",
  sweet: "🍬",
  sour:  "🍋",
};
const JAR_LABEL: Record<CandyType, string> = {
  gummy: "GUMMY",
  sweet: "SWEET",
  sour:  "SOUR",
};

// ─── PlayScene ────────────────────────────────────────────────────────────────
class PlayScene extends Phaser.Scene {
  private readonly onScore: (n: number) => void;

  private money = 0;
  private day = 1;
  private currentOrder: Order | null = null;
  private dayTimer?: Phaser.Time.TimerEvent;

  // UI objects
  private moneyText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private rentWarning?: Phaser.GameObjects.Text;
  private jarContainers: Phaser.GameObjects.Container[] = [];
  private counterTop!: Phaser.GameObjects.Rectangle;
  private orderArea!: Phaser.GameObjects.Container;
  private dayBanner?: Phaser.GameObjects.Container;

  constructor(onScore: (n: number) => void) {
    super("play");
    this.onScore = onScore;
  }

  // ── create ──────────────────────────────────────────────────────────────────
  create(): void {
    this.money = 0;
    this.day = 1;
    this.currentOrder = null;
    this.jarContainers = [];
    this.onScore(0);

    this.drawBackground();
    this.drawCounter();
    this.drawJars();
    this.drawHUD();
    this.drawOrderArea();

    // Start day loop
    this.startDay();
  }

  // ── Background ──────────────────────────────────────────────────────────────
  private drawBackground(): void {
    // Soft pastel shop background
    const bg = this.add.rectangle(VW / 2, VH / 2, VW, VH, 0xfff0f8);
    bg.setDepth(0);

    // Wallpaper stripes
    for (let i = 0; i < 12; i++) {
      const stripe = this.add.rectangle(i * 44 + 22, VH / 2, 22, VH, 0xfce4f0, 0.35);
      stripe.setDepth(0);
    }

    // Shop sign at top
    const signBg = this.add.rectangle(VW / 2, 36, 280, 48, 0xff6ec7).setDepth(1);
    signBg.setStrokeStyle(3, 0xffffff);
    this.add.text(VW / 2, 36, "🍭 CANDY STORE 🍭", {
      fontFamily: "Fraunces, serif",
      fontSize: "22px",
      color: "#ffffff",
      stroke: "#c0007a",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);

    // Bunting / decorations
    const buntingColors = [0xff6ec7, 0xffd700, 0x7cdd2a, 0xff9f43, 0x74b9ff];
    for (let i = 0; i < 9; i++) {
      const col = buntingColors[i % buntingColors.length] as number;
      const tri = this.add.triangle(
        i * 56 + 28, 66,
        0, 0, 18, 28, 36, 0,
        col
      ).setDepth(1);
      tri.setStrokeStyle(1, 0xffffff);
    }
  }

  // ── Counter ─────────────────────────────────────────────────────────────────
  private drawCounter(): void {
    // Counter top
    this.counterTop = this.add.rectangle(VW / 2, VH - 100, VW, 200, 0xd4956a).setDepth(1);
    this.counterTop.setStrokeStyle(4, 0xb06030);

    // Counter surface highlight
    this.add.rectangle(VW / 2, VH - 180, VW, 12, 0xfff3e0).setDepth(2);
  }

  // ── Jars ────────────────────────────────────────────────────────────────────
  private drawJars(): void {
    const jarY = VH - 155;
    const positions = [VW * 0.2, VW * 0.5, VW * 0.8];

    JAR_TYPES.forEach((type, i) => {
      const x = positions[i] as number;
      const container = this.add.container(x, jarY).setDepth(3);

      // Jar body (rounded rectangle via graphics)
      const gfx = this.add.graphics();
      const jarW = 90, jarH = 110;

      // Jar glass body
      gfx.fillStyle(JAR_COLOURS[type], 0.25);
      gfx.fillRoundedRect(-jarW / 2, -jarH + 10, jarW, jarH, 12);

      // Jar outline
      gfx.lineStyle(3, JAR_COLOURS[type], 1);
      gfx.strokeRoundedRect(-jarW / 2, -jarH + 10, jarW, jarH, 12);

      // Candy fill inside jar
      gfx.fillStyle(JAR_COLOURS[type], 0.6);
      gfx.fillRoundedRect(-jarW / 2 + 6, -jarH + 40, jarW - 12, jarH - 36, 8);

      // Jar lid
      gfx.fillStyle(JAR_COLOURS[type], 1);
      gfx.fillRoundedRect(-jarW / 2 - 4, -jarH + 4, jarW + 8, 18, 6);
      gfx.lineStyle(2, 0xffffff, 0.5);
      gfx.strokeRoundedRect(-jarW / 2 - 4, -jarH + 4, jarW + 8, 18, 6);

      // Shine on jar
      gfx.fillStyle(0xffffff, 0.3);
      gfx.fillRoundedRect(-jarW / 2 + 8, -jarH + 22, 14, jarH - 28, 6);

      container.add(gfx);

      // Emoji in jar
      const emoji = this.add.text(0, -jarH / 2 - 10, JAR_EMOJI[type], {
        fontSize: "32px",
      }).setOrigin(0.5);
      container.add(emoji);

      // Label below jar
      const labelBg = this.add.rectangle(0, 18, 84, 26, parseInt(JAR_LABEL_BG[type].replace("#", ""), 16))
        .setStrokeStyle(2, 0xffffff);
      const labelText = this.add.text(0, 18, JAR_LABEL[type], {
        fontFamily: "Manrope, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#00000055",
        strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(labelBg);
      container.add(labelText);

      this.jarContainers.push(container);

      // Hit area — invisible rect covering the whole jar
      const hitZone = this.add.rectangle(x, jarY - 40, 100, 140, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(4);

      hitZone.on("pointerdown", () => this.onJarTap(type));
      hitZone.on("pointerover", () => {
        this.tweens.add({ targets: container, y: jarY - 8, duration: 80, ease: "Back.easeOut" });
      });
      hitZone.on("pointerout", () => {
        this.tweens.add({ targets: container, y: jarY, duration: 100, ease: "Back.easeIn" });
      });
    });
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────
  private drawHUD(): void {
    // Money display
    const moneyBg = this.add.rectangle(VW - 80, 80, 140, 36, 0x2d3436).setDepth(5);
    moneyBg.setStrokeStyle(2, 0xffd700);
    this.moneyText = this.add.text(VW - 80, 80, "💰 $0", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffd700",
    }).setOrigin(0.5).setDepth(6);

    // Day display
    const dayBg = this.add.rectangle(60, 80, 100, 36, 0x2d3436).setDepth(5);
    dayBg.setStrokeStyle(2, 0x74b9ff);
    this.dayText = this.add.text(60, 80, "Day 1", {
      fontFamily: "Manrope, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#74b9ff",
    }).setOrigin(0.5).setDepth(6);
  }

  // ── Order area (speech bubble zone) ─────────────────────────────────────────
  private drawOrderArea(): void {
    this.orderArea = this.add.container(VW / 2, 200).setDepth(5);
  }

  // ── Day logic ───────────────────────────────────────────────────────────────
  private startDay(): void {
    this.dayTimer?.remove();
    this.showDayBanner();

    // Spawn first order shortly after banner
    this.time.delayedCall(1200, () => this.spawnOrder());

    // Every NEW_DAY_INTERVAL, end the day and charge rent
    this.dayTimer = this.time.addEvent({
      delay: NEW_DAY_INTERVAL,
      loop: true,
      callback: () => this.endDay(),
    });
  }

  private endDay(): void {
    this.day += 1;
    const rent = DAILY_RENT;
    this.money -= rent;
    if (this.money < 0) this.money = 0;
    this.onScore(this.money);
    this.updateMoneyText();
    this.showRentNotice(rent);
    this.time.delayedCall(1800, () => {
      this.showDayBanner();
    });
  }

  private showDayBanner(): void {
    this.dayBanner?.destroy();
    const container = this.add.container(VW / 2, VH / 2).setDepth(20);

    const bg = this.add.rectangle(0, 0, 300, 90, 0x2d3436, 0.92);
    bg.setStrokeStyle(3, 0xffd700);
    const title = this.add.text(0, -16, `☀️ Day ${this.day}`, {
      fontFamily: "Fraunces, serif",
      fontSize: "30px",
      color: "#ffd700",
    }).setOrigin(0.5);
    const sub = this.add.text(0, 20, `Rent: $${DAILY_RENT}/day`, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "15px",
      color: "#b2bec3",
    }).setOrigin(0.5);

    container.add([bg, title, sub]);
    this.dayText.setText(`Day ${this.day}`);
    this.dayBanner = container;

    // Fade out after 1.5s
    this.tweens.add({
      targets: container,
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => container.destroy(),
    });
  }

  private showRentNotice(rent: number): void {
    this.rentWarning?.destroy();
    const notice = this.add.text(VW / 2, VH / 2 + 60, `🏠 -$${rent} rent`, {
      fontFamily: "Manrope, sans-serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ff7675",
      stroke: "#2d3436",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);
    this.rentWarning = notice;

    this.tweens.add({
      targets: notice,
      y: VH / 2 + 20,
      alpha: 0,
      duration: 1800,
      ease: "Power2",
      onComplete: () => notice.destroy(),
    });
  }

  // ── Order generation ─────────────────────────────────────────────────────────
  private spawnOrder(): void {
    if (this.currentOrder) return; // wait for current to be filled

    // Build a random order: 1–3 types, each 1–3 qty
    const types = Phaser.Utils.Array.Shuffle([...JAR_TYPES]) as CandyType[];
    const numTypes = Phaser.Math.Between(1, 3);
    const items: Partial<Record<CandyType, number>> = {};
    for (let i = 0; i < numTypes; i++) {
      const t = types[i];
      if (t) items[t] = Phaser.Math.Between(1, 3);
    }

    this.currentOrder = { items, filled: {} };
    this.renderOrderBubble();
  }

  private renderOrderBubble(): void {
    if (!this.currentOrder) return;

    // Clear old bubble
    this.currentOrder.bubbleGroup?.destroy();

    const order = this.currentOrder;
    const lines: string[] = [];
    for (const type of JAR_TYPES) {
      const want = order.items[type] ?? 0;
      const got  = order.filled[type] ?? 0;
      if (want > 0) {
        const checks = "✅".repeat(got) + "⬜".repeat(want - got);
        lines.push(`${JAR_EMOJI[type]} ${JAR_LABEL[type]}  ${checks}`);
      }
    }

    const bubbleX = VW / 2;
    const bubbleY = 170;
    const container = this.add.container(bubbleX, bubbleY).setDepth(10);

    // Bubble background
    const padX = 28, padY = 20;
    const lineH = 32;
    const bubbleH = lines.length * lineH + padY * 2;
    const bubbleW = 280;

    const bubbleBg = this.add.graphics();
    bubbleBg.fillStyle(0xffffff, 1);
    bubbleBg.fillRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 18);
    bubbleBg.lineStyle(3, 0xff6ec7, 1);
    bubbleBg.strokeRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 18);

    // Speech bubble tail pointing down
    bubbleBg.fillStyle(0xffffff, 1);
    bubbleBg.fillTriangle(-16, bubbleH / 2, 16, bubbleH / 2, 0, bubbleH / 2 + 22);
    bubbleBg.lineStyle(3, 0xff6ec7, 1);
    bubbleBg.strokeTriangle(-16, bubbleH / 2, 16, bubbleH / 2, 0, bubbleH / 2 + 22);

    // Cover the triangle base with white so the seam is hidden
    bubbleBg.fillStyle(0xffffff, 1);
    bubbleBg.fillRect(-18, bubbleH / 2 - 4, 36, 8);

    container.add(bubbleBg);

    // "Order:" header
    const header = this.add.text(0, -bubbleH / 2 + 14, "🛒 Order:", {
      fontFamily: "Fraunces, serif",
      fontSize: "17px",
      color: "#c0007a",
    }).setOrigin(0.5, 0);
    container.add(header);

    // Order lines
    lines.forEach((line, idx) => {
      const ty = -bubbleH / 2 + padY + 28 + idx * lineH;
      const txt = this.add.text(-bubbleW / 2 + padX, ty, line, {
        fontFamily: "Manrope, sans-serif",
        fontSize: "16px",
        color: "#2d3436",
      }).setOrigin(0, 0.5);
      container.add(txt);
    });

    // Customer character (simple smiley face)
    const face = this.add.text(-bubbleW / 2 - 44, 0, "🧒", {
      fontSize: "40px",
    }).setOrigin(0.5);
    container.add(face);

    order.bubbleGroup = container;

    // Bounce in
    container.setScale(0.6);
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 250,
      ease: "Back.easeOut",
    });
  }

  // ── Jar tap ─────────────────────────────────────────────────────────────────
  private onJarTap(type: CandyType): void {
    if (!this.currentOrder) return;

    const want = this.currentOrder.items[type] ?? 0;
    const got  = this.currentOrder.filled[type] ?? 0;

    if (want === 0) {
      // Not in this order — shake the jar
      const idx = JAR_TYPES.indexOf(type);
      const jar = this.jarContainers[idx];
      if (jar) this.shakeObject(jar);
      this.showFloatingText("Not in order!", VW / 2, VH - 220, "#ff7675");
      return;
    }

    if (got >= want) {
      // Already filled
      this.showFloatingText("Already got it! ✅", VW / 2, VH - 220, "#00b894");
      return;
    }

    // Fill one candy of this type
    this.currentOrder.filled[type] = got + 1;
    this.showFloatingText(`+${JAR_EMOJI[type]}`, this.jarContainers[JAR_TYPES.indexOf(type)]?.x ?? VW / 2, VH - 220, "#ffd700");

    // Refresh bubble
    this.renderOrderBubble();

    // Check if order is complete
    if (this.isOrderComplete()) {
      this.time.delayedCall(300, () => this.completeOrder());
    }
  }

  private isOrderComplete(): boolean {
    if (!this.currentOrder) return false;
    for (const type of JAR_TYPES) {
      const want = this.currentOrder.items[type] ?? 0;
      const got  = this.currentOrder.filled[type] ?? 0;
      if (got < want) return false;
    }
    return true;
  }

  private completeOrder(): void {
    if (!this.currentOrder) return;

    // Count total candies sold
    let total = 0;
    for (const type of JAR_TYPES) {
      total += this.currentOrder.items[type] ?? 0;
    }
    const earned = total * CANDY_PRICE;
    this.money += earned;
    this.onScore(this.money);
    this.updateMoneyText();

    // Show big earn notice
    this.showFloatingText(`💰 +$${earned}!`, VW / 2, VH - 280, "#ffd700", "28px");

    // Confetti burst
    this.spawnConfetti(VW / 2, VH - 250);

    // Clear order
    this.currentOrder.bubbleGroup?.destroy();
    this.currentOrder = null;

    // Spawn next order after a short delay
    this.time.delayedCall(1200, () => this.spawnOrder());
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private updateMoneyText(): void {
    this.moneyText.setText(`💰 $${this.money}`);
    this.tweens.add({
      targets: this.moneyText,
      scaleX: 1.2, scaleY: 1.2,
      duration: 100,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  private showFloatingText(
    msg: string,
    x: number,
    y: number,
    color: string,
    size = "20px",
  ): void {
    const txt = this.add.text(x, y, msg, {
      fontFamily: "Manrope, sans-serif",
      fontSize: size,
      fontStyle: "bold",
      color,
      stroke: "#ffffff",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: "Power2",
      onComplete: () => txt.destroy(),
    });
  }

  private shakeObject(obj: Phaser.GameObjects.Container): void {
    const origX = obj.x;
    this.tweens.add({
      targets: obj,
      x: origX + 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => { obj.x = origX; },
    });
  }

  private spawnConfetti(cx: number, cy: number): void {
    const colors = [0xff6ec7, 0xffd700, 0x7cdd2a, 0x74b9ff, 0xff9f43, 0xa29bfe];
    for (let i = 0; i < 22; i++) {
      const col = colors[i % colors.length] as number;
      const dot = this.add.rectangle(cx, cy, 8, 8, col).setDepth(25);
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
      const speed = Phaser.Math.Between(80, 200);
      this.tweens.add({
        targets: dot,
        x: cx + Math.cos(angle) * speed,
        y: cy + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: Phaser.Math.Between(500, 900),
        ease: "Power2",
        onComplete: () => dot.destroy(),
      });
    }
  }

  update(): void {
    // Nothing to poll — all driven by events/timers
  }
}

// ─── startGame ────────────────────────────────────────────────────────────────
export function startGame(parent: HTMLElement, onScore: (n: number) => void): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VW,
    height: VH,
    backgroundColor: "#fdf0f8",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: new PlayScene(onScore),
    banner: false,
  });

  return () => game.destroy(true);
}
