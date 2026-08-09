import { getProductDraft } from '@/lib/server/product-drafts'
import { verifyPreviewToken } from '@/lib/server/preview-token'
import PreviewShell from './PreviewShell'

export const dynamic = 'force-dynamic'

interface PreviewShellPageProps {
  params: Promise<{ draftId: string }>
  searchParams: Promise<{ token?: string; lng?: string }>
}

export default async function PreviewShellPage({ params, searchParams }: PreviewShellPageProps) {
  const { draftId } = await params
  const { token, lng: lngParam } = await searchParams
  const lng: 'en' | 'he' = lngParam === 'he' ? 'he' : 'en'

  if (!verifyPreviewToken(draftId, token)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-600">
          {lng === 'he' ? 'קישור התצוגה המקדימה פג תוקף או אינו תקין.' : 'This preview link is invalid or has expired.'}
        </p>
      </div>
    )
  }

  const draft = await getProductDraft(draftId)
  const variants: Record<string, any> = (draft?.payload as any)?.colorVariants || {}
  const defaultColorSlug = Object.keys(variants)[0] || 'default'

  return (
    <PreviewShell
      draftId={draftId}
      token={token || ''}
      lng={lng}
      defaultColorSlug={defaultColorSlug}
      sourceProductId={draft?.sourceProductId ?? null}
    />
  )
}
