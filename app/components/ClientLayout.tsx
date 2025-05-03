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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        console.log('Starting language initialization...');
        console.log('Current i18n state:', {
          language: i18next.language,
          languages: i18next.languages
        });

        // Check if language needs to be changed
        if (i18next.language !== lng) {
          console.log(`Changing language from ${i18next.language} to ${lng}`);
          await i18next.changeLanguage(lng);
          console.log('Language changed successfully');
        }

        // Store the language in localStorage for persistence
        localStorage.setItem('i18nextLng', lng);
        console.log('Language stored in localStorage:', lng);

        // Mark as initialized
        setIsInitialized(true);
        setError(null);
      } catch (error) {
        console.error('Error initializing language:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    initializeLanguage();
  }, [lng]);

  // Show loading state or error instead of returning null
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading translations...</p>
          {error && (
            <p className="text-red-500 mt-2">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18next}>
      <Navigation />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </I18nextProvider>
  )
} 