'use client'

import { useState } from 'react'
import { EyeIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/app/hooks/useAuth'
import type { CategoryFieldGroup } from '@/lib/product-enums'
import type { CategoryLike, ProductFormInput, ProductImageFileInput, ProductVideoFileInput } from '../_lib/product-form-types'
import { buildProductPayload } from '../_lib/build-product-payload'
import { validateForPreview, type ProductFormErrors } from '../_lib/validate-product-form'

interface PreviewProductButtonProps {
  formData: ProductFormInput
  categories: CategoryLike[]
  categoryFieldGroup: CategoryFieldGroup
  /** True on the Add Product page, where create-only rules (bag type, intended
   * use) apply — so preview blocks on exactly what a save would block on. */
  isCreate?: boolean
  sourceProductId: string | null
  draftId: string | null
  onDraftIdChange: (draftId: string) => void
  onErrors: (errors: ProductFormErrors) => void
  onImagesUpdate: (variantId: string, images: ProductImageFileInput[]) => void
  onVideoUpdate: (variantId: string, video: ProductVideoFileInput | null) => void
}

export default function PreviewProductButton({
  formData,
  categories,
  categoryFieldGroup,
  isCreate = false,
  sourceProductId,
  draftId,
  onDraftIdChange,
  onErrors,
  onImagesUpdate,
  onVideoUpdate,
}: PreviewProductButtonProps) {
  const { user } = useAuth()
  const [isPreparing, setIsPreparing] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])

  const handlePreview = async () => {
    const { errors, warnings: colorWarnings } = validateForPreview(formData, categoryFieldGroup, isCreate)

    if (Object.keys(errors).length > 0) {
      onErrors(errors)
      setWarnings([])
      return
    }
    onErrors({})
    setWarnings(Object.values(colorWarnings))

    if (!user) {
      alert('You must be signed in as an admin to preview a product.')
      return
    }

    setIsPreparing(true)
    try {
      const payload = await buildProductPayload(formData, categories, {
        onImagesUpdate,
        onVideoUpdate,
      })

      const idToken = await user.getIdToken()
      const res = await fetch('/api/admin/products/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ draftId, sourceProductId, payload }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }

      const data = await res.json()
      onDraftIdChange(data.draftId)
      window.open(`/preview/products/${data.draftId}?token=${encodeURIComponent(data.token)}&lng=en`, '_blank')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Could not open preview: ${message}`)
    } finally {
      setIsPreparing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handlePreview}
        disabled={isPreparing}
        className="flex items-center gap-2 px-4 py-2 bg-[#856D55] border border-transparent rounded-md text-sm font-medium text-white hover:bg-[#6f5a45] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <EyeIcon className="h-4 w-4" />
        {isPreparing ? 'Preparing preview...' : 'Preview Product'}
      </button>
      {warnings.length > 0 && (
        <p className="max-w-xs text-right text-xs text-amber-700">{warnings.join(' ')}</p>
      )}
    </div>
  )
}
