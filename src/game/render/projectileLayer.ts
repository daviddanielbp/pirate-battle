import { Container, Sprite, Texture, type Spritesheet } from 'pixi.js';
import { textureFrom } from '../assets/loader';
import type { Projectile } from '../core/entities';

const TRAIL_LENGTH = 34;
const BALL_SCALE = 1.6;

class ProjectileView extends Container {
  readonly ball: Sprite;
  readonly trail: Sprite;

  constructor(ballTexture: Texture) {
    super();
    this.trail = new Sprite(Texture.WHITE);
    this.trail.anchor.set(1, 0.5);
    this.trail.tint = 0xe6f7ff;
    this.trail.alpha = 0.45;
    this.ball = new Sprite(ballTexture);
    this.ball.anchor.set(0.5);
    this.addChild(this.trail, this.ball);
  }
}

export class ProjectileLayer {
  readonly container = new Container();
  private readonly views = new Map<number, ProjectileView>();
  private readonly pool: ProjectileView[] = [];
  private readonly ballTexture: Texture;

  constructor(ships: Spritesheet) {
    this.ballTexture = textureFrom(ships, 'cannon_ball');
  }

  sync(projectiles: readonly Projectile[]): void {
    const seen = new Set<number>();
    for (const projectile of projectiles) {
      seen.add(projectile.id);
      let view = this.views.get(projectile.id);
      if (!view) {
        view = this.pool.pop() ?? new ProjectileView(this.ballTexture);
        this.container.addChild(view);
        this.views.set(projectile.id, view);
        view.ball.tint = projectile.faction === 'player' ? 0xffffff : 0xffb3a0;
      }
      view.position.set(projectile.x, projectile.y);
      const angle = Math.atan2(projectile.vy, projectile.vx);
      view.trail.rotation = angle;
      view.trail.width = TRAIL_LENGTH;
      view.trail.height = 4;
      view.ball.scale.set((projectile.radius / 5) * BALL_SCALE);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      this.container.removeChild(view);
      this.views.delete(id);
      this.pool.push(view);
    }
  }

  clear(): void {
    for (const view of this.views.values()) {
      this.container.removeChild(view);
      this.pool.push(view);
    }
    this.views.clear();
  }

  destroy(): void {
    this.clear();
    for (const view of this.pool) view.destroy({ children: true });
    this.pool.length = 0;
    this.container.destroy({ children: true });
  }
}
