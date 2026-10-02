'use client'

import React, { useState } from 'react'
import { useParams } from 'next/navigation'
import TurnstileScript from '@/app/components/TurnstileScript'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { Field } from '@/app/components/ui/field'
import { cn } from '@/lib/utils'
import {
  MEASURE,
  PAGE_GROUND,
  PAGE_INSET,
  RULED_BLOCK,
  TWO_TRACK,
  TYPE_BLOCK_TITLE,
  TYPE_BODY,
  TYPE_EYEBROW,
  TYPE_LABEL,
  TYPE_LEAD,
  TYPE_PAGE_TITLE,
} from '@/app/components/pageChrome'

/**
 * The shop's address as a geocoding input, not as display copy - the visible
 * address lives in `translations`.
 *
 * Deliberately a query string rather than a lat/lon pair. OpenStreetMap has no
 * house numbers for Rothschild St in Rishon LeZion (Nominatim returns only
 * street segments, and the candidates for "51" sit ~1.3km apart), so any
 * coordinate hardcoded here would be a guess at which block the shop is on.
 * Google does hold the house number, so letting it geocode the address puts the
 * pin on the building instead of somewhere on the right street.
 */
const MAP_QUERY = 'רחוב רוטשילד 51, ראשון לציון, ישראל'

/**
 * The embed URL.
 *
 * Prefers the documented Embed API when a key is configured. Without one it
 * falls back to the keyless `output=embed` form, which needs no Google Cloud
 * project or billing and is what ships today - but it is undocumented, so if
 * Google ever retires it, setting NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is the whole
 * fix and nothing else here changes.
 */
function mapEmbedSrc(locale: string): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const q = encodeURIComponent(MAP_QUERY)
  const hl = locale === 'he' ? 'he' : 'en'
  return key
    ? `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}&language=${hl}&zoom=16`
    : `https://www.google.com/maps?q=${q}&hl=${hl}&z=16&output=embed`
}

/** Opens turn-by-turn directions in the user's own Maps app. */
const MAP_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  MAP_QUERY
)}`

/**
 * Contact, rebuilt on the SAKO OR — Update design system.
 *
 * No Figma frame exists for this page, so it is composed from constructions
 * approved elsewhere - see app/components/pageChrome.tsx for the four and the
 * node ids behind them. The form controls are checkout's Field (438:2751)
 * rather than new ones.
 *
 * Only the presentation changed. The Turnstile lifecycle, the email validation,
 * the submit handler and the /api/contact contract are untouched.
 */

// Hardcoded translations for build-time rendering
const translations = {
  en: {
    title: 'Contact Us',
    subtitle: 'Get in touch with our team',
    description: 'We\'d love to hear from you. Send us a message and we\'ll respond as soon as possible.',

    form: {
      name: 'Full Name',
      namePlaceholder: 'Enter your full name',
      email: 'Email Address',
      emailPlaceholder: 'Enter your email address',
      subject: 'Subject',
      subjectPlaceholder: 'What is this about?',
      message: 'Message',
      messagePlaceholder: 'Tell us how we can help you...',
      submit: 'Send Message',
      submitting: 'Sending...',
      success: 'Thank you! Your message has been sent successfully.',
      error: 'Sorry, there was an error sending your message. Please try again.'
    },

    map: {
      title: 'Visit the shop',
      directions: 'GET DIRECTIONS',
    },

    contactInfo: {
      title: 'Contact Information',
      // "Rothschild", not "Rothchild" — the street is named after Baron
      // Rothschild, and the footer already spells it correctly. The two
      // disagreeing on the same site is the kind of detail that reads as
      // carelessness on a page whose job is to be trusted.
      address: '51 Rothschild Street, Rishon LeZion, Israel',
      phone: '050-448-7979',
      email: 'info@sako-or.com',
      hours: 'Sunday - Thursday: 9:00 AM - 20:00 PM\nFriday: 9:00 AM - 15:00 PM\nSaturday: Closed',
      Address: 'Address',
      Phone: 'WhatsApp',
      Email: 'Email',
      BuisnessHours: 'Buisness Hours'
    },

    backToHome: 'Back to Home'
  },
  he: {
    title: 'צור קשר',
    subtitle: 'צרו קשר עם הצוות שלנו',
    description: 'נשמח לשמוע מכם. שלחו לנו הודעה ונחזור אליכם בהקדם האפשרי.',

    form: {
      name: 'שם מלא',
      namePlaceholder: 'הזן את שמך המלא',
      email: 'כתובת אימייל',
      emailPlaceholder: 'הזן את כתובת האימייל שלך',
      subject: 'נושא',
      subjectPlaceholder: 'על מה זה?',
      message: 'הודעה',
      messagePlaceholder: 'ספרו לנו איך אנחנו יכולים לעזור לכם...',
      submit: 'שלח הודעה',
      submitting: 'שולח...',
      success: 'תודה! ההודעה שלכם נשלחה בהצלחה.',
      error: 'מצטערים, הייתה שגיאה בשליחת ההודעה. אנא נסו שוב.'
    },

    map: {
      title: 'בקרו בחנות',
      directions: 'הוראות הגעה',
    },

    contactInfo: {
      title: 'פרטי יצירת קשר',
      address: 'רחוב רוטשילד 51, ראשון לציון, ישראל',
      phone: '050-448-7979',
      email: 'info@sako-or.com',
      hours: 'יום ראשון - חמישי: 9:00 - 20:00\nשישי: 9:00 - 15:00\nשבת: סגור',
      Address: 'כתובת',
      Phone: 'וואטסאפ',
      Email: 'אימייל',
      BuisnessHours: 'שעות פעילות'
    },

    backToHome: 'חזרה לעמוד הבית'
  }
}

export default function ContactPage() {
  const params = useParams()
  const lng = (params?.lng as string) || 'en'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [emailError, setEmailError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const [isMounted, setIsMounted] = useState(false)

  const isRTL = lng === 'he'
  const t = translations[lng as keyof typeof translations]

  // Client-side mount detection
  React.useEffect(() => {
    setIsMounted(true)
    console.log('[Contact Form] Component mounted on client')
  }, [])

  // Turnstile - explicit render when script loads
  React.useEffect(() => {
    if (!isMounted) return

    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    if (typeof sitekey !== 'string' || !sitekey) {
      console.error('[Turnstile] Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY — widget cannot render')
      return
    }

    const renderTurnstile = () => {
      const container = document.querySelector('.cf-turnstile')
      if (!container || (window as any).turnstileRendered) return

      if ((window as any).turnstile) {
        try {
          (window as any).turnstile.render('.cf-turnstile', {
            sitekey,
            theme: 'light',
            size: 'normal',
            callback: (token: string) => {
              setTurnstileToken(token)
              console.log('[Contact Form] Turnstile token received:', token)
            },
            'error-callback': () => {
              console.error('Turnstile verification failed')
            }
          })
            ; (window as any).turnstileRendered = true
        } catch (error) {
          console.error('Turnstile render error:', error)
        }
      } else {
        // Retry after 500ms if script not loaded yet
        setTimeout(renderTurnstile, 500)
      }
    }

    // Start trying to render
    renderTurnstile()

    return () => {
      ; (window as any).turnstileRendered = false
    }
  }, [isMounted])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Validate email in real-time
    if (name === 'email') {
      if (value === '') {
        setEmailError('')
      } else if (!validateEmail(value)) {
        setEmailError(lng === 'he' ? 'כתובת אימייל לא תקינה' : 'Invalid email address')
      } else {
        setEmailError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate email before submission
    if (!validateEmail(formData.email)) {
      setEmailError(lng === 'he' ? 'כתובת אימייל לא תקינה' : 'Invalid email address')
      return
    }

    // Check for Turnstile token
    if (!turnstileToken) {
      setSubmitStatus('error')
      console.error('Turnstile verification required')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setEmailError('')

    try {
      // Send contact form data to API
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          language: lng,
          turnstileToken: turnstileToken,
        }),
      })

      console.log('[CONTACT API] Response received:', response)

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const text = await response.text()
        console.error(`Server returned non-JSON (${response.status})`)
        console.error('First part of response:', text.slice(0, 200))
        setSubmitStatus('error')
        setIsSubmitting(false)
        return
      }

      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        console.error('Failed to parse response JSON:', jsonError)
        console.error('Response status:', response.status)
        console.error('Response headers:', response.headers)

        // Try to get response text for debugging
        try {
          const responseText = await response.text()
          console.error('Response text:', responseText)
        } catch (textError) {
          console.error('Could not read response text:', textError)
        }

        setSubmitStatus('error')
        return
      }

      if (response.ok && data.success) {
        setSubmitStatus('success')
        setFormData({ name: '', email: '', subject: '', message: '' })
        setTurnstileToken('')

        // Reset Turnstile widget
        if ((window as any).turnstile) {
          (window as any).turnstile.reset()
        }
      } else {
        console.error('Contact form submission failed:', data.error)
        setSubmitStatus('error')

        // Reset Turnstile widget on error
        if ((window as any).turnstile) {
          (window as any).turnstile.reset()
        }
        setTurnstileToken('')
      }
    } catch (error) {
      console.error('Contact form submission error:', error)
      setSubmitStatus('error')

      // Reset Turnstile widget on error
      if ((window as any).turnstile) {
        (window as any).turnstile.reset()
      }
      setTurnstileToken('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <TurnstileScript />
    <div className={PAGE_GROUND}>
      <Breadcrumbs
        crumbs={[
          { name: isRTL ? 'דף הבית' : 'Home', url: `/${lng}` },
          { name: t.title, url: `/${lng}/contact` },
        ]}
      />

      {/* Heading block - the blog cover's text column (438:3315) standing on
          its own, since there is no contact photograph to put beside it. */}
      <div className={cn(PAGE_INSET, 'flex flex-col items-start py-[30px] lg:py-[54px]')}>
        <p className={TYPE_EYEBROW}>CONTACT / 01</p>
        <h1 className={cn(TYPE_PAGE_TITLE, 'pb-[22px] pt-[24px]')}>{t.title}</h1>
        <p className={cn(TYPE_LEAD, MEASURE)}>{t.description}</p>
      </div>

      {/* 01 - the form. Two-track: label column on the inline start (438:3234). */}
      <section className={cn(RULED_BLOCK, TWO_TRACK)}>
        <div className="flex flex-col gap-[10px]">
          <p className={cn(TYPE_LABEL, 'text-text-secondary')}>01</p>
          <h2 className={TYPE_BLOCK_TITLE}>{t.subtitle}</h2>
        </div>

            <form onSubmit={handleSubmit} className={cn(MEASURE, 'flex w-full flex-col gap-[24px]')}>
              {/* Checkout's "Form Input Field" (438:2751) - a 9px caption over
                  the value, closed by a single hairline. No boxes anywhere in
                  this system. Every input keeps its original name, validation
                  and disabled state; only the control around them changed. */}
              <Field
                label={t.form.name}
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={t.form.namePlaceholder}
                required
                disabled={isSubmitting}
              />

              <Field
                label={t.form.email}
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={t.form.emailPlaceholder}
                required
                disabled={isSubmitting}
                // Field turns the rule red and wires aria-invalid /
                // aria-describedby from this, which the hand-rolled markup
                // never did - the old error was a red <p> with no programmatic
                // link to the input at all.
                error={emailError || null}
              />

              <Field
                label={t.form.subject}
                id="subject"
                name="subject"
                type="text"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder={t.form.subjectPlaceholder}
                required
                disabled={isSubmitting}
                minLength={2}
                maxLength={120}
              />

              {/* The one control that cannot be a single 54px line, so the cell
                  grows instead - see `cellClassName` on Field. */}
              <Field
                label={t.form.message}
                id="message"
                cellClassName="h-auto min-h-[160px]"
              >
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder={t.form.messagePlaceholder}
                  required
                  disabled={isSubmitting}
                  rows={6}
                  minLength={2}
                  maxLength={2000}
                  className="flex-1 resize-y border-0 bg-transparent p-0 font-ploni text-[14px] leading-[22px] text-text-primary placeholder:text-text-secondary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </Field>

              {/* Cloudflare Turnstile Widget */}
              {isMounted && (
                <div className="flex justify-center">
                  <div className="cf-turnstile"></div>
                </div>
              )}

              {/* Show message if Turnstile is not ready */}
              {isMounted && !turnstileToken && (
                <p className={cn(TYPE_LABEL, 'text-text-secondary')}>
                  {lng === 'he' ? 'נא להשלים את האימות למעלה' : 'Please complete the verification above'}
                </p>
              )}

              {/* The design system's filled CTA, as the PDP and the filter panel
                  draw it: label on the inline start, U+2199 opposite. */}
              <button
                type="submit"
                disabled={isSubmitting || !!emailError || !turnstileToken}
                className="flex h-[56px] w-full items-center justify-between bg-sako-ink-900 px-[17px] transition-colors hover:bg-sako-ink-800 disabled:cursor-not-allowed disabled:bg-sako-gray-500"
              >
                <span className="font-ploni text-[12px] font-bold text-text-inverse">
                  {isSubmitting ? t.form.submitting : t.form.submit}
                </span>
                <span
                  aria-hidden="true"
                  className="rotate-90 font-ploni text-[22px] font-black leading-none text-text-inverse"
                >
                  &#8601;
                </span>
              </button>

              {/* Status. role="status" / role="alert" so the outcome is
                  announced - the old coloured boxes were silent to a screen
                  reader, which on a form that can fail is the whole point. */}
              {submitStatus === 'success' && (
                <p
                  role="status"
                  className={cn(TYPE_BODY, 'border-t border-sako-black pt-[14px] font-bold')}
                >
                  {t.form.success}
                </p>
              )}

              {submitStatus === 'error' && (
                <p
                  role="alert"
                  className={cn(
                    TYPE_BODY,
                    'border-t border-accent-error pt-[14px] text-accent-error'
                  )}
                >
                  {t.form.error}
                </p>
              )}
            </form>
      </section>

      {/* 02 - the details. Same two-track, so the two halves of the page read
          as one column of blocks rather than a split screen. */}
      <section className={cn(RULED_BLOCK, TWO_TRACK)}>
        <div className="flex flex-col gap-[10px]">
          <p className={cn(TYPE_LABEL, 'text-text-secondary')}>02</p>
          <h2 className={TYPE_BLOCK_TITLE}>{t.contactInfo.title}</h2>
        </div>

        {/* A description list, not four divs: these are label/value pairs and
            saying so is free. The lucide icons are gone - this system draws no
            decorative pictograms, and the captions already name each row. */}
        <dl className={cn(MEASURE, 'grid w-full grid-cols-1 gap-[24px] sm:grid-cols-2')}>
          <ContactRow label={t.contactInfo.Address}>{t.contactInfo.address}</ContactRow>

          <ContactRow label={t.contactInfo.Phone}>
            <a
              href="https://wa.me/972504487979"
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-border-default pb-[2px] transition-opacity hover:opacity-70"
            >
              {t.contactInfo.phone}
            </a>
          </ContactRow>

          <ContactRow label={t.contactInfo.Email}>
            <a
              href={`mailto:${t.contactInfo.email}`}
              className="border-b border-border-default pb-[2px] transition-opacity hover:opacity-70"
            >
              {t.contactInfo.email}
            </a>
          </ContactRow>

          {/* The hours string carries newlines, hence whitespace-pre-line. */}
          <ContactRow label={t.contactInfo.BuisnessHours} className="whitespace-pre-line">
            {t.contactInfo.hours}
          </ContactRow>
        </dl>
      </section>

      {/* 03 - the shop. */}
      <section className={cn(RULED_BLOCK, TWO_TRACK)}>
        <div className="flex flex-col gap-[10px]">
          <p className={cn(TYPE_LABEL, 'text-text-secondary')}>03</p>
          <h2 className={TYPE_BLOCK_TITLE}>{t.map.title}</h2>
          <a
            href={MAP_DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              TYPE_LABEL,
              'mt-[6px] self-start border-b border-border-default pb-[6px] text-text-primary transition-opacity hover:opacity-70'
            )}
          >
            {t.map.directions}
          </a>
        </div>

        {/* Desaturated to sit inside a monochrome system, and restored to full
            colour on hover or keyboard focus - a map you are actually reading
            needs its colour coding, and a greyed one is harder to parse.
            loading="lazy" because this is the last block on the page: no reason
            to pay for a third-party iframe before it is anywhere near view. */}
        <div
          className={cn(
            MEASURE,
            'w-full border border-sako-black grayscale transition-[filter] duration-300 hover:grayscale-0 focus-within:grayscale-0'
          )}
        >
          <iframe
            src={mapEmbedSrc(lng)}
            title={t.map.title}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="block h-[320px] w-full lg:h-[420px]"
          />
        </div>
      </section>
    </div>
    </>
  )
}

/**
 * One label/value pair in the details block, built as the 9px caption over a
 * value that checkout's Field uses - without the hairline, since these are read
 * rather than typed into.
 */
function ContactRow({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <dt className="font-ploni text-[9px] leading-none text-text-secondary">{label}</dt>
      <dd className={cn(TYPE_BODY, 'm-0', className)}>{children}</dd>
    </div>
  )
}
