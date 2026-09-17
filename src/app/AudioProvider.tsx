import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AudioEngine, UI_SOUNDS, type AudioSettings } from '@/game/audio/audioEngine';
import { loadAudioSettings, saveAudioSettings } from '@/game/audio/audioSettingsStore';
import { AppAudioContext, type AudioContextValue } from './audioContext';

export function AudioProvider({ children }: { children: ReactNode }): ReactNode {
  const [engine] = useState(() => new AudioEngine());
  const [settings, setSettings] = useState<AudioSettings>(() => loadAudioSettings());

  useEffect(() => {
    engine.configure(settings);
  }, [engine, settings]);

  useEffect(() => {
    const unlock = (): void => {
      engine.unlock();
      engine.preload(UI_SOUNDS);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [engine]);

  const value = useMemo<AudioContextValue>(
    () => ({
      engine,
      settings,
      updateSettings: (next) => {
        saveAudioSettings(next);
        setSettings(next);
      },
    }),
    [engine, settings],
  );

  return <AppAudioContext.Provider value={value}>{children}</AppAudioContext.Provider>;
}
