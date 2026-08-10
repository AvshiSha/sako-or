import type { Metadata } from 'next'

// Per-user account view; requires authentication.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
