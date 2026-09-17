import type { GameplayConfig } from '../config/gameplayConfig';
import type { SimulationEvent } from '../core/entities';
import type { MatchSimulation } from '../core/simulation';
import type { SoundName } from '../assets/manifest';
import type { AudioEngine } from './audioEngine';

const CANNON_SHOTS: readonly SoundName[] = ['cannonFire1', 'cannonFire2', 'cannonFire3'];
const WOOD_HITS: readonly SoundName[] = ['woodHit1', 'woodHit2'];
const WATER_HITS: readonly SoundName[] = ['waterHit1', 'waterHit2'];
const EXPLOSIONS: readonly SoundName[] = ['shipExplosion1', 'shipExplosion2'];
const OCEAN_VOLUME = 0.35;
const SAILING_VOLUME = 0.5;

function pick(list: readonly SoundName[]): SoundName {
  return list[Math.floor(Math.random() * list.length)] ?? list[0] ?? 'cannonFire1';
}

export class BattleAudio {
  private readonly engine: AudioEngine;
  private readonly config: GameplayConfig;
  private lastSplashAt = -1;
  private lastBumpAt = -1;
  private warnedTime = false;
  private warnedHealth = false;
  private active = false;

  constructor(engine: AudioEngine, config: GameplayConfig) {
    this.engine = engine;
    this.config = config;
  }

  start(): void {
    this.active = true;
    this.engine.play('gameStart', { volume: 0.7 });
    this.engine.startLoop('oceanLoop', OCEAN_VOLUME);
    this.engine.startLoop('sailingLoop', 0);
  }

  pause(): void {
    if (!this.active) return;
    this.engine.play('gamePause', { volume: 0.6 });
    this.engine.setLoopVolume('oceanLoop', 0, 0.05);
    this.engine.setLoopVolume('sailingLoop', 0, 0.05);
  }

  resume(): void {
    if (!this.active) return;
    this.engine.setLoopVolume('oceanLoop', OCEAN_VOLUME);
    this.engine.play('gameResume', { volume: 0.6 });
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.engine.stopLoop('oceanLoop');
    this.engine.stopLoop('sailingLoop');
  }

  handle(events: readonly SimulationEvent[], simulation: MatchSimulation): void {
    if (!this.active) return;
    const now = simulation.elapsed;
    const player = simulation.player;
    const speedRatio = player.speed / Math.max(1, this.config.player.motion.maxSpeed);
    this.engine.setLoopVolume('sailingLoop', speedRatio * SAILING_VOLUME);
    for (const event of events) {
      switch (event.type) {
        case 'fire':
          if (event.slot === 'front') this.engine.play(pick(CANNON_SHOTS), { volume: event.kind === 'player' ? 0.8 : 0.45 });
          else this.engine.play('cannonBroadside', { volume: 0.8 });
          break;
        case 'hit':
          this.engine.play(pick(WOOD_HITS), { volume: event.kind === 'player' ? 0.9 : 0.6 });
          if (event.kind === 'player' && !this.warnedHealth && event.health <= player.maxHealth * 0.25) {
            this.warnedHealth = true;
            this.engine.play('healthLow', { volume: 0.8 });
          }
          break;
        case 'destroyed':
          this.engine.play(pick(EXPLOSIONS), { volume: 0.9 });
          this.engine.play('shipSinking', { volume: 0.5 });
          break;
        case 'chaser_impact':
          this.engine.play('shipCollision', { volume: 0.9 });
          this.engine.play('shipExplosion2', { volume: 0.9 });
          break;
        case 'island_hit':
          if (now - this.lastSplashAt > 0.08) {
            this.lastSplashAt = now;
            this.engine.play(pick(WATER_HITS), { volume: 0.45 });
          }
          break;
        case 'splash':
          break;
        case 'bump':
          if (event.kind === 'player' && now - this.lastBumpAt > 0.5) {
            this.lastBumpAt = now;
            this.engine.play('shipCollision', { volume: 0.5 });
          }
          break;
        case 'score':
          this.engine.play('scorePoint', { volume: 0.7 });
          break;
        case 'ended':
          this.engine.play(event.reason === 'time_up' ? 'gameComplete' : 'gameOver', { volume: 0.8 });
          break;
        case 'spawn':
          break;
      }
    }
    if (!this.warnedTime && simulation.remainingSeconds <= 10 && simulation.status === 'running') {
      this.warnedTime = true;
      this.engine.play('timeWarning', { volume: 0.8 });
    }
  }
}
