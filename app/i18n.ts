import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { languages, defaultLanguage, fallbackLanguage } from '../i18n/settings'

// Import translations directly
import enTranslations from '../public/locales/en/common.json'
import heTranslations from '../public/locales/he/common.json'

// Initialize i18next with simplified configuration
i18n
  .use(initReactI18next)
  .init({
    debug: false,
    lng: defaultLanguage, // Start with default language
    fallbackLng: fallbackLanguage,
    supportedLngs: languages,
    ns: ['common'],
    defaultNS: 'common',
    resources: {
      en: {
        common: enTranslations
      },
      he: {
        common: heTranslations
      }
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
    initImmediate: true,
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