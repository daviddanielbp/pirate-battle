import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === 'undefined') return () => undefined;
      const media = window.matchMedia(query);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    () => false,
  );
}

export const COARSE_POINTER_QUERY = '(pointer: coarse)';
export const PORTRAIT_PHONE_QUERY = '(orientation: portrait) and (max-width: 900px)';
