import type { Metadata } from 'next'
import RootShell from '@/app/components/RootShell'

/**
 * Root layout for the staff warehouse tooling at `/staff/*`.
 *
 * ## Why this is a third root layout rather than a subtree of `(unlocalized)`
 *
 * The admin group's root layout deliberately does NOT set `dir`, because the
 * admin panel is a left-to-right interface and forcing `rtl` would mirror the
 * whole thing. This screen is the opposite: Hebrew, right-to-left, including
 * every loading state, validation message, error and control.
 *
 * Setting `dir="rtl"` on a wrapper `<div>` inside that group does not work.
 * Headless UI dialogs and Radix popovers render through a portal appended to
 * `document.body`, so a portalled panel sits OUTSIDE any wrapper and inherits
 * the direction from `<html>`. `app/globals.css` also carries
 * `[dir="rtl"] .select-content` and `[dir="rtl"] [data-radix-select-trigger]`
 * rules, which are descendant selectors and match nothing unless `dir` is on
 * `<html>`. The manager PIN dialog is the one place correctness matters most,
 * so `dir` belongs here.
 *
 * Next.js supports one root layout per top-level route group as long as there
 * is no `app/layout.tsx`, and there is not: `app/(site)/[lng]/layout.tsx` and
 * `app/(unlocalized)/layout.tsx` are already two. This is the third.
 *
 * `/staff/login` lives in the nested `(staff-public)` group so it escapes the
 * authentication gate in `staff/layout.tsx` while still rendering inside THIS
 * layout -- so the login screen is right-to-left too. Nesting it inside
 * `(staff)` rather than beside it is deliberate: a sibling top-level group
 * would need its own duplicate `<html>` and the two would drift.
 *
 * Everything below `<html>` is shared with the storefront and the admin via
 * `RootShell`, which owns `<body>`, the Ploni and Assistant fonts and the
 * client providers.
 */
export const metadata: Metadata = {
  // Internal tooling. Never indexed. `app/robots.ts` disallows `/staff/` as
  // well; this is the second layer, matching how the admin group does it.
  robots: { index: false, follow: false },
  title: 'SAKO OR - מלאי ומיקומים',
}

export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="light" suppressHydrationWarning>
      <RootShell lng="he">{children}</RootShell>
    </html>
  )
}
