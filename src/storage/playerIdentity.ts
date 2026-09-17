import { isRecord, readJson, STORAGE_KEYS, writeJson } from './localStore';

export interface PlayerIdentity {
  id: string;
  name: string;
}

const DEFAULT_NAME = 'Captain Jack';

function isIdentity(value: unknown): value is PlayerIdentity {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && value.id.length > 0;
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const segment = (): string => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${segment()}${segment()}-${segment()}-${segment()}-${segment()}-${segment()}${segment()}${segment()}`;
}

export function loadPlayerIdentity(): PlayerIdentity {
  const stored = readJson(STORAGE_KEYS.player, isIdentity);
  if (stored) return stored;
  const configuredName = import.meta.env.VITE_PLAYER_NAME?.trim() ?? '';
  const created: PlayerIdentity = {
    id: `player-${createId()}`,
    name: configuredName.length > 0 ? configuredName : DEFAULT_NAME,
  };
  writeJson(STORAGE_KEYS.player, created);
  return created;
}
