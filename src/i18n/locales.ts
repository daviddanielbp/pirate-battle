export const SUPPORTED_LANGUAGES = ['en', 'pt-BR', 'es', 'zh', 'fr'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_LABELS: Readonly<Record<LanguageCode, string>> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
  zh: '中文',
  fr: 'Français',
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.some((code) => code === value);
}
