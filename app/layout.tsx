import './globals.css'
import { Inter } from 'next/font/google'
import { dir } from 'i18next'
import { languages } from '../i18n/settings'
import ClientLayout from './components/ClientLayout'

const inter = Inter({ subsets: ['latin'] })

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }))
}

export default function RootLayout({
  children,
  params: { lng }
}: {
  children: React.ReactNode
  params: { lng: string }
}) {
  return (
    <html lang={lng} dir={dir(lng)} className="light">
      <body className={inter.className}>
        <ClientLayout lng={lng}>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
