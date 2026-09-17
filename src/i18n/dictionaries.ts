import { en, type MessageKey } from './messages/en';
import { es } from './messages/es';
import { fr } from './messages/fr';
import { ptBR } from './messages/pt-BR';
import { zh } from './messages/zh';
import { format, type MessageParams } from './format';
import type { LanguageCode } from './locales';

export type MessageDictionary = Record<MessageKey, string>;

const DICTIONARIES: Readonly<Record<LanguageCode, Partial<MessageDictionary>>> = {
  en,
  'pt-BR': ptBR,
  es,
  zh,
  fr,
};

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function translate(language: LanguageCode, key: MessageKey, params?: MessageParams): string {
  const template = DICTIONARIES[language][key] ?? en[key];
  return format(template, params);
}
