import { notFound } from 'next/navigation'

interface ProductLayoutProps {
  children: React.ReactNode
  params: Promise<{
    lng: string
    baseSku: string
  }>
}

export default async function ProductLayout({ children, params }: ProductLayoutProps) {
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
