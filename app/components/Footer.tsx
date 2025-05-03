'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaFacebook, FaInstagram, FaTwitter, FaPinterest } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useParams } from 'next/navigation';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { t } = useTranslation();
  const params = useParams();
  const lng = params?.lng || 'en';

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the email to your backend
    console.log('Subscribing email:', email);
    setIsSubscribed(true);
    setEmail('');
  };

  return (
    <footer className="bg-[#1a1a1a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 py-16">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-light tracking-wider mb-6">{t('footer.brand')}</h2>
            <p className="text-gray-400 mb-6 max-w-md">
              {t('footer.description')}
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
            <h3 className="text-sm font-medium uppercase tracking-wider mb-6">{t('footer.navigation')}</h3>
            <ul className="space-y-3">
              <li>
                <Link href={`/${lng}`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t('navigation.home')}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/collection`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t('navigation.newCollection')}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/about`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t('navigation.about')}
                </Link>
              </li>
              <li>
                <Link href={`/${lng}/contact`} className="text-gray-400 hover:text-white transition-colors duration-300 text-sm">
                  {t('navigation.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider mb-6">{t('footer.newsletter')}</h3>
            <p className="text-gray-400 mb-4 text-sm">
              {t('home.newsletterDescription')}
            </p>
            {!isSubscribed ? (
              <form onSubmit={handleSubscribe} className="flex flex-col space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('home.emailPlaceholder')}
                  className="px-4 py-2 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-white"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors duration-300"
                >
                  {t('footer.subscribe')}
                </button>
              </form>
            ) : (
              <p className="text-green-400">{t('home.subscribeButton')}</p>
            )}
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              {t('footer.copyright')}
            </p>
            <div className="flex space-x-6">
              <Link href={`/${lng}/privacy`} className="text-gray-400 hover:text-white text-sm">
                {t('footer.privacy')}
              </Link>
              <Link href={`/${lng}/terms`} className="text-gray-400 hover:text-white text-sm">
                {t('footer.terms')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 