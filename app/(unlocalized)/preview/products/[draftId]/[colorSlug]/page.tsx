import { getProductDraft } from '@/lib/server/product-drafts'
import { verifyPreviewToken } from '@/lib/server/preview-token'
import { serializeFirestoreValue } from '@/lib/serialize-firestore'
import ProductColorClient from '@/app/(site)/[lng]/product/[baseSku]/[colorSlug]/ProductColorClient'

export const dynamic = 'force-dynamic'

interface PreviewColorPageProps {
  params: Promise<{ draftId: string; colorSlug: string }>
  searchParams: Promise<{ token?: string; lng?: string }>
}

function InvalidPreview({ lng, message }: { lng: 'en' | 'he'; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={lng === 'he' ? 'rtl' : 'ltr'}>
      <div className="text-center max-w-md">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {lng === 'he' ? 'תצוגה מקדימה לא זמינה' : 'Preview not available'}
        </h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export default async function PreviewColorPage({ params, searchParams }: PreviewColorPageProps) {
  const { draftId, colorSlug } = await params
  const { token, lng: lngParam } = await searchParams
  const lng: 'en' | 'he' = lngParam === 'he' ? 'he' : 'en'

  // The signed token — only ever minted by the requireAdmin-gated draft API route —
  // is the real server-side authorization check here. No draft data is read or
  // returned unless it validates, regardless of how this URL was reached.
  if (!verifyPreviewToken(draftId, token)) {
    return (
      <InvalidPreview
        lng={lng}
        message={
          lng === 'he'
            ? 'קישור התצוגה המקדימה פג תוקף או אינו תקין. חזרו לעמוד העריכה ולחצו שוב על "תצוגה מקדימה".'
            : 'This preview link is invalid or has expired. Return to the editing page and click Preview Product again.'
        }
      />
    )
  }

  const draft = await getProductDraft(draftId)
  if (!draft) {
    return (
      <InvalidPreview
        lng={lng}
        message={lng === 'he' ? 'הטיוטה לא נמצאה.' : 'This draft could not be found.'}
      />
    )
  }

  const product = serializeFirestoreValue(draft.payload) as any
  const variants: Record<string, any> = product.colorVariants || {}
  const variant =
    variants[colorSlug] ||
    Object.values(variants).find((v: any) => v.colorSlug === colorSlug) ||
    Object.values(variants)[0]

  if (!variant) {
    return (
      <InvalidPreview
        lng={lng}
        message={lng === 'he' ? 'לא הוגדרו וריאציות צבע עבור מוצר זה עדיין.' : 'No color variants have been added to this product yet.'}
      />
    )
  }

  const previewWarnings: Record<string, string> = {}
  for (const v of Object.values(variants) as any[]) {
    if (!v.images || v.images.length === 0) {
      previewWarnings[v.colorSlug] =
        lng === 'he' ? 'לא שויכו תמונות לצבע זה.' : 'No images assigned to this color.'
    }
  }

  // Mirrors the `dir`/`lang` wrapper app/[lng]/layout.tsx applies on the live
  // site — this preview route sits outside the [lng] segment (see PreviewShell
  // comment) so it never inherits that layout, and several RTL rules in
  // globals.css key off an actual `dir="rtl"` ancestor attribute, not just the
  // `rtl`/`ltr` Tailwind classes ProductColorClient itself already toggles.
  const direction = lng === 'he' ? 'rtl' : 'ltr'

  return (
    <div dir={direction} lang={lng}>
      <ProductColorClient
        lng={lng}
        baseSku={product.sku}
        colorSlug={variant.colorSlug}
        initialProduct={product}
        initialVariant={variant}
        previewMode
        previewBasePath={`/preview/products/${draftId}`}
        previewToken={token}
        sourceProductId={draft.sourceProductId}
        previewWarnings={previewWarnings}
      />
    </div>
  )
}
