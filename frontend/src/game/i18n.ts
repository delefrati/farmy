// Lightweight i18n for the Phaser game layer.
//
// The React app already ships an i18next setup, but the actual gameplay UI is
// rendered inside Phaser scenes where React hooks cannot reach. This module is
// a tiny, framework-free translator usable from anywhere in the game:
//   - the default language follows the browser (navigator.language);
//   - the player's explicit choice is remembered in localStorage;
//   - translations are keyed by their English source string, so any string
//     that is not translated simply renders in English (never a broken key).
//
// Portuguese translations live in locales/pt-BR.json under `gameStrings`, keyed
// by the English source string, so they stay alongside the rest of the locale
// data and can be managed/translated like any other resource.
import ptBR from '../../locales/pt-BR.json';

export type GameLocale = 'en' | 'pt-BR';

const STORAGE_KEY = 'farmy.lang';

const ptStrings: Record<string, string> =
  (ptBR as { gameStrings?: Record<string, string> }).gameStrings ?? {};

const dictionaries: Record<GameLocale, Record<string, string>> = {
  en: {},
  'pt-BR': ptStrings,
};

export const GAME_LOCALES: { code: GameLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português' },
];

const isGameLocale = (value: string | null): value is GameLocale =>
  value === 'en' || value === 'pt-BR';

const detectDefaultLocale = (): GameLocale => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isGameLocale(saved)) {
      return saved;
    }
  }
  const nav =
    typeof navigator !== 'undefined' ? (navigator.language || '').toLowerCase() : '';
  if (nav.startsWith('pt')) {
    return 'pt-BR';
  }
  return 'en';
};

let currentLocale: GameLocale = detectDefaultLocale();
const listeners = new Set<() => void>();

export const getLocale = (): GameLocale => currentLocale;

export const setLocale = (locale: GameLocale): void => {
  if (locale === currentLocale) {
    return;
  }
  currentLocale = locale;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  listeners.forEach((listener) => listener());
};

export const cycleLocale = (): GameLocale => {
  const index = GAME_LOCALES.findIndex((item) => item.code === currentLocale);
  const next = GAME_LOCALES[(index + 1) % GAME_LOCALES.length].code;
  setLocale(next);
  return next;
};

export const getLocaleLabel = (locale: GameLocale = currentLocale): string =>
  GAME_LOCALES.find((item) => item.code === locale)?.label ?? locale;

// Subscribe to language changes; returns an unsubscribe function.
export const onLocaleChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Translate an English source string. Unknown strings fall back to the source
// itself. `{name}` placeholders are replaced with the matching param value.
export const t = (source: string, params?: Record<string, string | number>): string => {
  const dict = dictionaries[currentLocale];
  let result = dict[source] ?? source;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      result = result.split(`{${key}}`).join(String(value));
    }
  }
  return result;
};
