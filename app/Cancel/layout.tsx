import type { Metadata } from 'next'

// Payment-gateway cancel callback: reachable at this exact literal URL by
// hardcoded configuration on the payment processor's side, so it can't be
// moved under /[lng]/. It has no indexable content, so keep it out of search.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function CancelLayout({ children }: { children: React.ReactNode }) {
  return children
}
