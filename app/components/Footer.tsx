import Link from 'next/link';
import { FaFacebook, FaInstagram, FaTwitter, FaPinterest } from 'react-icons/fa';

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
    contact: 'Contact'
  },
  he: {
    brand: 'סכו עור',
    description: 'גלה את האוסף המוקפד שלנו של נעליים יוקרתיות, שמקורן מהאומנים הטובים ביותר באירופה והיצרנים היוקרתיים ביותר בסין.',
    navigation: 'ניווט',
    newsletter: 'עיתון',
    subscribe: 'הירשם',
    subscribePlaceholder: 'הזן את האימייל שלך',
    subscribeSuccess: 'תודה שנרשמת!',
    home: 'בית',
    newCollection: 'אוסף חדש',
    about: 'אודות',
    contact: 'צור קשר'
  }
}

export default function Footer({ lng }: { lng: string }) {
  const t = translations[lng as keyof typeof translations]

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
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaFacebook size={20} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="https://www.instagram.com/sako.or/"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaInstagram size={20} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors duration-300"
              >
                <FaTwitter size={20} />
              </a>
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
              Subscribe to our newsletter for updates and exclusive offers.
            </p>
            <form className="flex">
              <input
                type="email"
                placeholder={t.subscribePlaceholder}
                className="flex-1 px-4 py-2 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors duration-300"
              >
                {t.subscribe}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 {t.brand}. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href={`/${lng}/privacy`} className="text-gray-400 hover:text-white text-sm">
                Privacy Policy
              </Link>
              <Link href={`/${lng}/terms`} className="text-gray-400 hover:text-white text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 