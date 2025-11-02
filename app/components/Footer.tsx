'use client'

import Link from 'next/link';
import { FaFacebook, FaInstagram, FaPinterest } from 'react-icons/fa';
import { useState } from 'react';
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal';

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brand: 'SAKO-OR',
    description: 'Discover our curated collection of premium footwear, sourced from Europe\'s finest artisans and China\'s most prestigious manufacturers.',
    navigation: 'Navigation',
    newsletter: 'Newsletter',
    subscribe: 'Subscribe',
    subscribePlaceholder: 'Enter your email',
    subscribeSuccess: 'Thank you for subscribing!',
    home: 'Home',
    newCollection: 'New Collection',
    about: 'About',
    contact: 'Contact',
    copyright: '© 2025 SAKO-OR. All rights reserved.',
    newsletterDescription: 'Subscribe to our newsletter for updates and exclusive offers.',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email address',
    subscriptionError: 'Failed to subscribe. Please try again.',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    termsReturns: 'Terms & Returns'
  },
  he: {
    brand: 'סכו עור',
    description: 'גלה את הקולקציה שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
    navigation: 'ניווט',
    newsletter: 'ניוזלטר',
    subscribe: 'הירשם',
    subscribePlaceholder: 'הזן את האימייל שלך',
    subscribeSuccess: 'תודה שנרשמת!',
    home: 'בית',
    newCollection: 'קולקציה חדשה',
    about: 'אודות',
    contact: 'צור קשר',
    copyright: '© 2025 סכו עור. כל הזכויות שמורות.',
    newsletterDescription: 'הירשמו לעולמנו לקבלת עדכונים בלעדיים, גישה מוקדמת לקולקציה החדשה והמלצות לסגנון מותאמות אישית אלייך',
    emailRequired: 'נדרש אימייל',
    emailInvalid: 'אנא הזן כתובת אימייל תקינה',
    subscriptionError: 'ההרשמה נכשלה. אנא נסה שוב.',
    privacyPolicy: 'מדיניות פרטיות',
    termsOfService: 'תנאי שימוש',
    termsReturns: 'מדיניות החזרות'
  }
}

export default function Footer({ lng }: { lng: string }) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [subscribedEmail, setSubscribedEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  
  const t = translations[lng as keyof typeof translations]
  // const isRTL = lng === 'he'

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous errors
    setEmailError('')
    
    if (!email.trim()) {
      setEmailError(t.emailRequired || 'Email is required')
      return
    }
    
    if (!validateEmail(email.trim())) {
      setEmailError(t.emailInvalid || 'Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSubscribedEmail(email.trim())
        setShowSuccessModal(true)
        setEmail('') // Clear the form
        setEmailError('') // Clear any errors
      } else {
        setEmailError(data.error || t.subscriptionError || 'Failed to subscribe. Please try again.')
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      setEmailError(t.subscriptionError || 'Failed to subscribe. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <footer className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 py-16">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-light tracking-wider mb-6">{t.brand}</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              {t.description}
            </p>
            <div className="flex space-x-6">
              <a
                href="https://www.facebook.com/sakoorbrand"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaFacebook size={20} />
              </a>
              <a
                href="https://www.instagram.com/sako.or/"
                target="_blank"
                rel="https://www.instagram.com/sako.or/"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaInstagram size={20} />
              </a>
              {/* <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaTwitter size={20} />
              </a> */}
              <a
                href="https://pinterest.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaPinterest size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider mb-6">{t.navigation}</h3>
            <ul className="space-y-3">
              <li>
                <Link href={`/${lng}`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t.home}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/collection`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t.newCollection}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/about`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t.about}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/contact`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t.contact}
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider mb-6">{t.newsletter}</h3>
            <p className="text-gray-400 mb-4 text-sm">
              {t.newsletterDescription}
            </p>
            <form onSubmit={handleNewsletterSubmit}>
              <div className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError('') // Clear error when user types
                  }}
                  placeholder={t.subscribePlaceholder}
                  required
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2 bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    emailError ? 'focus:ring-red-500 border-red-500' : 'focus:ring-white'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '...' : t.subscribe}
                </button>
              </div>
              {emailError && (
                <p className="mt-2 text-sm text-red-400">
                  {emailError}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              {t.copyright}
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href={`/${lng}/privacy`} className="text-gray-400 hover:text-white text-sm">
                {t.privacyPolicy}
              </Link>
              <Link href={`/${lng}/terms`} className="text-gray-400 hover:text-white text-sm">
                {t.termsOfService}
              </Link>
              <Link href={`/${lng}/terms-returns`} className="text-gray-400 hover:text-white text-sm">
                {t.termsReturns}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter Success Modal */}
      <NewsletterSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        email={subscribedEmail}
        lng={lng}
      />
    </footer>
  )
} 