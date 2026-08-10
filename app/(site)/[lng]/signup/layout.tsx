import type { Metadata } from 'next'

// Registration form - no indexable content.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
