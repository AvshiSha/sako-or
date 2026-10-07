'use client'

import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'
import { useUserProfile } from '@/app/hooks/useUserProfile'
import { SheetClose } from '@/app/components/ui/sheet'

interface MobileAuthGreetingProps {
  lng: string
}

/**
 * The navigation drawer's account row: a greeting and a route into the profile when
 * signed in, an invitation to sign in when not.
 *
 * Drawn as one more row of the drawer's own ladder (2014:2505), not as a card. It
 * used to be a rounded, gradient-filled, drop-shadowed box on gray-50/gray-200 with
 * Tailwind's default type scale - every one of which is something this design system
 * does not have. It now takes the same vocabulary as the category rows directly above
 * it: a 58px minimum row on the drawer's 16px inset, label in Ploni SemiBold 16/23,
 * supporting line in 13/16 on text-secondary, closed by the same 1px sako-black
 * hairline. Nothing here draws a radius, a fill, a gradient or a shadow.
 *
 * Signed-in and signed-out are one layout with different copy and a different href,
 * rather than two near-identical blocks - that is what let the two drift apart before,
 * when only one of them set its own `dir`.
 *
 * Language comes from the `lng` route segment the [lng] layout passes down, so it is
 * resolved on the server and correct in the first HTML; because the language switcher
 * navigates between /he and /en, a switch re-renders this with the new segment rather
 * than needing any client-side language state. Anything other than `he` reads as
 * English, matching the rest of the storefront.
 */
const copy = {
  he: {
    dir: 'rtl' as const,
    signInTitle: 'התחברו לחשבון שלכם',
    signInSubtitle: 'לצפייה בפרופיל, הזמנות ומועדון הלקוחות',
    loading: 'טוען...',
    greeting: (name: string | null) => (name ? `היי ${name}` : 'היי'),
    profileLink: 'לצפייה בפרופיל האישי שלך',
  },
  en: {
    dir: 'ltr' as const,
    signInTitle: 'Sign in to your account',
    signInSubtitle: 'View your profile, orders, and customer club',
    loading: 'Loading...',
    greeting: (name: string | null) => (name ? `Hi ${name}` : 'Hi'),
    profileLink: 'View your personal profile',
  },
}

export default function MobileAuthGreeting({ lng }: MobileAuthGreetingProps) {
  const { user } = useAuth()
  const { profile, isLoading: loading } = useUserProfile()
  const firstName = profile?.firstName || user?.displayName || null

  const t = lng === 'he' ? copy.he : copy.en
  const signedIn = Boolean(user)

  const href = signedIn ? `/${lng}/profile` : `/${lng}/signin`
  const title = signedIn ? (loading ? t.loading : t.greeting(firstName)) : t.signInTitle
  const subtitle = signedIn ? t.profileLink : t.signInSubtitle

  return (
    // lg:hidden, not md:hidden - the ☰ that opens this drawer is itself lg:hidden,
    // so between 768px and 1024px the drawer opened with this row missing entirely.
    <div className="px-[16px] lg:hidden" dir={t.dir}>
      <SheetClose asChild>
        <Link
          href={href}
          className="flex min-h-[58px] flex-col justify-center gap-[2px] border-b border-sako-black py-[12px] text-start transition-opacity hover:opacity-70"
        >
          <span className="font-ploni text-[16px] font-semibold leading-[23px] text-text-primary">
            {title}
          </span>
          <span className="font-ploni text-[13px] leading-[16px] text-text-secondary">
            {subtitle}
          </span>
        </Link>
      </SheetClose>
    </div>
  )
}
