import { DEFAULT_LANGUAGE, type LanguageCode } from '@/i18n/locales';

export interface WeaponConfig {
  damage: number;
  projectileSpeed: number;
  projectileLifetimeSeconds: number;
  projectileRadius: number;
  cooldownSeconds: number;
  projectileCount: number;
  projectileSpacing: number;
  sideShots: boolean;
}

export type BroadsideConfig = WeaponConfig;

export interface RegenerationConfig {
  healthPerSecond: number;
  minimumSpeed: number;
}

export interface ShipMotionConfig {
  maxSpeed: number;
  acceleration: number;
  drag: number;
  rotationSpeed: number;
}

export interface ShipHitboxConfig {
  radius: number;
  halfLength: number;
}

export interface PlayerConfig {
  maxHealth: number;
  motion: ShipMotionConfig;
  hitbox: ShipHitboxConfig;
  frontCannon: WeaponConfig;
  broadside: BroadsideConfig;
  regeneration: RegenerationConfig;
}

export interface ChaserConfig {
  maxHealth: number;
  motion: ShipMotionConfig;
  hitbox: ShipHitboxConfig;
  contactDamage: number;
}

export interface ShooterConfig {
  maxHealth: number;
  motion: ShipMotionConfig;
  hitbox: ShipHitboxConfig;
  attackRange: number;
  preferredDistance: number;
  aimToleranceRadians: number;
  cannon: WeaponConfig;
}

export interface SpawnDistribution {
  chaser: number;
  shooter: number;
}

export interface SpawnConfig {
  intervalSeconds: number;
  initialDelaySeconds: number;
  maxEnemies: number;
  minDistanceFromPlayer: number;
  distribution: SpawnDistribution;
}

export interface SessionConfig {
  durationSeconds: number;
}

export interface GameplayConfig {
  session: SessionConfig;
  spawn: SpawnConfig;
  player: PlayerConfig;
  chaser: ChaserConfig;
  shooter: ShooterConfig;
  fixedStepSeconds: number;
}

export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10, fallback: 120 },
  spawnIntervalSeconds: { min: 1, max: 10, step: 1, fallback: 3 },
} as const;

export const DEFAULT_GAMEPLAY_CONFIG: GameplayConfig = {
  session: { durationSeconds: OPTION_LIMITS.sessionSeconds.fallback },
  spawn: {
    intervalSeconds: OPTION_LIMITS.spawnIntervalSeconds.fallback,
    initialDelaySeconds: 3,
    maxEnemies: 6,
    minDistanceFromPlayer: 460,
    distribution: { chaser: 0.55, shooter: 0.45 },
  },
  player: {
    maxHealth: 100,
    motion: { maxSpeed: 205, acceleration: 320, drag: 1.4, rotationSpeed: 2.7 },
    hitbox: { radius: 21, halfLength: 32 },
    frontCannon: {
      damage: 40,
      projectileSpeed: 560,
      projectileLifetimeSeconds: 1.1,
      projectileRadius: 5,
      cooldownSeconds: 0.4,
      projectileCount: 1,
      projectileSpacing: 14,
      sideShots: false,
    },
    broadside: {
      damage: 25,
      projectileSpeed: 480,
      projectileLifetimeSeconds: 0.85,
      projectileRadius: 5,
      cooldownSeconds: 1.2,
      projectileCount: 3,
      projectileSpacing: 20,
      sideShots: false,
    },
    regeneration: { healthPerSecond: 0, minimumSpeed: 40 },
  },
  chaser: {
    maxHealth: 50,
    motion: { maxSpeed: 150, acceleration: 280, drag: 1.6, rotationSpeed: 2.3 },
    hitbox: { radius: 21, halfLength: 32 },
    contactDamage: 20,
  },
  shooter: {
    maxHealth: 80,
    motion: { maxSpeed: 105, acceleration: 170, drag: 1.5, rotationSpeed: 1.8 },
    hitbox: { radius: 21, halfLength: 32 },
    attackRange: 400,
    preferredDistance: 270,
    aimToleranceRadians: 0.22,
    cannon: {
      damage: 8,
      projectileSpeed: 380,
      projectileLifetimeSeconds: 1.25,
      projectileRadius: 5,
      cooldownSeconds: 1.8,
      projectileCount: 1,
      projectileSpacing: 14,
      sideShots: false,
    },
  },
  fixedStepSeconds: 1 / 60,
};

export type SteeringMode = 'keyboard' | 'mouse';

export interface PlayerOptions {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
  steering: SteeringMode;
  language: LanguageCode;
}

export const DEFAULT_PLAYER_OPTIONS: PlayerOptions = {
  sessionSeconds: OPTION_LIMITS.sessionSeconds.fallback,
  spawnIntervalSeconds: OPTION_LIMITS.spawnIntervalSeconds.fallback,
  steering: 'keyboard',
  language: DEFAULT_LANGUAGE,
};

export function applyPlayerOptions(base: GameplayConfig, options: PlayerOptions): GameplayConfig {
  return {
    ...base,
    session: { ...base.session, durationSeconds: options.sessionSeconds },
    spawn: { ...base.spawn, intervalSeconds: options.spawnIntervalSeconds },
  };
}

export function isWithinLimits(value: number, limits: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= limits.min && value <= limits.max;
}
