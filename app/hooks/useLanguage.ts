import { useParams } from 'next/navigation'
import { languages, type Language, languageMetadata, isRTL, getLanguageDirection } from '../../i18n/settings'

export function useLanguage() {
  const params = useParams()
  const lng = params?.lng as Language
  
  // Validate language parameter
  if (!lng || !languages.includes(lng)) {
    throw new Error(`Invalid or missing language parameter: ${lng}`)
  }
  
  const metadata = languageMetadata[lng]
  const direction = getLanguageDirection(lng)
  const isRTLDirection = isRTL(lng)
  
  return {
    lng,
    metadata,
    direction,
    isRTL: isRTLDirection,
    // Helper functions
    t: (key: string, defaultValue?: string) => {
      // This will be enhanced when we integrate with react-i18next
      return defaultValue || key
    }
  }
}
