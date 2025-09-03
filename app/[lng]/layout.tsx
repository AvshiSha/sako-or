import { languages, isRTL, getLanguageDirection } from '../../i18n/settings'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'

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
  
  // Validate language parameter
  if (!languages.includes(lng as any)) {
    throw new Error(`Unsupported language: ${lng}`)
  }
  
  // Determine direction based on language
  const direction = getLanguageDirection(lng as any)

  return (
    <div 
      className={`flex flex-col min-h-screen ${direction}`}
      dir={direction}
      lang={lng}
    >
      <Navigation lng={lng} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer lng={lng} />
    </div>
  )
}
