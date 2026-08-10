import type { Metadata } from 'next'
import RootShell from '@/app/components/RootShell'

/**
 * Root layout for every route that deliberately lives outside `[lng]`:
 * the admin panel, the product preview, the post-delivery review flow, the
 * payment-gateway callbacks (Cancel / Failed / Success, reachable at those
 * exact literal URLs by hardcoded configuration on the processor's side) and
 * the bare `/` redirect.
 *
 * It exists because the storefront's root layout now lives at
 * app/(site)/[lng]/layout.tsx so it can put the locale on <html lang>, and a
 * project can only have a root layout per route group once app/layout.tsx is
 * gone. Everything below <html> is shared with the storefront via RootShell.
 *
 * `dir` is intentionally NOT set here. Nothing in this group was ever served
 * with a direction (the old root <html> had none), and the admin panel is a
 * left-to-right interface - forcing dir="rtl" to match the site default would
 * mirror the whole admin UI. These routes are all noindex, so the crawler-
 * facing reason for setting dir does not apply to them.
 */
export const metadata: Metadata = {
  // Every route in this group is either internal tooling, a private one-off
  // link, or a redirect. None of it belongs in an index. Individual layouts
  // still set this too; this is the backstop for anything that forgets.
  robots: { index: false, follow: false },
}

export default function UnlocalizedRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" className="light" suppressHydrationWarning>
      <RootShell>{children}</RootShell>
    </html>
  )
}
