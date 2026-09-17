import { useEffect, useMemo, type ReactNode } from 'react';
import { translate } from '@/i18n';
import { usePlayerOptions } from '@/storage/optionsStore';
import { LanguageContext, type LanguageContextValue } from './useTranslation';

export function LanguageProvider({ children }: { children: ReactNode }): ReactNode {
  const { language } = usePlayerOptions();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, t: (key, params) => translate(language, key, params) }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
