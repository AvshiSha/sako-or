'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/app/components/ui/button';
import { hasCookieNoticeBeenSeen, setCookieNoticeSeen } from '@/lib/cookies';
import { COOKIE_NOTICE_SEEN_EVENT } from '@/app/components/DeferredAnalytics';
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
    window.dispatchEvent(new Event(COOKIE_NOTICE_SEEN_EVENT));
  };

  if (!showBanner) return null;

  return (
    <div data-nosnippet>
      {/* Paper ground with a hard ink rule, not the ink-900 the Announcement
          Banner and the toast use. Two reasons it has to stay light: the footer
          is olive-900 (#1c1b12), so an ink bar would vanish into it the moment
          a shopper reaches the bottom of any page; and the ink surface is
          reserved for the site answering something you just did. A cookie
          notice is a standing legal notice and must not compete with the page.
          No shadow - the design system documents no elevation, and the 1px
          border-default rule is what separates the bar from the paper ground. */}
      <section
        aria-label={t.title}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-surface-primary px-[16px] py-[16px] text-start md:py-[24px] lg:px-[36px] lg:py-[32px]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex flex-col items-start gap-[16px] md:flex-row md:items-center md:justify-between md:gap-[24px]">
          <div className="flex-1">
            {/* Heading/H4 over Body/Small - a real 18/14 pair from the scale,
                where the old bar had Assistant 600 and 400 both in #856D55, a
                brown the v5 palette does not contain. */}
            <h3 className="mb-[8px] font-ploni text-[18px] font-black leading-[18px] text-text-primary">
              {t.title}
            </h3>
            <p className="mb-[8px] max-w-[760px] font-ploni text-[14px] text-text-secondary">
              {t.description}
            </p>
            {/* Same underline treatment as the toast's action link, so the two
                surfaces the system speaks through agree. */}
            <Link
              href={`/${lng}/privacy`}
              className="font-ploni text-[14px] text-text-primary underline decoration-1 underline-offset-4 hover:no-underline"
            >
              {t.privacyPolicy}
            </Link>
          </div>
          {/* CTA Button State=Outlined, 438:7685 - the system's only secondary
              action. Full width on mobile, where it is the one control. */}
          <Button
            onClick={handleClose}
            variant="sakoOutlined"
            size="sakoBar"
            className="w-full md:w-auto md:px-[32px]"
          >
            {t.close}
          </Button>
        </div>
      </section>
    </div>
  );
}
