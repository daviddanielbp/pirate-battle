import { Container, Sprite, type Spritesheet } from 'pixi.js';
import { healthRatio, type Ship } from '../core/entities';
import { textureFrom } from '../assets/loader';
import { SHIP_SPRITE_ROTATION_OFFSET, SHIP_SPRITE_SCALE, shipTextureName, type FleetAppearance } from './constants';
import { ENEMY_HEALTH_STYLE, HealthBar, PLAYER_HEALTH_STYLE } from './healthBar';

const HEALTH_BAR_OFFSET = -70;

export class ShipView extends Container {
  readonly shipId: number;
  private readonly body: Sprite;
  private readonly flame: Sprite;
  private readonly healthBar: HealthBar;
  private readonly ships: Spritesheet;
  private readonly appearance: FleetAppearance;
  private textureName = '';
  private flashRemaining = 0;
  private flameTime = 0;

  constructor(ships: Spritesheet, ui: Spritesheet, ship: Ship, appearance: FleetAppearance) {
    super();
    this.shipId = ship.id;
    this.ships = ships;
    this.appearance = appearance;
    this.body = new Sprite(textureFrom(ships, shipTextureName(ship.kind, 1, appearance)));
    this.body.anchor.set(0.5, 0.5);
    this.body.scale.set(SHIP_SPRITE_SCALE);
    this.flame = new Sprite(textureFrom(ships, 'fire_1'));
    this.flame.anchor.set(0.5, 1);
    this.flame.visible = false;
    this.healthBar = new HealthBar(ui, ship.kind === 'player' ? PLAYER_HEALTH_STYLE : ENEMY_HEALTH_STYLE);
    this.healthBar.position.set(0, HEALTH_BAR_OFFSET);
    const hull = new Container();
    hull.addChild(this.body, this.flame);
    this.addChild(hull, this.healthBar);
    this.body.label = 'hull';
    this.sync(ship);
  }

  sync(ship: Ship): void {
    this.position.set(ship.x, ship.y);
    const rotation = ship.heading + SHIP_SPRITE_ROTATION_OFFSET;
    const hull = this.body.parent;
    if (hull) hull.rotation = rotation;
    const ratio = healthRatio(ship);
    const name = shipTextureName(ship.kind, ratio, this.appearance);
    if (name !== this.textureName) {
      this.textureName = name;
      this.body.texture = textureFrom(this.ships, name);
    }
    this.healthBar.setRatio(ratio);
    this.flame.visible = ratio <= 0.34;
  }

  flash(): void {
    this.flashRemaining = 0.12;
    this.body.tint = 0xff6a4a;
  }

  animate(dt: number): void {
    if (this.flashRemaining > 0) {
      this.flashRemaining -= dt;
      if (this.flashRemaining <= 0) this.body.tint = 0xffffff;
    }
    if (this.flame.visible) {
      this.flameTime += dt;
      const pulse = 0.85 + Math.sin(this.flameTime * 14) * 0.15;
      this.flame.scale.set(0.9 * pulse, 1.05 * pulse);
      this.flame.texture = textureFrom(this.ships, Math.floor(this.flameTime * 10) % 2 === 0 ? 'fire_1' : 'fire_2');
      this.flame.position.set(0, 6);
    }
  }

  override destroy(): void {
    this.healthBar.destroy();
    super.destroy({ children: true });
  }
}
