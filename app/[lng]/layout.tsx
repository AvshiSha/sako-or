import { languages } from '../../i18n/settings'
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
  
  // Determine direction based on language
  const direction = lng === 'he' ? 'rtl' : 'ltr'

  return (
    <div className={`flex flex-col min-h-screen ${lng === 'he' ? 'rtl' : 'ltr'}`}>
      <Navigation lng={lng} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer lng={lng} />
    </div>
  )
}
