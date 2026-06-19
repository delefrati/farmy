import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';

export type LanguageCode = 'en' | 'pt-BR';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
];

/**
 * Hook to manage language/localization
 * Handles language switching, persistence, and fallbacks
 */
export const useLanguage = () => {
  const { i18n, t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(
    (i18n.language as LanguageCode) || 'en'
  );

  // Change language
  const changeLanguage = useCallback(
    async (lang: LanguageCode) => {
      try {
        // Try to load from backend API first
        if (import.meta.env.PROD || process.env.NODE_ENV === 'production') {
          try {
            await fetch(`/api/v1/translations/${lang}/common`)
              .then((res) => res.json())
              .catch(() => null); // Fallback to local if API fails
          } catch (err) {
            console.warn('Failed to load translations from API:', err);
          }
        }

        // Change language in i18n
        await i18n.changeLanguage(lang);
        
        // Save to localStorage
        localStorage.setItem('language', lang);
        localStorage.setItem('language-changed-at', new Date().toISOString());
        
        setCurrentLanguage(lang);
      } catch (err) {
        console.error('Failed to change language:', err);
      }
    },
    [i18n]
  );

  // Get current language info
  const getCurrentLanguageInfo = useCallback(() => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  }, [currentLanguage]);

  // Get language name (translated)
  const getLanguageName = useCallback(
    (lang: LanguageCode, inCurrentLang = true) => {
      const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
      return inCurrentLang ? langInfo?.name : langInfo?.nativeName;
    },
    []
  );

  return {
    currentLanguage,
    changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    getCurrentLanguageInfo,
    getLanguageName,
    t,
    i18n,
  };
};

/**
 * Hook to translate a text string
 * Fallback to English if translation is missing
 */
export const useTranslate = () => {
  const { t, i18n } = useTranslation();

  const translate = useCallback(
    (key: string, defaultValue?: string, options?: any) => {
      const translation = t(key, { defaultValue, ...options });
      
      // If translation is the key itself (not found), log warning
      if (translation === key && typeof window !== 'undefined' && !import.meta.env.PROD) {
        console.warn(`Translation missing for key: ${key}`);
      }

      return translation;
    },
    [t]
  );

  return translate;
};
