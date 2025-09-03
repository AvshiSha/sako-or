import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import { languages, defaultLanguage, fallbackLanguage } from '../i18n/settings'

// Initialize i18next with HTTP backend only
i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    debug: process.env.NODE_ENV === 'development', // Enable debug only in development
    lng: defaultLanguage, // Start with default language
    fallbackLng: fallbackLanguage,
    supportedLngs: languages,
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: '/assets/i18n/{{lng}}.json', // Simplified path
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'span', 'div']
    },
    interpolation: {
      escapeValue: false
    },
    initImmediate: true, // Enable immediate initialization
    load: 'languageOnly',
    saveMissing: process.env.NODE_ENV === 'development', // Save missing keys only in development
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation key: ${key} in language ${lng} and namespace ${ns}`);
      }
    },
    appendNamespaceToMissingKey: false,
    parseMissingKeyHandler: (key) => {
      return key;
    }
  });

export default i18n 