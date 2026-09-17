import { Assets, Spritesheet, type SpritesheetData, type Texture } from 'pixi.js';
import { ATLAS_SOURCES, type AtlasSource } from './manifest';

export interface GameAtlases {
  ships: Spritesheet;
  tiles: Spritesheet;
  ui: Spritesheet;
}

export interface LoadProgress {
  completed: number;
  total: number;
  ratio: number;
  current: string;
}

export class AssetLoadError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Unable to load ${url}`);
    this.name = 'AssetLoadError';
    this.url = url;
    this.cause = cause;
  }
}

const atlasCache = new Map<AtlasSource['key'], Spritesheet>();
const progressListeners = new Set<(progress: LoadProgress) => void>();
let inFlight: Promise<GameAtlases> | null = null;

async function fetchAtlasData(url: string): Promise<SpritesheetData> {
  let response: Response;
  try {
    response = await fetch(url, { cache: 'force-cache' });
  } catch (error) {
    throw new AssetLoadError(url, error);
  }
  if (!response.ok) throw new AssetLoadError(url, new Error(`HTTP ${response.status}`));
  try {
    return (await response.json()) as SpritesheetData;
  } catch (error) {
    throw new AssetLoadError(url, error);
  }
}

async function loadTexture(url: string): Promise<Texture> {
  try {
    return await Assets.load<Texture>(url);
  } catch (error) {
    throw new AssetLoadError(url, error);
  }
}

async function loadAtlas(source: AtlasSource): Promise<Spritesheet> {
  const cached = atlasCache.get(source.key);
  if (cached) return cached;
  const [data, texture] = await Promise.all([fetchAtlasData(source.json), loadTexture(source.image)]);
  const sheet = new Spritesheet(texture, data);
  await sheet.parse();
  atlasCache.set(source.key, sheet);
  return sheet;
}

export function loadGameAtlases(onProgress?: (progress: LoadProgress) => void): Promise<GameAtlases> {
  if (onProgress) progressListeners.add(onProgress);
  if (inFlight) return inFlight;
  const total = ATLAS_SOURCES.length;
  let completed = 0;
  const report = (current: string): void => {
    const progress: LoadProgress = { completed, total, ratio: completed / total, current };
    for (const listener of progressListeners) listener(progress);
  };
  inFlight = (async () => {
    const loaded = new Map<AtlasSource['key'], Spritesheet>();
    report('Preparing');
    for (const source of ATLAS_SOURCES) {
      report(source.key);
      loaded.set(source.key, await loadAtlas(source));
      completed += 1;
      report(source.key);
    }
    const ships = loaded.get('ships');
    const tiles = loaded.get('tiles');
    const ui = loaded.get('ui');
    if (!ships || !tiles || !ui) throw new AssetLoadError('atlas', new Error('Incomplete atlas set'));
    return { ships, tiles, ui };
  })();
  return inFlight.finally(() => {
    inFlight = null;
    progressListeners.clear();
  });
}

export function getLoadedAtlases(): GameAtlases | null {
  const ships = atlasCache.get('ships');
  const tiles = atlasCache.get('tiles');
  const ui = atlasCache.get('ui');
  return ships && tiles && ui ? { ships, tiles, ui } : null;
}

export function textureFrom(sheet: Spritesheet, name: string): Texture {
  const texture = sheet.textures[name];
  if (!texture) throw new AssetLoadError(name, new Error('Missing atlas frame'));
  return texture;
}
