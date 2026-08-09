import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { languages } from '@/i18n/settings'

interface ContactLayoutProps {
  children: React.ReactNode
  params: Promise<{ lng: string }>
}

// Hardcoded translations for metadata (matching contact page)
const translations = {
  en: {
    title: 'Contact SAKO-OR',
    subtitle: 'Get in touch with our team',
    description: 'We\'d love to hear from you. Send us a message and we\'ll respond as soon as possible.',
  },
  he: {
    title: 'צור קשר',
    subtitle: 'צרו קשר עם הצוות שלנו',
    description: 'נשמח לשמוע מכם. שלחו לנו הודעה ונחזור אליכם בהקדם האפשרי.',
  }
}

// Generate metadata for contact page
export async function generateMetadata({
  params,
}: ContactLayoutProps): Promise<Metadata> {
  const { lng } = await params
  const locale = lng as 'en' | 'he'
  const t = translations[locale as keyof typeof translations]

  const title = `${t.title} | SAKO-OR`
  const description = t.description

  const url = `/${lng}/contact`

  // Build alternate locales
  const alternateLocales = languages
    .filter(l => l !== locale)
    .map(altLng => ({
      locale: altLng,
      url: `/${altLng}/contact`,
    }))

  return buildMetadata({
    title,
    description,
    url,
    type: 'website',
    locale,
    alternateLocales,
  })
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
