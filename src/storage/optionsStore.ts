import { useSyncExternalStore } from 'react';
import {
  DEFAULT_PLAYER_OPTIONS,
  isWithinLimits,
  OPTION_LIMITS,
  type PlayerOptions,
  type SteeringMode,
} from '@/game/config/gameplayConfig';
import { isLanguageCode, type LanguageCode } from '@/i18n/locales';
import { isRecord, readJson, STORAGE_KEYS, writeJson } from './localStore';

type StoredOptions = Omit<PlayerOptions, 'steering' | 'language'> & {
  steering?: SteeringMode;
  language?: LanguageCode;
};

function isSteeringMode(value: unknown): value is SteeringMode {
  return value === 'keyboard' || value === 'mouse';
}

function isStoredOptions(value: unknown): value is StoredOptions {
  return (
    isRecord(value) &&
    typeof value.sessionSeconds === 'number' &&
    typeof value.spawnIntervalSeconds === 'number' &&
    isWithinLimits(value.sessionSeconds, OPTION_LIMITS.sessionSeconds) &&
    isWithinLimits(value.spawnIntervalSeconds, OPTION_LIMITS.spawnIntervalSeconds) &&
    (value.steering === undefined || isSteeringMode(value.steering)) &&
    (value.language === undefined || isLanguageCode(value.language))
  );
}

function isPlayerOptions(value: unknown): value is PlayerOptions {
  return isStoredOptions(value) && isSteeringMode(value.steering) && isLanguageCode(value.language);
}

function readStoredOptions(): PlayerOptions {
  const stored = readJson(STORAGE_KEYS.options, isStoredOptions);
  if (!stored) return DEFAULT_PLAYER_OPTIONS;
  return {
    ...stored,
    steering: stored.steering ?? DEFAULT_PLAYER_OPTIONS.steering,
    language: stored.language ?? DEFAULT_PLAYER_OPTIONS.language,
  };
}

function toStoredOptions(options: PlayerOptions): StoredOptions {
  const { language, ...rest } = options;
  return language === DEFAULT_PLAYER_OPTIONS.language ? rest : { ...rest, language };
}

let current: PlayerOptions = readStoredOptions();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlayerOptions(): PlayerOptions {
  return current;
}

export function savePlayerOptions(options: PlayerOptions): boolean {
  if (!isPlayerOptions(options)) return false;
  current = { ...options };
  writeJson(STORAGE_KEYS.options, toStoredOptions(current));
  for (const listener of listeners) listener();
  return true;
}

export function usePlayerOptions(): PlayerOptions {
  return useSyncExternalStore(subscribe, getPlayerOptions, getPlayerOptions);
}

export interface OptionValidation {
  sessionSeconds: string | null;
  spawnIntervalSeconds: string | null;
}

export function validatePlayerOptions(options: PlayerOptions): OptionValidation {
  const session = OPTION_LIMITS.sessionSeconds;
  const spawn = OPTION_LIMITS.spawnIntervalSeconds;
  return {
    sessionSeconds: isWithinLimits(options.sessionSeconds, session)
      ? null
      : `Game session time must be between ${session.min} and ${session.max} seconds.`,
    spawnIntervalSeconds: isWithinLimits(options.spawnIntervalSeconds, spawn)
      ? null
      : `Enemy spawn time must be between ${spawn.min} and ${spawn.max} seconds.`,
  };
}
