import {
  applyPlayerOptions,
  DEFAULT_GAMEPLAY_CONFIG,
  type GameplayConfig,
  type PlayerOptions,
  type SteeringMode,
} from '@/game/config/gameplayConfig';
import type { ArenaDefinition } from '@/game/core/arena';
import { generateArena } from '@/game/core/arenaGenerator';
import type { EndReason } from '@/game/core/entities';
import { applyLoadout, type MatchLoadout } from '@/game/progression/progression';
import type { MatchConfigSnapshot, MatchRecord } from '@/data/contracts';
import { createId, type PlayerIdentity } from '@/storage/playerIdentity';

export interface MatchSession {
  id: string;
  seed: number;
  config: GameplayConfig;
  arena: ArenaDefinition;
  snapshot: MatchConfigSnapshot;
  loadout: MatchLoadout;
  steering: SteeringMode;
  startedAt: string;
}

export function createMatchSession(options: PlayerOptions, loadout: MatchLoadout, seed: number): MatchSession {
  return {
    id: `match-${createId()}`,
    seed,
    config: applyLoadout(applyPlayerOptions(DEFAULT_GAMEPLAY_CONFIG, options), loadout),
    arena: generateArena(seed),
    snapshot: { sessionSeconds: options.sessionSeconds, spawnIntervalSeconds: options.spawnIntervalSeconds },
    loadout,
    steering: options.steering,
    startedAt: new Date().toISOString(),
  };
}

export function buildMatchRecord(
  session: MatchSession,
  player: PlayerIdentity,
  outcome: { score: number; elapsedSeconds: number; endReason: EndReason },
): MatchRecord {
  return {
    id: session.id,
    playerId: player.id,
    playerName: player.name,
    playedAt: new Date().toISOString(),
    score: outcome.score,
    durationSeconds: Math.round(outcome.elapsedSeconds * 10) / 10,
    endReason: outcome.endReason,
    config: session.snapshot,
    loadout: session.loadout,
  };
}
