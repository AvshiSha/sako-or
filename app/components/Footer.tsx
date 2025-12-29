'use client'

import Link from 'next/link';
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal';
import { fbqTrackSubscribe } from '@/lib/facebookPixel';
import { languageMetadata } from '../../i18n/settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    brand: 'SAKO OR',
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
    termsReturns: 'Terms & Returns',
    company: 'COMPANY',
    customerSupport: 'CUSTOMER SUPPORT',
    language: 'LANGUAGE',
    terms: 'Terms',
    privacy: 'Privacy',
    accessibility: 'Accessibility',
    hebrew: 'Hebrew',
    english: 'English'
  },
  he: {
    brand: 'SAKO OR',
    description: 'גלי את הקולקציה שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין',
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
    termsReturns: 'מדיניות החזרות',
    company: 'פרטי החברה',
    customerSupport: 'תמיכה ללקוחות',
    language: 'שפה',
    terms: 'תנאים',
    privacy: 'פרטיות',
    accessibility: 'נגישות',
    hebrew: 'עברית',
    english: 'אנגלית'
  }
}

function FooterInner({ lng }: { lng: string }) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [subscribedEmail, setSubscribedEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const t = translations[lng as keyof typeof translations]

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

        fbqTrackSubscribe({
          subscription_type: 'newsletter',
          placement: 'footer_form',
          email: email.trim(),
        })
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

  const handleLanguageChange = (newLanguage: string) => {
    if (!pathname) return
    
    const pathSegments = pathname.split('/')
    if (pathSegments[1] && Object.keys(languageMetadata).includes(pathSegments[1])) {
      pathSegments[1] = newLanguage
    } else {
      pathSegments.splice(1, 0, newLanguage)
    }
    
    const queryString = searchParams?.toString() || ''
    const queryParams = queryString ? `?${queryString}` : ''
    
    const newPath = pathSegments.join('/') + queryParams
    router.push(newPath)
  }

  // Social Media Links
  const socialLinks = {
    instagram: 'https://www.instagram.com/sako.or/',
    facebook: 'https://www.facebook.com/sakoorbrand',
    tiktok: '#', // Placeholder
    whatsapp: 'https://wa.me/972504487979'
  }

  return (
    <>
      {/* Mobile Footer */}
      <footer className="md:hidden bg-[#B2A28E] text-black">
        <div className="w-full">
          {/* Accordion Sections */}
          <Accordion type="single" collapsible className="w-full">
            {/* COMPANY Accordion */}
            <AccordionItem value="company" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {t.company}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href={`/${lng}/about`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.about}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/contact`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.contact}
                    </Link>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* CUSTOMER SUPPORT Accordion */}
            <AccordionItem value="support" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {t.customerSupport}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href={`/${lng}/terms`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.terms}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/contact`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.contact}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/privacy`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.privacy}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/accessibility`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.accessibility}
                    </Link>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* LANGUAGE Accordion */}
            <AccordionItem value="language" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {`${t.language} / ${lng.toUpperCase()}`}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <button
                      onClick={() => handleLanguageChange('he')}
                      className={`block text-sm text-right w-full hover:opacity-70 transition-opacity ${
                        lng === 'he' ? 'font-bold' : ''
                      }`}
                    >
                      {t.hebrew}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`block text-sm text-right w-full hover:opacity-70 transition-opacity ${
                        lng === 'en' ? 'font-bold' : ''
                      }`}
                    >
                      {t.english}
                    </button>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Social Icons Row */}
          <div className="flex items-center justify-center gap-6 py-6 px-4 border-b border-black/20">
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="Instagram"
            >
              <FaInstagram size={24} />
            </a>
            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="Facebook"
            >
              <FaFacebook size={24} />
            </a>
            <a
              href={socialLinks.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="TikTok"
            >
              <FaTiktok size={24} />
            </a>
            <a
              href={socialLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={24} />
            </a>
          </div>

          {/* Big Brand Name */}
          <div className="py-6 px-4">
            <h2 className="text-6xl md:text-6xl font-bold tracking-wider text-center">
              {t.brand}
            </h2>
          </div>
        </div>
      </footer>

      {/* Desktop Footer */}
      <footer className="hidden md:block bg-[#B2A28E] text-black">
        <div className="w-full">
          {/* Accordion Sections */}
          <Accordion type="single" collapsible className="w-full">
            {/* COMPANY Accordion */}
            <AccordionItem value="company" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {t.company}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href={`/${lng}/about`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.about}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/contact`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.contact}
                    </Link>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* CUSTOMER SUPPORT Accordion */}
            <AccordionItem value="support" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {t.customerSupport}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <Link 
                      href={`/${lng}/terms`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.terms}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/contact`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.contact}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/privacy`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.privacy}
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={`/${lng}/accessibility`}
                      className="block text-sm hover:opacity-70 transition-opacity"
                    >
                      {t.accessibility}
                    </Link>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* LANGUAGE Accordion */}
            <AccordionItem value="language" className="border-b border-black/20">
              <AccordionTrigger className="uppercase font-bold text-sm tracking-wide px-4 hover:no-underline">
                {`${t.language} / ${lng.toUpperCase()}`}
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-3">
                  <li>
                    <button
                      onClick={() => handleLanguageChange('he')}
                      className={`block text-sm text-right w-full hover:opacity-70 transition-opacity ${
                        lng === 'he' ? 'font-bold' : ''
                      }`}
                    >
                      {t.hebrew}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handleLanguageChange('en')}
                      className={`block text-sm text-right w-full hover:opacity-70 transition-opacity ${
                        lng === 'en' ? 'font-bold' : ''
                      }`}
                    >
                      {t.english}
                    </button>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Social Icons Row */}
          <div className="flex items-center justify-center gap-6 py-6 px-4 border-b border-black/20">
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="Instagram"
            >
              <FaInstagram size={24} />
            </a>
            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="Facebook"
            >
              <FaFacebook size={24} />
            </a>
            <a
              href={socialLinks.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="TikTok"
            >
              <FaTiktok size={24} />
            </a>
            <a
              href={socialLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:opacity-70 transition-opacity"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={24} />
            </a>
          </div>

          {/* Big Brand Name */}
          <div className="py-6 px-4">
            <h2 className="text-6xl md:text-6xl font-bold tracking-wider text-center">
              {t.brand}
            </h2>
          </div>
        </div>
      </footer>

      {/* Newsletter Success Modal */}
      <NewsletterSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        email={subscribedEmail}
        lng={lng}
      />
    </>
  )
}

export default function Footer({ lng }: { lng: string }) {
  return (
    <Suspense fallback={
      <footer className="md:hidden bg-[#B2A28E] text-black min-h-[200px]">
        <div className="w-full py-8 px-4">
          <h2 className="text-5xl font-bold tracking-wider text-center">
            {translations[lng as keyof typeof translations].brand}
          </h2>
        </div>
      </footer>
    }>
      <FooterInner lng={lng} />
    </Suspense>
  )
} 