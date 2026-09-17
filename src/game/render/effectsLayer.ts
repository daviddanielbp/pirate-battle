import { Container, Graphics, Rectangle, Sprite, Texture, type Renderer, type Spritesheet } from 'pixi.js';
import { textureFrom } from '../assets/loader';
import type { ShipKind } from '../core/entities';
import { createRandom, type RandomSource } from '../core/rng';
import { SHIP_SPRITE_ROTATION_OFFSET, SHIP_SPRITE_SCALE, wreckTextureName, type FleetAppearance } from './constants';

interface Particle {
  sprite: Sprite;
  age: number;
  life: number;
  vx: number;
  vy: number;
  spin: number;
  drag: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  alphaTo: number;
  frames: Texture[] | null;
  layer: Container;
}

export class EffectsLayer {
  readonly front = new Container();
  readonly back = new Container();
  private readonly particles: Particle[] = [];
  private readonly pool: Sprite[] = [];
  private readonly ships: Spritesheet;
  private readonly ringTexture: Texture;
  private readonly explosionFrames: Texture[];
  private readonly debrisFrames: Texture[];
  private readonly random: RandomSource = createRandom(7);
  private readonly appearance: FleetAppearance;

  constructor(renderer: Renderer, ships: Spritesheet, appearance: FleetAppearance) {
    this.ships = ships;
    this.appearance = appearance;
    const ring = new Graphics().circle(24, 24, 20).stroke({ width: 4, color: 0xffffff, alpha: 1 });
    this.ringTexture = renderer.generateTexture({ target: ring, frame: new Rectangle(0, 0, 48, 48), resolution: 2 });
    ring.destroy();
    this.explosionFrames = ['explosion_1', 'explosion_2', 'explosion_3'].map((name) => textureFrom(ships, name));
    this.debrisFrames = ['wood_1', 'wood_2', 'wood_3', 'wood_4'].map((name) => textureFrom(ships, name));
  }

  muzzleFlash(x: number, y: number, angle: number): void {
    const flash = this.spawn(this.front, textureFrom(this.ships, 'explosion_3'), x, y, 0.12);
    flash.sprite.rotation = angle;
    flash.scaleFrom = 0.3;
    flash.scaleTo = 0.55;
    flash.alphaFrom = 0.95;
    flash.alphaTo = 0;
    flash.vx = Math.cos(angle) * 60;
    flash.vy = Math.sin(angle) * 60;
  }

  hitSpark(x: number, y: number): void {
    const spark = this.spawn(this.front, textureFrom(this.ships, 'explosion_3'), x, y, 0.2);
    spark.sprite.tint = 0xffd27a;
    spark.scaleFrom = 0.25;
    spark.scaleTo = 0.5;
    spark.alphaFrom = 1;
    spark.alphaTo = 0;
    spark.spin = this.random.range(-6, 6);
  }

  splash(x: number, y: number): void {
    const ring = this.spawn(this.front, this.ringTexture, x, y, 0.4);
    ring.scaleFrom = 0.25;
    ring.scaleTo = 1;
    ring.alphaFrom = 0.85;
    ring.alphaTo = 0;
    ring.sprite.tint = 0xe8fbff;
  }

  explosion(x: number, y: number, kind: ShipKind, heading: number, intensity = 1): void {
    const blast = this.spawn(this.front, this.explosionFrames[0] ?? Texture.EMPTY, x, y, 0.6);
    blast.frames = this.explosionFrames;
    blast.scaleFrom = 0.6 * intensity;
    blast.scaleTo = 1.5 * intensity;
    blast.alphaFrom = 1;
    blast.alphaTo = 0;
    blast.spin = this.random.range(-1, 1);
    for (let index = 0; index < 6; index += 1) {
      const texture = this.debrisFrames[index % this.debrisFrames.length] ?? Texture.EMPTY;
      const debris = this.spawn(this.back, texture, x, y, this.random.range(0.7, 1.1));
      const angle = this.random.range(0, Math.PI * 2);
      const speed = this.random.range(60, 190) * intensity;
      debris.vx = Math.cos(angle) * speed;
      debris.vy = Math.sin(angle) * speed;
      debris.spin = this.random.range(-8, 8);
      debris.drag = 2.4;
      debris.scaleFrom = 0.8;
      debris.scaleTo = 0.5;
      debris.alphaFrom = 1;
      debris.alphaTo = 0;
    }
    const wreck = this.spawn(this.back, textureFrom(this.ships, wreckTextureName(kind, this.appearance)), x, y, 1.6);
    wreck.sprite.rotation = heading + SHIP_SPRITE_ROTATION_OFFSET;
    wreck.scaleFrom = SHIP_SPRITE_SCALE;
    wreck.scaleTo = SHIP_SPRITE_SCALE * 0.7;
    wreck.alphaFrom = 0.95;
    wreck.alphaTo = 0;
    this.splash(x, y);
  }

  update(dt: number): void {
    const particles = this.particles;
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      if (!particle) continue;
      particle.age += dt;
      const t = Math.min(1, particle.age / particle.life);
      const { sprite } = particle;
      if (particle.drag > 0) {
        particle.vx -= particle.vx * particle.drag * dt;
        particle.vy -= particle.vy * particle.drag * dt;
      }
      sprite.x += particle.vx * dt;
      sprite.y += particle.vy * dt;
      sprite.rotation += particle.spin * dt;
      const scale = particle.scaleFrom + (particle.scaleTo - particle.scaleFrom) * t;
      sprite.scale.set(scale);
      sprite.alpha = particle.alphaFrom + (particle.alphaTo - particle.alphaFrom) * t;
      if (particle.frames) {
        const frame = particle.frames[Math.min(particle.frames.length - 1, Math.floor(t * particle.frames.length))];
        if (frame && sprite.texture !== frame) sprite.texture = frame;
      }
      if (t >= 1) {
        particle.layer.removeChild(sprite);
        sprite.tint = 0xffffff;
        sprite.rotation = 0;
        this.pool.push(sprite);
        particles.splice(index, 1);
      }
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      particle.layer.removeChild(particle.sprite);
      this.pool.push(particle.sprite);
    }
    this.particles.length = 0;
  }

  destroy(): void {
    this.clear();
    for (const sprite of this.pool) sprite.destroy();
    this.pool.length = 0;
    this.front.destroy({ children: true });
    this.back.destroy({ children: true });
    this.ringTexture.destroy(true);
  }

  private spawn(layer: Container, texture: Texture, x: number, y: number, life: number): Particle {
    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = 1;
    sprite.scale.set(1);
    layer.addChild(sprite);
    const particle: Particle = {
      sprite,
      age: 0,
      life,
      vx: 0,
      vy: 0,
      spin: 0,
      drag: 0,
      scaleFrom: 1,
      scaleTo: 1,
      alphaFrom: 1,
      alphaTo: 1,
      frames: null,
      layer,
    };
    this.particles.push(particle);
    return particle;
  }
}
