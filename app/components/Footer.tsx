import Link from 'next/link'
import { FaFacebook, FaInstagram, FaWhatsapp } from 'react-icons/fa'
import FooterLanguageSection from './FooterLanguageSection'

const translations = {
  en: {
    brand: 'SAKO OR',
    about: 'About',
    blog: 'Blog',
    contact: 'Contact',
    company: 'COMPANY',
    customerSupport: 'CUSTOMER SUPPORT',
    language: 'LANGUAGE',
    terms: 'Terms',
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
    language: 'שפה',
    terms: 'תנאים',
    privacy: 'פרטיות',
    accessibility: 'נגישות',
    hebrew: 'עברית',
    english: 'אנגלית',
  },
}

const socialLinks = {
  instagram: 'https://www.instagram.com/sako.or/',
  facebook: 'https://www.facebook.com/sakoorbrand',
  whatsapp: 'https://wa.me/972504487979',
}

function FooterLinks({ lng, t }: { lng: string; t: (typeof translations)['en'] }) {
  return (
    <div className="w-full">
      <details className="group border-b border-black/20">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center uppercase px-4 text-sm font-bold tracking-wide [&::-webkit-details-marker]:hidden">
          {t.company}
        </summary>
        <div className="px-4 pb-4">
          <ul className="space-y-3">
            <li>
              <Link href={`/${lng}/about`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.about}
              </Link>
            </li>
            <li>
              <Link href={`/${lng}/news`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.blog}
              </Link>
            </li>
            <li>
              <Link href={`/${lng}/contact`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.contact}
              </Link>
            </li>
          </ul>
        </div>
      </details>

      <details className="group border-b border-black/20">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center uppercase px-4 text-sm font-bold tracking-wide [&::-webkit-details-marker]:hidden">
          {t.customerSupport}
        </summary>
        <div className="px-4 pb-4">
          <ul className="space-y-3">
            <li>
              <Link href={`/${lng}/terms`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.terms}
              </Link>
            </li>
            <li>
              <Link href={`/${lng}/contact`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.contact}
              </Link>
            </li>
            <li>
              <Link href={`/${lng}/privacy`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.privacy}
              </Link>
            </li>
            <li>
              <Link href={`/${lng}/accessibility`} className="block text-sm hover:opacity-70 transition-opacity">
                {t.accessibility}
              </Link>
            </li>
          </ul>
        </div>
      </details>

      <FooterLanguageSection
        lng={lng}
        languageLabel={t.language}
        hebrewLabel={t.hebrew}
        englishLabel={t.english}
      />
    </div>
  )
}

function FooterSocialRow() {
  return (
    <div className="flex min-h-[72px] items-center justify-center gap-6 border-b border-black/20 px-4 py-6">
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
        href={socialLinks.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="text-black hover:opacity-70 transition-opacity"
        aria-label="WhatsApp"
      >
        <FaWhatsapp size={24} />
      </a>
    </div>
  )
}

function FooterBrand({ brand }: { brand: string }) {
  return (
    <div className="min-h-[108px] px-4 py-6">
      <h2 className="text-center text-6xl font-bold tracking-wider">{brand}</h2>
    </div>
  )
}

export default function Footer({ lng }: { lng: string }) {
  const t = translations[lng as keyof typeof translations]

  return (
    <footer className="bg-[#B2A28E] text-black min-h-[340px] md:min-h-0">
      <FooterLinks lng={lng} t={t} />
      <FooterSocialRow />
      <FooterBrand brand={t.brand} />
    </footer>
  )
}
