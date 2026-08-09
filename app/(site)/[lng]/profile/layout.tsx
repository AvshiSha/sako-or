import type { Metadata } from 'next'
import ProfileLayoutClient from './ProfileLayoutClient'

/**
 * Server wrapper that exists purely to carry metadata.
 *
 * The real layout is a client component (it reads auth state and redirects),
 * and a client component cannot export `metadata`. Splitting the shell off is
 * the only way to mark this subtree noindex - without it the whole /profile
 * tree was indexable, and every page under it renders the same auth spinner
 * to a crawler, which Google reads as thin duplicate content.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProfileLayoutClient>{children}</ProfileLayoutClient>
}
