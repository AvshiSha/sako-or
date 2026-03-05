import { languages, type Language, defaultLanguage, getLanguageDirection } from '../../i18n/settings'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import PromoRibbon from '../components/PromoRibbon'

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }))
}

export default async function LanguageLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params

  // Skip socket.io and other non-language routes
  if (lng === 'socket.io' || lng.startsWith('socket.io')) {
    return null
  }

  // Normalize language: fall back to default for anything unsupported (including file-like paths such as meta.json)
  const normalizedLng: Language = languages.includes(lng as any)
    ? (lng as Language)
    : defaultLanguage

  // Determine direction based on language
  const direction = getLanguageDirection(normalizedLng)

  return (
    <div 
      className={`flex flex-col min-h-screen ${direction}`}
      dir={direction}
      lang={normalizedLng}
    >
      <PromoRibbon lng={normalizedLng} />
      <Navigation lng={normalizedLng} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer lng={normalizedLng} />
    </div>
  )
}

