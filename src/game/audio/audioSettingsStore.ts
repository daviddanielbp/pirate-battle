import { isRecord, readJson, STORAGE_KEYS, writeJson } from '@/storage/localStore';
import type { AudioSettings } from './audioEngine';

const DEFAULT_SETTINGS: AudioSettings = { volume: 0.8, muted: false };

function isAudioSettings(value: unknown): value is AudioSettings {
  return (
    isRecord(value) &&
    typeof value.volume === 'number' &&
    value.volume >= 0 &&
    value.volume <= 1 &&
    typeof value.muted === 'boolean'
  );
}

export function loadAudioSettings(): AudioSettings {
  return readJson(STORAGE_KEYS.audio, isAudioSettings) ?? DEFAULT_SETTINGS;
}

export function saveAudioSettings(settings: AudioSettings): void {
  writeJson(STORAGE_KEYS.audio, settings);
}
