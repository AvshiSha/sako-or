import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Product Preview | SAKO-OR Admin',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function PreviewColorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
