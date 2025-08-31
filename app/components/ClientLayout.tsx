'use client'

import { I18nextProvider } from 'react-i18next'
import i18next from '../i18n'
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
  const [i18nInstance, setI18nInstance] = useState<typeof i18next | null>(null);

  useEffect(() => {
    console.log('ClientLayout: Initializing with lng:', lng);
    
    // Set language direction on document
    const direction = lng === 'he' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', lng);
    
    const initializeLanguage = async () => {
      try {
        // Ensure i18next is initialized
        if (!i18next.isInitialized) {
          await i18next.init();
        }
        
        // Set the language and wait for it to load
        if (i18next.language !== lng) {
          console.log('ClientLayout: Setting language to', lng);
          await i18next.changeLanguage(lng);
        }
        
        // Wait for translations to be loaded
        await i18next.loadNamespaces('common');
        
        console.log('ClientLayout: Language and translations loaded successfully');
        setI18nInstance(i18next);
        setIsInitialized(true);
      } catch (error) {
        console.error('ClientLayout: Error setting language:', error);
        // Still set initialized to true to prevent infinite loading
        setI18nInstance(i18next);
        setIsInitialized(true);
      }
    };
    
    // Add a timeout to prevent long loading
    const timeout = setTimeout(() => {
      console.log('ClientLayout: Timeout reached, forcing initialization');
      setI18nInstance(i18next);
      setIsInitialized(true);
    }, 2000); // Increased timeout to allow translations to load
    
    initializeLanguage().finally(() => {
      clearTimeout(timeout);
    });
  }, [lng]);

  // Show loading state while translations are loading
  if (!isInitialized || !i18nInstance) {
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
    <I18nextProvider i18n={i18nInstance}>
      <div className={`flex flex-col min-h-screen ${lng === 'he' ? 'rtl' : 'ltr'}`}>
        <Navigation />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </I18nextProvider>
  )
} 