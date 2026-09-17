import { useMemo } from 'react';
import { useAppAudio } from './audioContext';

export interface UiSounds {
  click: () => void;
  back: () => void;
  open: () => void;
  close: () => void;
}

export function useUiSounds(): UiSounds {
  const { engine } = useAppAudio();
  return useMemo(
    () => ({
      click: () => engine.play('uiClick', { volume: 0.5 }),
      back: () => engine.play('uiBack', { volume: 0.5 }),
      open: () => engine.play('uiOpen', { volume: 0.5 }),
      close: () => engine.play('uiClose', { volume: 0.5 }),
    }),
    [engine],
  );
}
