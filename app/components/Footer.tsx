'use client'

import Link from 'next/link';
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import { useState, Suspense, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import NewsletterSuccessModal from '@/app/components/NewsletterSuccessModal';
import { fbqTrackSubscribe } from '@/lib/facebookPixel';
import { languageMetadata } from '../../i18n/settings';

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
    company: 'חברה',
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
  const [openAccordion, setOpenAccordion] = useState<string | null>(null)
  
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const t = translations[lng as keyof typeof translations]
  const isRTL = lng === 'he'

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

  const toggleAccordion = (section: string) => {
    // If closing, capture height BEFORE state change
    if (openAccordion === section) {
      const contentElement = document.getElementById(`accordion-content-${section}`)
      if (contentElement) {
        // Capture the current rendered height before closing
        const currentHeight = contentElement.getBoundingClientRect().height
        // Store it in a data attribute so the component can access it
        contentElement.setAttribute('data-closing-height', currentHeight.toString())
      }
    }
    setOpenAccordion(openAccordion === section ? null : section)
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
    setOpenAccordion(null) // Close accordion after navigation
  }

  const handleLinkClick = () => {
    setOpenAccordion(null) // Close accordion when link is clicked
  }

  // Accordion Item Component
  const AccordionItem = ({ 
    id, 
    title, 
    children 
  }: { 
    id: string
    title: string
    children: React.ReactNode 
  }) => {
    const isOpen = openAccordion === id
    const contentRef = useRef<HTMLDivElement>(null)
    const innerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number | "auto">(0)
    const [opacity, setOpacity] = useState<number>(0)
    
    useEffect(() => {
      const contentEl = contentRef.current
      const innerEl = innerRef.current
      if (!contentEl || !innerEl) return

      if (isOpen) {
        const startHeight = contentEl.getBoundingClientRect().height
        const targetHeight = innerEl.scrollHeight

        setOpacity(1)
        setHeight(startHeight)
        requestAnimationFrame(() => {
          setHeight(targetHeight)
        })
      } else {
        // Closing: Get the height we captured before state change
        const storedHeight = contentEl.getAttribute('data-closing-height')
        const currentHeight = storedHeight 
          ? parseFloat(storedHeight) 
          : (contentEl.getBoundingClientRect().height || innerEl.scrollHeight || 0)
        
        if (currentHeight > 0) {
          // Set to the captured height first to ensure smooth transition
          setHeight(currentHeight)
          // Remove the data attribute
          contentEl.removeAttribute('data-closing-height')
          // Then animate to 0 on the next frame
          requestAnimationFrame(() => {
            setHeight(0)
            setOpacity(0)
          })
        } else {
          setHeight(0)
          setOpacity(0)
        }
      }
    }, [isOpen])

    const onTransitionEnd = () => {
      const contentEl = contentRef.current
      if (!contentEl) return
      
      // After opening finishes, let height be auto for responsive content
      if (isOpen && height !== "auto") {
        setHeight("auto")
      }
      // Clean up any remaining data attributes
      contentEl.removeAttribute('data-closing-height')
    }
    
    return (
      <div className="border-b border-black/20">
        <button
          onClick={() => toggleAccordion(id)}
          className="w-full flex items-center justify-between py-4 px-4 text-left uppercase font-bold text-sm tracking-wide"
          aria-expanded={isOpen}
          aria-controls={`accordion-content-${id}`}
        >
          <span>{title}</span>
          <ChevronDown 
            className={`w-5 h-5 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <div
          id={`accordion-content-${id}`}
          ref={contentRef}
          onTransitionEnd={onTransitionEnd}
          style={{
            height: height === "auto" ? "auto" : `${height}px`,
            opacity: opacity,
            transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="overflow-hidden"
        >
          <div ref={innerRef} className="px-4 pb-4">
            {children}
          </div>
        </div>
      </div>
    )
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
          <div className="w-full">
            {/* COMPANY Accordion */}
            <AccordionItem id="company" title={t.company}>
              <ul className="space-y-3">
                <li>
                  <Link 
                    href={`/${lng}/about`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.about}
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/contact`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.contact}
                  </Link>
                </li>
              </ul>
            </AccordionItem>

            {/* CUSTOMER SUPPORT Accordion */}
            <AccordionItem id="support" title={t.customerSupport}>
              <ul className="space-y-3">
                <li>
                  <Link 
                    href={`/${lng}/terms`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.terms}
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/contact`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.contact}
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/privacy`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.privacy}
                  </Link>
                </li>
                <li>
                  <Link 
                    href={`/${lng}/accessibility`}
                    onClick={handleLinkClick}
                    className="block text-sm hover:opacity-70 transition-opacity"
                  >
                    {t.accessibility}
                  </Link>
                </li>
              </ul>
            </AccordionItem>

            {/* LANGUAGE Accordion */}
            <AccordionItem 
              id="language" 
              title={`${t.language} / ${lng.toUpperCase()}`}
            >
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
            </AccordionItem>
          </div>

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
      <footer className="hidden md:block bg-[#1a1a1a] text-white">
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
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  <FaFacebook size={20} />
                </a>
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors duration-300"
                >
                  <FaInstagram size={20} />
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
                  <Link href={`/${lng}/collection/women/shoes`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
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