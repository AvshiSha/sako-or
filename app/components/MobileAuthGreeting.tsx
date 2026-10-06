'use client'

import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'
import { useUserProfile } from '@/app/hooks/useUserProfile'
import { SheetClose } from '@/app/components/ui/sheet'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface MobileAuthGreetingProps {
  lng: string
}

/**
 * The navigation drawer's account row: a greeting and a route into the profile when
 * signed in, an invitation to sign in when not.
 *
 * Language comes from the `lng` route segment the [lng] layout passes down, so it is
 * resolved on the server and already correct in the first HTML - and because the
 * language switcher navigates between /he and /en, a switch re-renders this with the
 * new segment rather than needing any client-side language state to be kept in step.
 * Anything other than `he` reads as English, matching the rest of the storefront.
 *
 * Every string lives in `copy` below rather than in a `lng === 'he' ? …` at each use
 * site. The greeting and the sign-in invitation drifted that way before: the signed-in
 * branch set its own `dir` and the signed-out branch did not, so the Hebrew sign-in
 * text was laid out on an LTR base (the drawer's Radix ScrollArea stamps dir="ltr" on
 * its root, which beats the rtl on <html>). One table, one `dir`, applied once.
 */
const copy = {
  he: {
    dir: 'rtl' as const,
    signInTitle: '👋 התחברו לחשבון שלכם',
    signInSubtitle: 'לצפייה בפרופיל, הזמנות ומועדון הלקוחות',
    loading: 'טוען...',
    greeting: (name: string | null) =>
      name ? `היי ${name}, כיף לראות אותך כאן 🙂` : 'היי, כיף לראות אותך כאן 🙂',
    profileLink: 'לצפייה בפרופיל האישי שלך',
  },
  en: {
    dir: 'ltr' as const,
    signInTitle: '👋 Sign in to your account',
    signInSubtitle: 'View your profile, orders, and customer club',
    loading: 'Loading...',
    greeting: (name: string | null) =>
      name ? `Hi ${name}, nice to see you here 🙂` : 'Hi, nice to see you here 🙂',
    profileLink: 'View your personal profile',
  },
}

export default function MobileAuthGreeting({ lng }: MobileAuthGreetingProps) {
  const { user } = useAuth()
  const { profile, isLoading: loading } = useUserProfile()
  const firstName = profile?.firstName || user?.displayName || null

  const t = lng === 'he' ? copy.he : copy.en
  // The arrow points the way reading runs, so it has to swap with the language:
  // trailing a Hebrew line it leads left, trailing an English one it leads right.
  const Arrow = t.dir === 'rtl' ? ArrowLeft : ArrowRight

  // If user is not logged in
  if (!user) {
    return (
      // lg:hidden, not md:hidden - the ☰ that opens this drawer is itself lg:hidden,
      // so between 768px and 1024px the drawer opened with this row missing entirely.
      <div className="border-t border-gray-200 px-4 py-4 lg:hidden" dir={t.dir}>
        <SheetClose asChild>
          <Link
            href={`/${lng}/signin`}
            className="block w-full rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 p-4 border border-gray-200"
          >
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {t.signInTitle}
                </div>
                <div className="text-xs text-gray-600">
                  {t.signInSubtitle}
                </div>
              </div>
            </div>
          </Link>
        </SheetClose>
      </div>
    )
  }

  // If user is logged in
  const greeting = t.greeting(firstName)

  return (
    <div className="border-t border-gray-200 px-4 py-4 lg:hidden" dir={t.dir}>
      <SheetClose asChild>
        <Link
          href={`/${lng}/profile`}
          // text-start, not text-right/text-left: the direction is already set on the
          // wrapper, so the logical keyword follows it instead of restating the side.
          className="block w-full rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all duration-200 p-4 border border-gray-200 shadow-sm active:scale-[0.98] text-start"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 mb-1 leading-tight">
                {loading ? t.loading : greeting}
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <span>{t.profileLink}</span>
                <Arrow className="h-3 w-3" />
              </div>
            </div>
          </div>
        </Link>
      </SheetClose>
    </div>
  )
}
