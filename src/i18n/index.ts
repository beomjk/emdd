import { messages as en } from './en.js';
import { messages as ko } from './ko.js';

export type Locale = 'en' | 'ko';

const MESSAGES: Record<Locale, Record<string, string>> = { en, ko };
const VALID_LOCALES = new Set<string>(['en', 'ko']);

let currentLocale: Locale = 'en';

export function getLocale(override?: string): Locale {
  if (override && VALID_LOCALES.has(override)) return override as Locale;
  if (override) return 'en'; // invalid locale -> fallback
  const env = process.env.EMDD_LANG;
  if (env && VALID_LOCALES.has(env)) return env as Locale;
  return 'en';
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function t(key: string, vars?: Record<string, string>): string {
  const msg = MESSAGES[currentLocale]?.[key];
  if (!msg) return key; // fallback: return key itself
  if (!vars) return msg;
  return msg.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
}
