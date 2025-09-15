import { notFound } from 'next/navigation'

interface ProductColorLayoutProps {
  children: React.ReactNode
  params: Promise<{
    lng: string
    baseSku: string
    colorSlug: string
  }>
}

export default async function ProductColorLayout({ children, params }: ProductColorLayoutProps) {
  const { lng } = await params
  
  // Validate language
  if (!['en', 'he'].includes(lng)) {
    notFound()
  }
  
  return (
    <div className={`${lng === 'he' ? 'rtl' : 'ltr'}`}>
      {children}
    </div>
  )
}
