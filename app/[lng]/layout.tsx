import ClientLayout from '../components/ClientLayout'
import { languages } from '../../i18n/settings'

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }))
}

export default function LanguageLayout({
  children,
  params: { lng }
}: {
  children: React.ReactNode
  params: { lng: string }
}) {
  return (
    <ClientLayout lng={lng}>
      {children}
    </ClientLayout>
  )
}
