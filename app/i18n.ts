import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import { languages, defaultLanguage, fallbackLanguage } from '../i18n/settings'

// Initialize i18next with HTTP backend only
i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    debug: false, // Disable debug in production
    lng: defaultLanguage, // Start with default language
    fallbackLng: fallbackLanguage,
    supportedLngs: languages,
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: '/public/assets/i18n/{{lng}}.json', // Use the correct path
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p']
    },
    interpolation: {
      escapeValue: false
    },
    initImmediate: true, // Enable immediate initialization
    load: 'languageOnly',
    saveMissing: false,
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation key: ${key} in language ${lng} and namespace ${ns}`);
    },
    appendNamespaceToMissingKey: false,
    parseMissingKeyHandler: (key) => {
      return key;
    }
  });

export default i18n 