import type { Metadata } from 'next'
import StaticCmsPage, { buildStaticCmsPageMetadata } from '@/app/components/StaticCmsPage'

const PAGE_KEY = 'policies'
const PUBLIC_PATH = '/policies'

// Static pages carry no per-request dynamic data (unlike blog's related-products
// carousel), so they're statically generated with a time-based ISR fallback —
// on-save revalidateCmsPaths() already busts this on-demand from the admin form.
export const revalidate = 86400

interface PoliciesPageProps {
  params: Promise<{ lng: string }>
}

export async function generateMetadata({ params }: PoliciesPageProps): Promise<Metadata> {
  const { lng } = await params
  return buildStaticCmsPageMetadata({ pageKey: PAGE_KEY, publicPath: PUBLIC_PATH, lng })
}

export default async function PoliciesPage({ params }: PoliciesPageProps) {
  const { lng } = await params
  return <StaticCmsPage pageKey={PAGE_KEY} lng={lng} />
}
