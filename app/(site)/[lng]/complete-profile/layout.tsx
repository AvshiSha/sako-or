import type { Metadata } from 'next'

// Post-signup form reached mid-flow; requires session state to render anything.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function CompleteProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
