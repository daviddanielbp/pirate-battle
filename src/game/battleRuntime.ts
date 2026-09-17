import { Application, type Ticker } from 'pixi.js';
import type { GameplayConfig } from './config/gameplayConfig';
import { ARENA_HEIGHT, ARENA_WIDTH, type ArenaDefinition } from './core/arena';
import type { EndReason, Projectile, Ship, SimulationEvent } from './core/entities';
import { MatchSimulation } from './core/simulation';
import type { GameAtlases } from './assets/loader';
import { ControlState } from './input/controls';
import { BattleRenderer } from './render/battleRenderer';
import { HudLayer } from './render/hudLayer';
import { DEFAULT_APPEARANCE, type FleetAppearance } from './render/constants';
import type { KillCount } from './progression/progression';
import type { RoundedRect } from './core/arena';
import { fitStage, type StageFit } from './render/stageFitter';
import type { AudioEngine } from './audio/audioEngine';
import { BattleAudio } from './audio/battleAudio';

export type ClockMode = 'auto' | 'manual';
export type PauseReason = 'manual' | 'focus';
export type RuntimeStatus = 'booting' | 'running' | 'paused' | 'ended';

export interface HudSnapshot {
  status: RuntimeStatus;
  pauseReason: PauseReason | null;
  score: number;
  secondsLeft: number;
  elapsedSeconds: number;
  health: number;
  maxHealth: number;
  enemyCount: number;
  endReason: EndReason | null;
  kills: KillCount;
}

export interface DebugShip {
  id: number;
  kind: Ship['kind'];
  x: number;
  y: number;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
}

export interface DebugProjectile {
  id: number;
  faction: Projectile['faction'];
  x: number;
  y: number;
}

export interface DebugState {
  status: RuntimeStatus;
  clock: ClockMode;
  elapsedSeconds: number;
  remainingSeconds: number;
  score: number;
  ships: DebugShip[];
  projectiles: DebugProjectile[];
  cooldowns: Ship['cooldowns'];
  kills: KillCount;
  arena: { width: number; height: number; obstacles: RoundedRect[] };
}

export interface BattleRuntimeOptions {
  host: HTMLElement;
  atlases: GameAtlases;
  config: GameplayConfig;
  arena: ArenaDefinition;
  seed: number;
  clock: ClockMode;
  audio: AudioEngine;
  appearance?: FleetAppearance;
}

const MAX_FRAME_MS = 250;
const STEP_EPSILON_MS = 1e-6;

export class BattleRuntime {
  readonly controls = new ControlState();
  readonly simulation: MatchSimulation;
  private readonly options: BattleRuntimeOptions;
  private readonly listeners = new Set<() => void>();
  private readonly battleAudio: BattleAudio;
  private app: Application | null = null;
  private renderer: BattleRenderer | null = null;
  private hud: HudLayer | null = null;
  private fit: StageFit | null = null;
  private status: RuntimeStatus = 'booting';
  private pauseReason: PauseReason | null = null;
  private clock: ClockMode;
  private accumulator = 0;
  private disposed = false;
  private snapshot: HudSnapshot;
  private detachWindowListeners: (() => void) | null = null;

  constructor(options: BattleRuntimeOptions) {
    this.options = options;
    this.clock = options.clock;
    this.simulation = new MatchSimulation({ config: options.config, arena: options.arena, seed: options.seed });
    this.battleAudio = new BattleAudio(options.audio, options.config);
    this.snapshot = this.buildSnapshot();
  }

  async start(): Promise<void> {
    const app = new Application();
    await app.init({
      resizeTo: this.options.host,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      antialias: false,
      backgroundColor: 0x2f9dd6,
      preference: 'webgl',
      powerPreference: 'high-performance',
    });
    if (this.disposed) {
      app.destroy({ removeView: true }, { children: true });
      return;
    }
    this.app = app;
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.tabIndex = -1;
    this.options.host.appendChild(app.canvas);
    this.renderer = new BattleRenderer(
      app.renderer,
      this.options.atlases,
      this.options.arena,
      ARENA_WIDTH,
      ARENA_HEIGHT,
      this.options.appearance ?? DEFAULT_APPEARANCE,
    );
    this.hud = new HudLayer(this.options.atlases.ui);
    app.stage.addChild(this.renderer.root);
    app.stage.addChild(this.hud.root);
    this.applyFit();
    app.renderer.on('resize', this.onResize);
    app.ticker.maxFPS = 0;
    app.ticker.add(this.onTick);
    this.renderer.sync(this.simulation);
    this.syncHud();
    this.attachWindowListeners();
    this.status = 'running';
    this.battleAudio.start();
    this.publish();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): HudSnapshot => this.snapshot;

  get clockMode(): ClockMode {
    return this.clock;
  }

  toArenaPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const app = this.app;
    const fit = this.fit;
    if (!app || !fit) return null;
    const bounds = app.canvas.getBoundingClientRect();
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    return { x: (localX - fit.offsetX) / fit.scale, y: (localY - fit.offsetY) / fit.scale };
  }

  setClockMode(mode: ClockMode): void {
    this.clock = mode;
    this.accumulator = 0;
  }

  pause(reason: PauseReason): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.pauseReason = reason;
    this.accumulator = 0;
    this.controls.clear();
    this.simulation.clearCommand();
    this.battleAudio.pause();
    this.publish();
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    this.pauseReason = null;
    this.accumulator = 0;
    this.controls.clear();
    this.simulation.clearCommand();
    this.battleAudio.resume();
    this.publish();
  }

  advance(milliseconds: number): void {
    if (this.status !== 'running' || !this.renderer) return;
    this.accumulator += Math.min(milliseconds, this.clock === 'manual' ? milliseconds : MAX_FRAME_MS);
    const stepSeconds = this.options.config.fixedStepSeconds;
    const stepMilliseconds = stepSeconds * 1000;
    this.simulation.setCommand(this.controls.toCommand());
    let steps = 0;
    while (this.accumulator + STEP_EPSILON_MS >= stepMilliseconds && this.simulation.status === 'running') {
      this.simulation.step(stepSeconds);
      this.accumulator = Math.max(0, this.accumulator - stepMilliseconds);
      steps += 1;
    }
    const events = this.simulation.drainEvents();
    this.renderer.sync(this.simulation);
    this.renderer.applyEvents(events);
    this.renderer.animate(steps * stepSeconds);
    this.syncHud();
    this.battleAudio.handle(events, this.simulation);
    if (this.simulation.status === 'ended') {
      this.status = 'ended';
      this.accumulator = 0;
      this.controls.clear();
      this.battleAudio.stop();
    }
    this.publish();
  }

  restorePlayerHealth(): void {
    if (this.status === 'running') this.simulation.player.health = this.simulation.player.maxHealth;
  }

  entityCount(): number {
    return this.simulation.ships.length + this.simulation.projectiles.length;
  }

  debugState(): DebugState {
    const simulation = this.simulation;
    return {
      status: this.status,
      clock: this.clock,
      elapsedSeconds: simulation.elapsed,
      remainingSeconds: simulation.remainingSeconds,
      score: simulation.score,
      ships: simulation.ships.map((ship) => ({
        id: ship.id,
        kind: ship.kind,
        x: ship.x,
        y: ship.y,
        heading: ship.heading,
        speed: ship.speed,
        health: ship.health,
        maxHealth: ship.maxHealth,
      })),
      projectiles: simulation.projectiles.map((projectile) => ({
        id: projectile.id,
        faction: projectile.faction,
        x: projectile.x,
        y: projectile.y,
      })),
      cooldowns: { ...simulation.player.cooldowns },
      kills: { ...simulation.kills },
      arena: {
        width: simulation.geometry.width,
        height: simulation.geometry.height,
        obstacles: simulation.geometry.obstacles.map((rect) => ({ ...rect })),
      },
    };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachWindowListeners?.();
    this.detachWindowListeners = null;
    this.controls.clear();
    this.battleAudio.stop();
    this.listeners.clear();
    const app = this.app;
    this.app = null;
    if (app) {
      app.ticker.remove(this.onTick);
      app.renderer.off('resize', this.onResize);
      this.renderer?.destroy();
      this.renderer = null;
      this.hud?.destroy();
      this.hud = null;
      if (app.canvas.parentNode) app.canvas.parentNode.removeChild(app.canvas);
      app.destroy({ removeView: true }, { children: true, texture: false });
    }
  }

  private readonly onTick = (ticker: Ticker): void => {
    if (this.clock === 'auto' && this.status === 'running') this.advance(ticker.deltaMS);
  };

  private readonly onResize = (): void => {
    this.applyFit();
  };

  private applyFit(): void {
    const app = this.app;
    if (!app) return;
    this.fit = fitStage(app, ARENA_WIDTH, ARENA_HEIGHT);
    const hud = this.hud;
    if (!hud) return;
    hud.root.scale.set(1 / this.fit.scale);
    hud.root.position.set(-this.fit.offsetX / this.fit.scale, -this.fit.offsetY / this.fit.scale);
    hud.layout(this.fit.width, this.fit.height);
  }

  private syncHud(): void {
    const summary = this.simulation.summary();
    this.hud?.update(
      summary.score,
      Math.ceil(summary.remainingSeconds - 1e-6),
      Math.round(summary.playerHealth),
      summary.playerMaxHealth,
    );
  }

  private attachWindowListeners(): void {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') this.pause('focus');
    };
    const onBlur = (): void => this.pause('focus');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    this.detachWindowListeners = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }

  private buildSnapshot(): HudSnapshot {
    const summary = this.simulation.summary();
    return {
      status: this.status,
      pauseReason: this.pauseReason,
      score: summary.score,
      secondsLeft: Math.ceil(summary.remainingSeconds - 1e-6),
      elapsedSeconds: summary.elapsedSeconds,
      health: Math.round(summary.playerHealth),
      maxHealth: summary.playerMaxHealth,
      enemyCount: summary.enemyCount,
      endReason: summary.endReason,
      kills: summary.kills,
    };
  }

  private publish(): void {
    const next = this.buildSnapshot();
    const current = this.snapshot;
    if (
      next.status === current.status &&
      next.pauseReason === current.pauseReason &&
      next.score === current.score &&
      next.secondsLeft === current.secondsLeft &&
      next.health === current.health &&
      next.maxHealth === current.maxHealth &&
      next.enemyCount === current.enemyCount &&
      next.endReason === current.endReason
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

export type { SimulationEvent };
