import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { languages, defaultLanguage, fallbackLanguage } from '../i18n/settings'

// Import translations directly
import enTranslations from '../public/locales/en/common.json'
import heTranslations from '../public/locales/he/common.json'

// Simplified language detection
const getLanguageFromPath = () => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname
    // Check if path starts with a language code
    const match = pathname.match(/^\/([a-z]{2})(\/|$)/);
    if (match && languages.includes(match[1] as any)) {
      return match[1];
    }
    // Default to English for root path
    return defaultLanguage;
  }
  return defaultLanguage
}

// Initialize i18next with simplified configuration
i18n
  .use(initReactI18next)
  .init({
    debug: false, // Disable debug to reduce console noise
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
      useSuspense: false, // Important: disable suspense to prevent loading issues
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
    saveMissing: false, // Disable missing key saving
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation key: ${key} in language ${lng} and namespace ${ns}`);
    },
    appendNamespaceToMissingKey: false,
    parseMissingKeyHandler: (key) => {
      return key; // Return the key as fallback
    }
  }, (err) => {
    if (err) {
      console.error('i18n initialization error:', err);
    } else {
      console.log('i18n initialized successfully with language:', i18n.language);
    }
  });

// Set language after initialization
const setInitialLanguage = () => {
  const detectedLanguage = getLanguageFromPath();
  if (i18n.language !== detectedLanguage) {
    i18n.changeLanguage(detectedLanguage).catch(err => {
      console.error('Error changing language:', err);
    });
  }
};

// Call this after a short delay to ensure i18n is ready
if (typeof window !== 'undefined') {
  setTimeout(setInitialLanguage, 100);
}

export default i18n 