import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import { defaultLanguage, fallbackLanguage } from './settings'

i18next
  .use(Backend)
  .use(initReactI18next)
  .init({
    fallbackLng: fallbackLanguage,
    lng: defaultLanguage,
    debug: true,
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    react: {
      useSuspense: false,
    },
  })

export default i18next 