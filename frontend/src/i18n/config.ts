import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-loader';

// Import local translation files (for offline/development)
import enTranslations from '../locales/en.json';
import ptBRTranslations from '../locales/pt-BR.json';

const resources = {
  en: { common: enTranslations },
  'pt-BR': { common: ptBRTranslations },
};

i18n
  // Load translations from backend if available (HTTP backend)
  .use(HttpBackend)
  // Use language detector to auto-detect user language
  .use(LanguageDetector)
  // Integrate with React
  .use(initReactI18next)
  .init({
    // Fallback language if detection fails
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common'],

    // Resources for offline/development (loaded locally)
    resources,

    // Language detector options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    // Backend options (for loading from API)
    backend: {
      loadPath: '/api/v1/translations/:lng/:ns',
      // Disable if API is not available
      enabled: typeof window !== 'undefined',
    },

    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
      formatSeparator: ',',
    },

    // React-specific options
    react: {
      useSuspense: true, // Use Suspense for loading translations
      transEmptyNodeValue: '', // Return empty string for empty translation
    },

    // Disable warnings in development
    saveMissing: true,
    saveMissingTo: 'fallback',

    // Debug mode (set to true to see i18n logs)
    debug: false,

    // Plural rules
    pluralSeparator: '_',
    contextSeparator: '_',
  });

export default i18n;
