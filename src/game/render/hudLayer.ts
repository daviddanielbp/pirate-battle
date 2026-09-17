import { Container, Graphics, Sprite, Text, TextStyle, type Spritesheet } from 'pixi.js';
import { textureFrom } from '../assets/loader';
import { HealthBar, PLAYER_HEALTH_STYLE } from './healthBar';

const COUNTER_SCALE = 0.75;
const PANEL_WIDTH = 160;
const PANEL_HEIGHT = 56;
const MARGIN = 12;
const COMPACT_WIDTH = 720;
const COOLDOWN_WIDTH = 44;
const COOLDOWN_HEIGHT = 5;
const COOLDOWN_GAP = 10;

function counterText(): Text {
  return new Text({
    text: '',
    style: new TextStyle({
      fontFamily: '"Trebuchet MS", "Lucida Grande", "Segoe UI", Helvetica, Arial, sans-serif',
      fontSize: 26,
      fontWeight: '700',
      fill: 0xf2c14e,
      dropShadow: { color: 0x000000, alpha: 0.45, blur: 0, distance: 2, angle: Math.PI / 2 },
    }),
    resolution: 2,
  });
}

class CooldownBar extends Container {
  private readonly fill: Graphics;
  private ratio = -1;

  constructor(label: string) {
    super();
    const track = new Graphics().roundRect(0, 0, COOLDOWN_WIDTH, COOLDOWN_HEIGHT, 2).fill({ color: 0x0b1a2b, alpha: 0.8 });
    this.fill = new Graphics();
    const caption = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: '"Trebuchet MS", "Lucida Grande", "Segoe UI", Helvetica, Arial, sans-serif',
        fontSize: 10,
        fontWeight: '700',
        fill: 0xf7e9c9,
        letterSpacing: 1,
      }),
      resolution: 2,
    });
    caption.anchor.set(0, 0);
    caption.position.set(0, COOLDOWN_HEIGHT + 2);
    this.addChild(track, this.fill, caption);
    this.set(1);
  }

  set(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (Math.abs(clamped - this.ratio) < 0.01) return;
    this.ratio = clamped;
    this.fill.clear();
    if (clamped > 0) {
      this.fill
        .roundRect(0, 0, COOLDOWN_WIDTH * clamped, COOLDOWN_HEIGHT, 2)
        .fill({ color: clamped >= 1 ? 0xf2c14e : 0x8fa4bd, alpha: 1 });
    }
  }
}

class Counter extends Container {
  private readonly value: Text;
  private current = '';

  constructor(ui: Spritesheet, icon: string) {
    super();
    const panel = new Sprite(textureFrom(ui, 'counter_panel'));
    const glyph = new Sprite(textureFrom(ui, icon));
    glyph.anchor.set(0.5);
    glyph.position.set(28, PANEL_HEIGHT / 2);
    glyph.scale.set(0.6);
    this.value = counterText();
    this.value.anchor.set(1, 0.5);
    this.value.position.set(PANEL_WIDTH - 20, PANEL_HEIGHT / 2);
    this.addChild(panel, glyph, this.value);
    this.scale.set(COUNTER_SCALE);
  }

  set(text: string): void {
    if (text === this.current) return;
    this.current = text;
    this.value.text = text;
  }
}

export class HudLayer {
  readonly root = new Container();
  private readonly score: Counter;
  private readonly time: Counter;
  private readonly health: HealthBar;
  private readonly healthText: Text;
  private readonly cooldowns: { front: CooldownBar; left: CooldownBar; right: CooldownBar };
  private lastHealth = '';

  constructor(ui: Spritesheet) {
    this.score = new Counter(ui, 'icon_score');
    this.time = new Counter(ui, 'icon_time');
    this.health = new HealthBar(ui, { ...PLAYER_HEALTH_STYLE, scale: 0.72 });
    this.healthText = counterText();
    this.healthText.style.fontSize = 18;
    this.healthText.style.fill = 0xf7e9c9;
    this.healthText.anchor.set(0.5);
    this.cooldowns = { left: new CooldownBar('Q'), front: new CooldownBar('SPACE'), right: new CooldownBar('E') };
    this.root.addChild(
      this.health,
      this.healthText,
      this.score,
      this.time,
      this.cooldowns.left,
      this.cooldowns.front,
      this.cooldowns.right,
    );
  }

  layout(width: number, height: number): void {
    const counterWidth = PANEL_WIDTH * COUNTER_SCALE;
    const counterHeight = PANEL_HEIGHT * COUNTER_SCALE;
    const top = MARGIN;
    const compact = width < COMPACT_WIDTH;
    const barsTop = top + counterHeight + 8;
    const counterTop = compact ? barsTop + COOLDOWN_HEIGHT + 22 : top;
    this.time.position.set(width - MARGIN - counterWidth - 64, counterTop);
    this.score.position.set(this.time.x - counterWidth - 8, counterTop);
    this.health.position.set(MARGIN + (256 * 0.72) / 2, top + counterHeight / 2);
    this.healthText.position.set(this.health.x + 8, this.health.y);
    const barsLeft = MARGIN + 22;
    this.cooldowns.left.position.set(barsLeft, barsTop);
    this.cooldowns.front.position.set(barsLeft + COOLDOWN_WIDTH + COOLDOWN_GAP, barsTop);
    this.cooldowns.right.position.set(barsLeft + (COOLDOWN_WIDTH + COOLDOWN_GAP) * 2, barsTop);
    this.root.visible = height > 0;
  }

  updateCooldowns(front: number, left: number, right: number): void {
    this.cooldowns.front.set(front);
    this.cooldowns.left.set(left);
    this.cooldowns.right.set(right);
  }

  update(score: number, secondsLeft: number, health: number, maxHealth: number): void {
    this.score.set(String(score));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    this.time.set(`${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`);
    this.health.setRatio(maxHealth === 0 ? 0 : health / maxHealth);
    const label = `${health} / ${maxHealth}`;
    if (label !== this.lastHealth) {
      this.lastHealth = label;
      this.healthText.text = label;
    }
  }

  destroy(): void {
    this.health.destroy();
    this.root.destroy({ children: true });
  }
}
