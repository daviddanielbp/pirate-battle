import { createContext, useContext } from 'react';
import type { AudioEngine, AudioSettings } from '@/game/audio/audioEngine';

export interface AudioContextValue {
  engine: AudioEngine;
  settings: AudioSettings;
  updateSettings: (settings: AudioSettings) => void;
}

export const AppAudioContext = createContext<AudioContextValue | null>(null);

export function useAppAudio(): AudioContextValue {
  const value = useContext(AppAudioContext);
  if (!value) throw new Error('Audio context is not available');
  return value;
}
