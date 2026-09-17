export const STORAGE_KEYS = {
  options: 'pirate-battle.options.v1',
  audio: 'pirate-battle.audio.v1',
  player: 'pirate-battle.player.v1',
  lastResult: 'pirate-battle.last-result.v1',
  pendingSubmissions: 'pirate-battle.pending-submissions.v1',
  mockDatabase: 'pirate-battle.mock-database.v1',
  networkScenario: 'pirate-battle.network-scenario.v1',
  screen: 'pirate-battle.screen.v1',
  progress: 'pirate-battle.progress.v1',
  lastRewards: 'pirate-battle.last-rewards.v1',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: StorageKey, validate: (value: unknown) => value is T): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeJson(key: StorageKey, value: unknown): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function removeKey(key: StorageKey): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    return;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
