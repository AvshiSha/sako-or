'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { hasCookieNoticeBeenSeen, setCookieNoticeSeen } from '@/lib/cookies';
import Link from 'next/link';

const translations = {
  en: {
    title: 'We use cookies',
    description: 'We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.',
    privacyPolicy: 'Privacy Policy',
    close: 'Close'
  },
  he: {
    title: 'אנחנו משתמשים בעוגיות',
    description: 'אנחנו משתמשים בעוגיות כדי לשפר את חוויית הגלישה שלכם, לנתח תנועה באתר ולהתאים תוכן אישית.',
    privacyPolicy: 'מדיניות פרטיות',
    close: 'סגור'
  }
};

export default function CookieConsent() {
  const pathname = usePathname();
  const [showBanner, setShowBanner] = useState(false);

  // Determine language from pathname
  const lng = pathname?.startsWith('/he') ? 'he' : 'en';
  const isRTL = lng === 'he';
  const t = translations[lng];

  useEffect(() => {
    // Check if user has already seen the notice
    if (!hasCookieNoticeBeenSeen()) {
      setShowBanner(true);

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setCookieNoticeSeen();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4 md:p-6 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 text-[#856D55]">{t.title}</h3>
            <p className="text-sm text-gray-600 mb-2 text-[#856D55]/80">{t.description}</p>
            <Link
              href={`/${lng}/privacy`}
              className="text-sm text-[#856D55] hover:underline"
            >
              {t.privacyPolicy}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="text-[#856D55] hover:text-[#856D55]/80 hover:bg-gray-100"
            >
              {t.close}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
