import { getLocales } from 'expo-localization';
import en from './en';
import tr, { Messages } from './tr';

export const LOCALES = { tr, en } satisfies Record<string, Messages>;
export type Locale = keyof typeof LOCALES;
export type LanguagePref = Locale | 'system';
export const LOCALE_NAMES: Record<Locale, string> = { tr: 'Türkçe', en: 'English' };

export function resolveLocale(pref: LanguagePref): Locale {
  if (pref !== 'system') return pref;
  try {
    for (const l of getLocales()) {
      const code = l.languageCode as Locale | null;
      if (code && code in LOCALES) return code;
    }
  } catch {
    // yoksay
  }
  return 'tr';
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type TKey = Paths<Messages>;

export function translate(locale: Locale, key: TKey, params?: Record<string, string | number>): string {
  const parts = (key as string).split('.');
  let node: unknown = LOCALES[locale];
  for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
  if (typeof node !== 'string') {
    // Eksik çeviri: Türkçeye düş, yoksa anahtarı göster
    let fb: unknown = tr;
    for (const p of parts) fb = (fb as Record<string, unknown> | undefined)?.[p];
    node = typeof fb === 'string' ? fb : key;
  }
  let s = node as string;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
