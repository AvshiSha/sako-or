import type { Metadata } from 'next'

// Authentication form - no indexable content, and an indexed sign-in page competes with real pages for the brand query.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function SigninLayout({ children }: { children: React.ReactNode }) {
  return children
}
