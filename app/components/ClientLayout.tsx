'use client'

import { I18nextProvider } from 'react-i18next'
import i18next from '../../i18n'
import Navigation from './Navigation'
import Footer from './Footer'
import { useEffect, useState } from 'react'

export default function ClientLayout({
  children,
  lng
}: {
  children: React.ReactNode
  lng: string
}) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      // Set the language synchronously
      if (i18next.language !== lng) {
        i18next.changeLanguage(lng);
      }
      
      // Mark as initialized immediately
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing language:', error);
      // Still mark as initialized to prevent infinite loading
      setIsInitialized(true);
    }
  }, [lng]);

  // Show loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading translations...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18next}>
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </I18nextProvider>
  )
} 