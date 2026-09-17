import { Container, type Renderer } from 'pixi.js';
import type { GameAtlases } from '../assets/loader';
import type { ArenaDefinition } from '../core/arena';
import type { Ship, SimulationEvent } from '../core/entities';
import type { MatchSimulation } from '../core/simulation';
import { ArenaLayer } from './arenaLayer';
import { EffectsLayer } from './effectsLayer';
import { ProjectileLayer } from './projectileLayer';
import { ShipView } from './shipView';
import type { FleetAppearance } from './constants';
import { createRandom } from '../core/rng';

export class BattleRenderer {
  readonly root = new Container();
  private readonly arenaLayer: ArenaLayer;
  private readonly effects: EffectsLayer;
  private readonly projectiles: ProjectileLayer;
  private readonly shipLayer = new Container();
  private readonly shipViews = new Map<number, ShipView>();
  private readonly atlases: GameAtlases;
  private readonly headings = new Map<number, number>();
  private readonly appearance: FleetAppearance;
  private sceneTime = 0;
  private shakeRemaining = 0;
  private shakeStrength = 0;
  private readonly shakeRandom = createRandom(11);

  constructor(
    renderer: Renderer,
    atlases: GameAtlases,
    arena: ArenaDefinition,
    width: number,
    height: number,
    appearance: FleetAppearance,
  ) {
    this.atlases = atlases;
    this.appearance = appearance;
    this.arenaLayer = new ArenaLayer(renderer, atlases.tiles, arena, width, height);
    this.effects = new EffectsLayer(renderer, atlases.ships, appearance);
    this.projectiles = new ProjectileLayer(atlases.ships);
    this.root.addChild(
      this.arenaLayer.water,
      this.arenaLayer.boundary,
      this.arenaLayer.shallows,
      this.arenaLayer.islands,
      this.effects.back,
      this.projectiles.container,
      this.shipLayer,
      this.effects.front,
    );
  }

  sync(simulation: MatchSimulation): void {
    const seen = new Set<number>();
    for (const ship of simulation.ships) {
      seen.add(ship.id);
      this.headings.set(ship.id, ship.heading);
      const view = this.shipViews.get(ship.id) ?? this.createShipView(ship);
      view.sync(ship);
    }
    for (const [id, view] of this.shipViews) {
      if (seen.has(id)) continue;
      this.shipLayer.removeChild(view);
      view.destroy();
      this.shipViews.delete(id);
    }
    this.projectiles.sync(simulation.projectiles);
  }

  applyEvents(events: readonly SimulationEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'fire':
          this.effects.muzzleFlash(event.x, event.y, event.angle);
          break;
        case 'hit':
          this.effects.hitSpark(event.x, event.y);
          this.shipViews.get(event.shipId)?.flash();
          if (event.kind === 'player') this.shake(0.22, 6);
          break;
        case 'destroyed':
          this.effects.explosion(event.x, event.y, event.kind, this.headings.get(event.shipId) ?? 0, 1);
          this.headings.delete(event.shipId);
          break;
        case 'chaser_impact':
          this.effects.explosion(event.x, event.y, 'chaser', 0, 1.25);
          this.shake(0.35, 12);
          break;
        case 'splash':
          this.effects.splash(event.x, event.y);
          break;
        case 'island_hit':
          this.effects.hitSpark(event.x, event.y);
          break;
        case 'bump':
        case 'spawn':
        case 'score':
        case 'ended':
          break;
      }
    }
  }

  animate(dt: number): void {
    this.sceneTime += dt;
    this.arenaLayer.animate(this.sceneTime);
    this.effects.update(dt);
    for (const view of this.shipViews.values()) view.animate(dt);
    this.animateShake(dt);
  }

  private shake(seconds: number, strength: number): void {
    this.shakeRemaining = Math.max(this.shakeRemaining, seconds);
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  private animateShake(dt: number): void {
    if (this.shakeRemaining <= 0) {
      if (this.root.x !== 0 || this.root.y !== 0) this.root.position.set(0, 0);
      return;
    }
    this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
    const falloff = this.shakeRemaining === 0 ? 0 : this.shakeRemaining / 0.35;
    const amplitude = this.shakeStrength * Math.min(1, falloff);
    this.root.position.set(this.shakeRandom.range(-amplitude, amplitude), this.shakeRandom.range(-amplitude, amplitude));
    if (this.shakeRemaining === 0) this.shakeStrength = 0;
  }

  reset(): void {
    this.shakeRemaining = 0;
    this.shakeStrength = 0;
    this.root.position.set(0, 0);
    for (const view of this.shipViews.values()) {
      this.shipLayer.removeChild(view);
      view.destroy();
    }
    this.shipViews.clear();
    this.headings.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.sceneTime = 0;
  }

  destroy(): void {
    this.reset();
    this.projectiles.destroy();
    this.effects.destroy();
    this.arenaLayer.destroy();
    this.shipLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }

  private createShipView(ship: Ship): ShipView {
    const view = new ShipView(this.atlases.ships, this.atlases.ui, ship, this.appearance);
    this.shipLayer.addChild(view);
    this.shipViews.set(ship.id, view);
    return view;
  }
}
