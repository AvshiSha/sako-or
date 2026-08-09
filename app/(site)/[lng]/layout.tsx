import type { Metadata } from 'next'
import { languages, type Language, defaultLanguage, getLanguageDirection } from '../../../i18n/settings'
import Footer from '../../components/Footer'
import HeaderWrapper from '@/app/components/HeaderWrapper'
import RootShell from '@/app/components/RootShell'
import { PromoProvider } from '../../contexts/PromoContext'
import { CouponBadgeProvider } from '../../contexts/CouponBadgeContext'
import { getStorefrontCouponBadgeIndex } from '@/lib/coupon-product-badges.server'
import { getServerNavigationCategories } from '@/lib/navigation-categories.server'
import LanguageLayoutShell from './LanguageLayoutShell'
import { COLLECTION_GRID_CRITICAL_CSS } from '@/lib/collection-grid-critical-css'
import { seoConfig } from '@/lib/seo'

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }))
}

// Fallback metadata for any storefront route that does not export its own.
// Hebrew because `he` is the default locale (middleware DEFAULT_LOCALE).
// Routes that build real metadata go through buildMetadata() and override
// both fields; this exists so a page that forgets to never ships the bare
// brand name as its title and description.
export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.baseUrl),
  title: 'סכו עור | נעלי עור, מגפיים ותיקים לנשים מאז 1977',
  description:
    'סכו עור מייצרת ומשווקת נעלי עור איכותיות, מגפיים, תיקים ואביזרי אופנה לנשים מאז 1977. משלוח עד הבית, החלפות והחזרות ושירות אישי.',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
}

/**
 * Root layout for the storefront.
 *
 * This is a root layout (it owns <html> and <body>) rather than a nested one
 * because <html lang> and <html dir> must reflect the [lng] route param, and
 * only a layout at or below that segment can read it. The previous single
 * app/layout.tsx sat above [lng], so it had no way to know the locale and
 * every page shipped with no lang or dir attribute at all - the inner <div>
 * below carried them, which is not where crawlers or screen readers look.
 *
 * See app/(unlocalized)/layout.tsx for the sibling root layout covering
 * admin, preview, review and the payment-gateway callbacks.
 */
export default async function LanguageLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ lng: string }>
}) {
  const { lng } = await params

  // Normalize language: fall back to default for anything unsupported
  // (including file-like paths such as meta.json, and socket.io, which
  // middleware already 404s before it reaches here).
  const normalizedLng: Language = languages.includes(lng as any)
    ? (lng as Language)
    : defaultLanguage

  // Determine direction based on language
  const direction = getLanguageDirection(normalizedLng)
  const [couponBadgeIndex, initialNavData] = await Promise.all([
    getStorefrontCouponBadgeIndex(),
    getServerNavigationCategories(normalizedLng),
  ])

  return (
    <html lang={normalizedLng} dir={direction} className="light" suppressHydrationWarning>
      <RootShell>
        <div className={`flex flex-col ${direction}`} dir={direction}>
          <style dangerouslySetInnerHTML={{ __html: COLLECTION_GRID_CRITICAL_CSS }} />
          <PromoProvider>
            <CouponBadgeProvider initialIndex={couponBadgeIndex}>
              <LanguageLayoutShell>
                <HeaderWrapper lng={normalizedLng} initialNavData={initialNavData} />
                <main className="flex-grow">
                  {children}
                </main>
                <Footer lng={normalizedLng} />
              </LanguageLayoutShell>
            </CouponBadgeProvider>
          </PromoProvider>
        </div>
      </RootShell>
    </html>
  )
}
