'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nextProvider i18n={i18n}>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </I18nextProvider>
      </body>
    </html>
  )
}
