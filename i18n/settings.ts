export const languages = ['en', 'he'] as const
export type Language = typeof languages[number]

export const defaultLanguage = 'en'
export const fallbackLanguage = 'en'

// Language metadata for future extensibility
export const languageMetadata = {
  en: {
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    flag: '🇺🇸'
  },
  he: {
    name: 'Hebrew',
    nativeName: 'עברית',
    direction: 'rtl',
    flag: '🇮🇱'
  }
} as const

// Helper functions for language handling
export const isRTL = (lng: Language): boolean => languageMetadata[lng].direction === 'rtl'
export const getLanguageName = (lng: Language): string => languageMetadata[lng].name
export const getNativeLanguageName = (lng: Language): string => languageMetadata[lng].nativeName
export const getLanguageDirection = (lng: Language): 'ltr' | 'rtl' => languageMetadata[lng].direction 