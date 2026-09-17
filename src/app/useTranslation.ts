import { createContext, useContext } from 'react';
import type { LanguageCode, Translate } from '@/i18n';

export interface LanguageContextValue {
  language: LanguageCode;
  t: Translate;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useTranslation(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('Language context is not available');
  return value;
}
