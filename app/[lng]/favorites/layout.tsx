import { ReactNode } from 'react'

interface FavoritesLayoutProps {
  children: ReactNode
  params: Promise<{
    lng: string
  }>
}

export default async function FavoritesLayout({ children, params }: FavoritesLayoutProps) {
  const { lng } = await params
  const isRTL = lng === 'he'

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  )
}
