import { ReactNode } from 'react'

interface CartLayoutProps {
  children: ReactNode
  params: Promise<{
    lng: string
  }>
}

export default async function CartLayout({ children, params }: CartLayoutProps) {
  const { lng } = await params
  const isRTL = lng === 'he'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
