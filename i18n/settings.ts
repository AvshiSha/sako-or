export const languages = ['en', 'he'] as const
export type Language = typeof languages[number]

export const defaultLanguage = 'en'
export const fallbackLanguage = 'en' 