'use client'

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { AccordionPanel, DisclosureSign } from '@/app/components/Accordion';
import { useRouter, usePathname } from 'next/navigation';
import { languageMetadata } from '../../i18n/settings';

/**
 * Footer, design system 438:4354 (mobile) / 438:4327 (desktop).
 *
 * One structure, two presentations. Mobile stacks four collapsible sections; desktop
 * lays the same four out as open columns. That is handled with <details>/<summary>:
 * `open` on desktop via a media query is not possible in CSS, so the sections are
 * rendered open and the disclosure chrome is simply hidden from lg up, where the
 * design shows every column expanded. Keeps one DOM and no JS for it.
 */

const translations = {
  en: {
    brand: 'SAKO OR',
    about: 'About',
    blog: 'Blog',
    contact: 'Contact',
    company: 'Company details',
    customerSupport: 'Customer support',
    followUs: 'Follow us',
    language: 'Language',
    faq: 'FAQ & shoe buying guide',
    terms: 'Terms',
    policies: 'Policies',
    shippingAndReturns: 'Shipping & Returns',
    privacy: 'Privacy',
    accessibility: 'Accessibility',
    hebrew: 'Hebrew',
    english: 'English',
  },
  he: {
    brand: 'SAKO OR',
    about: 'אודות',
    blog: 'בלוג',
    contact: 'צור קשר',
    company: 'פרטי החברה',
    customerSupport: 'תמיכה ללקוחות',
    followUs: 'עקבו אחרינו',
    language: 'שפה',
    faq: 'שאלות נפוצות ומדריך לבחירת נעליים',
    terms: 'תנאים',
    policies: 'מדיניות',
    shippingAndReturns: 'משלוחים והחזרות',
    privacy: 'פרטיות',
    accessibility: 'נגישות',
    hebrew: 'עברית',
    english: 'אנגלית',
  },
}

/** Contact block, which the redesign introduces under the company column. */
const CONTACT = {
  address: {
    he: 'רחוב רוטשילד 51, ראשון לציון',
    en: '51 Rothschild St, Rishon LeZion, Israel',
  },
  phone: '050-4487979',
  email: 'INFO@SAKO-OR.COM',
}

// TIKTOK is listed in both footer frames but the site has no TikTok URL on record,
// so it is omitted rather than pointed somewhere invented. WhatsApp was in the old
// footer and is not in the redesign; it is dropped here to match, not by oversight.
const socialLinks: Array<{ label: string; href: string }> = [
  { label: 'INSTAGRAM', href: 'https://www.instagram.com/sako.or/' },
  { label: 'FACEBOOK', href: 'https://www.facebook.com/sakoorbrand' },
]

const HEADING = 'font-ploni text-[16px] font-bold text-text-inverse'
const ITEM = 'font-ploni text-[16px] text-text-inverse transition-opacity hover:opacity-70'

/**
 * A footer column. Collapsible below lg (the mobile frame shows ＋ / − affordances),
 * always open from lg up, where the desktop frame shows four expanded columns.
 */
function FooterSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const summaryId = useId()

  /**
   * Only used to decide `inert`, never the visuals - those stay CSS-driven
   * (grid-rows-[0fr] lg:grid-rows-[1fr]) so a desktop column is open on the first
   * paint with no hydration flash.
   *
   * It starts false on purpose: before hydration nothing is inert, so the footer's
   * links are reachable and crawlable on every viewport. Once we know we are below
   * lg, a closed column stops taking focus - which the old `hidden` gave for free
   * and an animated panel does not.
   */
  const [isBelowLg, setIsBelowLg] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023.98px)')
    const sync = () => setIsBelowLg(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return (
    <div className="border-t border-text-inverse pt-[20px] lg:border-t-0 lg:pt-0">
      <button
        type="button"
        id={summaryId}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between lg:pointer-events-none"
      >
        <span className={HEADING}>{title}</span>
        {/* Disclosure chrome, not content: desktop shows every column open, so the
            affordance goes away rather than sitting there inert. */}
        <DisclosureSign
          open={open}
          plus="＋"
          className="font-ploni text-[16px] font-bold text-text-inverse lg:hidden"
        />
      </button>

      {/* Same panel the PDP accordion uses, so both open at one rate. openFromLg
          keeps the frame's behaviour: collapsible on mobile, always shown from lg. */}
      <AccordionPanel
        id={panelId}
        labelledBy={summaryId}
        open={open}
        openFromLg
        isInert={isBelowLg && !open}
        contentClassName="flex flex-col gap-[6px] pt-[20px]"
      >
        {children}
      </AccordionPanel>
    </div>
  )
}

export default function Footer({ lng }: { lng: string }) {
  const t = translations[lng as keyof typeof translations] ?? translations.en
  const locale = lng === 'he' ? 'he' : 'en'
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLanguage: string) => {
    if (!pathname) return

    const pathSegments = pathname.split('/')
    if (pathSegments[1] && Object.keys(languageMetadata).includes(pathSegments[1])) {
      pathSegments[1] = newLanguage
    } else {
      pathSegments.splice(1, 0, newLanguage)
    }

    const queryString = typeof window !== 'undefined' ? window.location.search : ''
    router.push(pathSegments.join('/') + queryString)
  }

  const support: Array<[string, string]> = [
    [t.faq, `/${lng}/faq`],
    [t.shippingAndReturns, `/${lng}/shipping-and-returns`],
    [t.terms, `/${lng}/terms`],
    [t.policies, `/${lng}/policies`],
    [t.contact, `/${lng}/contact`],
    [t.privacy, `/${lng}/privacy`],
    [t.accessibility, `/${lng}/accessibility`],
  ]

  return (
    <footer className="bg-sako-olive-900 p-[30px] text-text-inverse">
      {/* Desktop is the frame's two-track grid: a 459px monogram column beside the
          content. The monogram is first in the DOM so RTL places it on the inline
          start - the right - which is where both frames put it. On mobile the same
          two children stack, with the monogram moved below the columns by `order`. */}
      <div className="flex flex-col lg:grid lg:grid-cols-[459px_minmax(0,1fr)] lg:gap-[30px]">
        {/* 20px, matching the footer's own 20px stack gap in the mobile frame. */}
        <div className="order-2 mt-[20px] flex justify-center lg:order-none lg:mt-0 lg:self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/sako/monogram.svg"
            width={459}
            height={276.529}
            alt=""
            aria-hidden="true"
            className="h-auto w-full max-w-[459px]"
          />
        </div>

        <div className="order-1 lg:order-none">
          {/* text-start, not text-end: in RTL the start edge is the right, which is
              where both frames set the wordmark. */}
          {/* 60px at both breakpoints. The mobile frame sets the wordmark at the same
              60/60 as desktop — it is the footer's one large gesture, and stepping it
              down to 44 on mobile quietly lost that. At 390px wide it still fits the
              330px content box. */}
          {/* Centred by decision. Both frames set the wordmark flush to the inline
              start (the right, in RTL); centring is a deliberate departure. */}
          {/* Centred on mobile, pushed to the far edge on desktop. The monogram sits
              in the grid's first track, which RTL puts on the right, so text-end lands
              the wordmark on the opposite side of the footer from it. */}
          <p className="text-center font-ploni text-[60px] font-black leading-[60px] text-text-inverse lg:text-end">
            {t.brand}
          </p>

          {/* 20px below the wordmark: the frame offsets the section grid to mt-80
              against a 60px wordmark on mobile, and mt-110 against mt-30 + 60px on
              desktop — both leave a 20px gap. */}
          <div className="mt-[20px] grid gap-x-[6px] gap-y-[14px] lg:grid-cols-4">
        <FooterSection title={t.company} defaultOpen>
          <Link href={`/${lng}/about`} className={ITEM}>{t.about}</Link>
          <Link href={`/${lng}/news`} className={ITEM}>{t.blog}</Link>
          <Link href={`/${lng}/contact`} className={ITEM}>{t.contact}</Link>

          {/* Short rule separating the contact block, per 438:4375 — a 28px line, so a
              border rather than the exported one-pixel SVG the frame ships. */}
          <span aria-hidden="true" className="my-[14px] block h-px w-[28px] bg-text-inverse" />

          <address className="not-italic">
            <span className="block font-ploni text-[16px] text-text-inverse">
              {CONTACT.address[locale]}
            </span>
            <a href={`tel:${CONTACT.phone.replace(/-/g, '')}`} className={`block ${ITEM}`}>
              {lng === 'he' ? "ווצאפ" : "WhatsApp"}: {CONTACT.phone}
            </a>
            <a href={`mailto:${CONTACT.email.toLowerCase()}`} className={`block ${ITEM}`}>
              {lng === 'he' ? "אימייל" : "Email"}: {CONTACT.email}
            </a>
          </address>
        </FooterSection>

        <FooterSection title={t.customerSupport}>
          {support.map(([label, href]) => (
            <Link key={href + label} href={href} className={ITEM}>
              {label}
            </Link>
          ))}
        </FooterSection>

        <FooterSection title={t.followUs}>
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={ITEM}
            >
              {social.label}
            </a>
          ))}
        </FooterSection>

        <FooterSection title={`${t.language} / ${lng.toUpperCase()}`}>
          <button
            type="button"
            onClick={() => handleLanguageChange('he')}
            className={`text-start ${ITEM} ${lng === 'he' ? 'font-bold' : ''}`}
          >
            {t.hebrew}
          </button>
          <button
            type="button"
            onClick={() => handleLanguageChange('en')}
            className={`text-start ${ITEM} ${lng === 'en' ? 'font-bold' : ''}`}
          >
            {t.english}
          </button>
        </FooterSection>
          </div>
        </div>
      </div>

      {/* dir="ltr": both strings are Latin and the frame puts the copyright on the
          left with the studio credit on the right. Left to inherit RTL they swap. */}
      <div
        dir="ltr"
        className="mt-[20px] flex items-start justify-between border-t border-text-inverse/70 pt-[17px]"
      >
        <span className="font-ploni text-[9px] tracking-[0.72px] text-text-inverse">
          ©2026 SAKO OR
        </span>
        <span className="font-ploni text-[9px] tracking-[0.72px] text-text-inverse">
          WALKING IN STYLE THAT LASTS.
        </span>
      </div>
    </footer>
  )
}
