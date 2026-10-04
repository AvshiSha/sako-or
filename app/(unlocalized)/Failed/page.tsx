'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/app/components/Footer';
import { useAuth } from '@/app/contexts/AuthContext';

// There is no Figma frame for the failure callback. This is the Success frame
// (438:3899 / 438:3901) with its icon, eyebrow, heading and copy re-pointed at a
// declined payment, so the two gateway returns read as one pair: same paper
// ground, same centred column, same 72px/105px/30px rhythm, same type ramp. The
// blocks the success state has no use for — the error detail and the retry CTA —
// are the approved checkout constructions (438:2813 CTA bar, and the
// red-ruled error box CheckoutClient already draws for gateway errors).

function FailedPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{
    orderId?: string;
    errorCode?: string;
    errorMessage?: string;
  }>({});

  useEffect(() => {
    // Extract parameters from URL. The same CardCom redirect that reaches
    // /Success reaches this route, so read its parameter names too — the frame
    // prints an order number in the eyebrow and CardCom only ever sends one as
    // ReturnValue.
    const lpid = searchParams?.get('lpid') || searchParams?.get('lowprofilecode'); // Low Profile ID
    const orderId = searchParams?.get('orderId') || searchParams?.get('ReturnValue');
    const errorCode =
      searchParams?.get('errorCode') ||
      searchParams?.get('ResponseCode') ||
      searchParams?.get('ResponeCode'); // CardCom ships both spellings
    const errorMessage = searchParams?.get('errorMessage') || searchParams?.get('Description');

    // Send postMessage to parent if in iframe
    if (window.parent && window.parent !== window) {
      const message = {
        type: 'CARD_PAYMENT_REDIRECT',
        status: 'failed' as const,
        lpid: lpid || '',
        orderId: orderId || undefined
      };
      window.parent.postMessage(message, window.location.origin);
    }

    setErrorInfo({
      orderId: orderId || undefined,
      errorCode: errorCode || undefined,
      errorMessage: errorMessage || undefined,
    });

    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen flex-col items-center justify-center bg-surface-secondary px-[16px]"
      >
        <p className="font-ploni text-[25px] font-black leading-[25px] tracking-[-1.4px] text-text-primary">
          SAKO OR
        </p>
        <p className="mt-[30px] font-ploni text-[11px] leading-[20.8px] tracking-[1.69px] text-text-primary">
          ONE MOMENT
        </p>
        <p className="mt-[8px] font-ploni text-[13px] leading-[20.8px] text-text-primary">
          רק רגע…
        </p>
      </div>
    );
  }

  // Mirrors the Success greeting: the frame opens on the shopper's first name,
  // and guest checkout has no account to read one from, so the sentence closes
  // without an empty slot.
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || '';
  const intro = firstName
    ? `${firstName}, לא הצלחנו להשלים את התשלום.`
    : 'לא הצלחנו להשלים את התשלום.';

  return (
    // dir="rtl" here rather than on the layout: this group deliberately sets no
    // direction, because it also holds the left-to-right admin panel.
    <div dir="rtl" className="flex min-h-screen flex-col bg-surface-secondary">
      {/* One centred column, as on /Success. The frame carries the wordmark
          itself rather than the site header, because the gateway returns here
          outside the storefront shell. */}
      <main className="flex flex-1 flex-col items-center px-[16px] pt-[72px] pb-[50px]">
        <p className="font-ploni text-[25px] font-black leading-[25px] tracking-[-1.4px] text-text-primary">
          SAKO OR
        </p>

        {/* The 33x33 slot the Success frame fills with its circled check
            (438:3905), drawn here as a circled cross on the same hairline ring
            and the same 2.13 stroke. The mark stays ink rather than
            accent-error: the system is monochrome, and the state is carried by
            the shape, which also survives a colour-blind reading. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/sako/payment-failed-cross.svg"
          width={33}
          height={33}
          alt=""
          aria-hidden="true"
          className="mt-[105px]"
        />

        {/* Same eyebrow as "ORDER CONFIRMED / #SO-02481". The divider and number
            drop out together when the gateway handed back no order, rather than
            leaving a bare "#". */}
        <p className="mt-[30px] mb-[20px] text-center font-ploni text-[11px] leading-[20.8px] tracking-[1.69px] text-text-primary">
          {errorInfo.orderId ? `PAYMENT FAILED / #${errorInfo.orderId}` : 'PAYMENT FAILED'}
        </p>

        {/* The frame specifies Ploni UltraBold; this project ships Regular,
            DemiBold, Bold and Black, so the heading takes Black (900) — the
            nearest weight we actually load rather than a synthesized one. */}
        <h1 className="pt-[13px] text-center font-ploni text-[60px] font-black leading-[50px] text-text-primary">
          התשלום
          <br />
          לא עבר.
        </h1>

        <p className="mt-[12px] max-w-[319px] text-center font-ploni text-[13px] leading-[20.8px] text-text-primary">
          {intro} לא בוצע חיוב והסל שלך נשמר. אפשר לנסות שוב, או לשלם באמצעי תשלום אחר.
        </p>

        {/* The gateway's own words, when it sent any. Same red-ruled box
            CheckoutClient draws for a gateway error, so a shopper who saw it one
            step earlier meets the same object here. */}
        {(errorInfo.errorCode || errorInfo.errorMessage) && (
          <div className="mt-[20px] w-full max-w-[319px] border border-accent-error px-[16px] py-[12px] text-start">
            {errorInfo.errorMessage && (
              <p role="alert" className="font-ploni text-[13px] leading-[20.8px] text-accent-error">
                {errorInfo.errorMessage}
              </p>
            )}
            {errorInfo.errorCode && (
              <p className="font-ploni text-[9px] tracking-[0.72px] text-text-primary">
                ERROR {errorInfo.errorCode}
              </p>
            )}
          </div>
        )}

        {/* 438:2813 — the 58px ink CTA bar, label on the inline start and the
            frame's arrow glyph pushed to the far end. Capped at the paragraph's
            319px so the column keeps its measure on desktop instead of
            stretching the bar across the viewport. */}
        <Link
          href="/he/checkout"
          className="mt-[30px] flex h-[58px] w-full max-w-[319px] items-center justify-between bg-btn-primary-bg px-[19px] transition-colors hover:bg-sako-ink-800"
        >
          <span className="font-ploni text-[13px] font-bold text-text-inverse">לנסות שוב</span>
          <span
            aria-hidden="true"
            className="flex size-[22px] rotate-90 items-center justify-center font-ploni text-[20px] font-black leading-none text-text-inverse"
          >
            ↙
          </span>
        </Link>

        {/* The Success link, twice. These routes are unlocalized — there is no
            [lng] to inherit — so the Hebrew storefront has to be named. */}
        <div className="flex flex-wrap items-center justify-center gap-x-[24px]">
          <Link
            href="/he/contact"
            className="flex h-[44px] items-end border-b border-border-default pb-[6px] font-ploni text-[11px] text-text-primary transition-opacity hover:opacity-60"
          >
            צריך עזרה? ↙
          </Link>

          <Link
            href="/he"
            className="flex h-[44px] items-end border-b border-border-default pb-[6px] font-ploni text-[11px] text-text-primary transition-opacity hover:opacity-60"
          >
            חזרה לחנות ↙
          </Link>
        </div>

        {/* Ruled block, the blog list's section-header construction (438:3332)
            at column width: hairline above, an 11px/1.69px tracked label, body
            copy under it. */}
        <div className="mt-[40px] w-full max-w-[319px] border-t border-border-default pt-[14px] text-start">
          <p className="font-ploni text-[11px] leading-[20.8px] tracking-[1.69px] text-text-primary">
            WHAT TO CHECK
          </p>
          <ul className="mt-[6px] font-ploni text-[13px] leading-[20.8px] text-text-primary">
            <li>פרטי הכרטיס שהוזנו</li>
            <li>יתרה או מסגרת אשראי מספקת</li>
            <li>חסימה של הכרטיס לעסקאות באינטרנט</li>
            <li>תקלה זמנית אצל חברת האשראי</li>
          </ul>
        </div>
      </main>

      <Footer lng="he" />
    </div>
  );
}

export default function FailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-secondary" />}>
      <FailedPageContent />
    </Suspense>
  );
}
