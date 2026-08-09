import type { Metadata } from 'next'

// One-step OTP screen reached mid-flow; meaningless as a landing page.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function VerifySmsLayout({ children }: { children: React.ReactNode }) {
  return children
}
