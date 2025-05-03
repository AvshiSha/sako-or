import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { languages, defaultLanguage, fallbackLanguage } from '../i18n/settings'

// Import translations directly
import enTranslations from '../public/locales/en/common.json'
import heTranslations from '../public/locales/he/common.json'

// Function to get language from URL path
const getLanguageFromPath = () => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname
    const match = pathname.match(/^\/([a-z]{2})/);
    const lang = match ? match[1] : defaultLanguage;
    console.log('Detected language from path:', lang);
    return lang;
  }
  return defaultLanguage
}

// Function to get base URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    debug: true,
    lng: getLanguageFromPath(),
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
    saveMissing: true,
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation key: ${key} in language ${lng} and namespace ${ns}`);
    },
    appendNamespaceToMissingKey: false,
    parseMissingKeyHandler: (key) => {
      console.warn(`Missing translation key: ${key}`);
      return key;
    },
    detection: {
      order: ['path', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['cookie']
    }
  }, (err) => {
    if (err) {
      console.error('i18n initialization error:', err);
    } else {
      console.log('i18n initialized successfully');
      console.log('Current language:', i18n.language);
      console.log('Available languages:', i18n.languages);
      console.log('Available namespaces:', i18n.options.ns);
    }
  });

// Ensure language is set correctly on initialization
const currentLanguage = getLanguageFromPath();
if (i18n.language !== currentLanguage) {
  i18n.changeLanguage(currentLanguage).catch(err => {
    console.error('Error changing language:', err);
  });
}

// Add event listeners for debugging
i18n.on('languageChanged', (lng) => {
  console.log('Language changed to:', lng);
});

i18n.on('loaded', (loaded) => {
  console.log('Translations loaded:', loaded);
  console.log('Available resources:', i18n.getResourceBundle(i18n.language, 'common'));
});

i18n.on('failedLoading', (lng, ns, msg) => {
  console.error('Failed loading translations:', { lng, ns, msg });
});

i18n.on('initialized', () => {
  console.log('i18n fully initialized');
});

// Force reload translations
const reloadTranslations = async () => {
  try {
    console.log('Reloading translations...');
    await i18n.reloadResources();
    console.log('Translations reloaded successfully');
  } catch (error) {
    console.error('Error reloading translations:', error);
  }
};

// Initial reload
reloadTranslations();

export default i18n 