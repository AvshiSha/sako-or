import type { Metadata } from 'next'

/**
 * Bare layout for the customer review flow.
 *
 * This route deliberately lives outside `app/[lng]` so it does NOT inherit that
 * layout's header and footer. The page is a single-purpose destination reached from
 * a one-off signed link in an SMS or email: site navigation here is a distraction
 * that competes with the only action that matters, and there is no journey to
 * continue into. The root layout still applies, so fonts and analytics are intact.
 */
export const metadata: Metadata = {
  // Per-order private URLs — never index them.
  robots: { index: false, follow: false },
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
