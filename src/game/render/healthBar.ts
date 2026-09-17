import { Container, Rectangle, Sprite, Texture, type Spritesheet } from 'pixi.js';
import { textureFrom } from '../assets/loader';

interface FillLayout {
  x: number;
  width: number;
}

export interface HealthBarStyle {
  frame: string;
  fills: { green: string; amber?: string; red: string };
  fillLayout: FillLayout;
  scale: number;
}

export const ENEMY_HEALTH_STYLE: HealthBarStyle = {
  frame: 'enemy_health_frame',
  fills: { green: 'enemy_health_fill_green', red: 'enemy_health_fill_red' },
  fillLayout: { x: 24, width: 112 },
  scale: 0.42,
};

export const PLAYER_HEALTH_STYLE: HealthBarStyle = {
  frame: 'health_frame',
  fills: { green: 'health_fill_green', amber: 'health_fill_amber', red: 'health_fill_red' },
  fillLayout: { x: 30, width: 196 },
  scale: 0.36,
};

function clippedTexture(base: Texture): Texture {
  return new Texture({
    source: base.source,
    frame: new Rectangle(base.frame.x, base.frame.y, base.frame.width, base.frame.height),
    dynamic: true,
  });
}

export class HealthBar extends Container {
  private readonly fillSprite: Sprite;
  private readonly fillTextures: Record<'green' | 'amber' | 'red', Texture>;
  private readonly fullWidth: number;
  private readonly layout: FillLayout;
  private readonly sourceScale: number;
  private ratio = 1;
  private tone: 'green' | 'amber' | 'red' = 'green';

  constructor(ui: Spritesheet, style: HealthBarStyle) {
    super();
    const frame = new Sprite(textureFrom(ui, style.frame));
    frame.anchor.set(0.5);
    const green = textureFrom(ui, style.fills.green);
    const red = textureFrom(ui, style.fills.red);
    const amber = style.fills.amber ? textureFrom(ui, style.fills.amber) : green;
    this.fillTextures = {
      green: clippedTexture(green),
      amber: clippedTexture(amber),
      red: clippedTexture(red),
    };
    this.fullWidth = green.frame.width;
    this.sourceScale = green.frame.width / green.orig.width;
    this.layout = style.fillLayout;
    this.fillSprite = new Sprite(this.fillTextures.green);
    this.fillSprite.anchor.set(0, 0.5);
    this.fillSprite.position.set(-green.orig.width / 2, 0);
    this.addChild(frame, this.fillSprite);
    this.scale.set(style.scale);
    this.setRatio(1);
  }

  setRatio(ratio: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const tone = clamped > 0.5 ? 'green' : clamped > 0.25 ? 'amber' : 'red';
    if (clamped === this.ratio && tone === this.tone) return;
    this.ratio = clamped;
    this.tone = tone;
    const texture = this.fillTextures[tone];
    const visibleLogical = clamped === 0 ? 0 : this.layout.x + this.layout.width * clamped;
    texture.frame.width = Math.min(this.fullWidth, visibleLogical * this.sourceScale);
    texture.update();
    this.fillSprite.texture = texture;
    this.fillSprite.visible = clamped > 0;
  }

  override destroy(): void {
    super.destroy({ children: true });
    for (const texture of Object.values(this.fillTextures)) texture.destroy(false);
  }
}
