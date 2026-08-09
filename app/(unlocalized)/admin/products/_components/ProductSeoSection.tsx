'use client'

import { useState } from 'react'
import SeoFieldCounter from './SeoFieldCounter'
import SeoSearchPreview from './SeoSearchPreview'
import SeoKeywordInput from './SeoKeywordInput'
import { SEO_TITLE_RANGE, META_DESCRIPTION_RANGE, SLUG_WARN_LENGTH, isOverWarnLength } from '@/lib/seo-length'
import { buildSeoExportPayload, type SeoExportInput } from '@/lib/product-seo-export'

export interface ProductSeoValues {
  title_en: string
  title_he: string
  description_en: string
  description_he: string
  slug: string
  focusKeyword_en?: string
  focusKeyword_he?: string
  secondaryKeywords_en: string[]
  secondaryKeywords_he: string[]
}

interface ProductSeoSectionProps {
  values: ProductSeoValues
  onChange: <K extends keyof ProductSeoValues>(field: K, value: ProductSeoValues[K]) => void
  /** The real, live product URL — the slug below is stored for metadata only and does not currently change routing. */
  productUrl: string
  /** Rest of the in-progress product form, used only to build the "copy for SEO" JSON snapshot. */
  productDraft?: SeoExportInput
}

const fieldClass =
  'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

export default function ProductSeoSection({ values, onChange, productUrl, productDraft }: ProductSeoSectionProps) {
  const slugTooLong = isOverWarnLength(values.slug, SLUG_WARN_LENGTH)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const handleCopyForSeo = async () => {
    const payload = buildSeoExportPayload({ ...productDraft, seo: values })
    const json = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    setTimeout(() => setCopyState('idle'), 2500)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-900">SEO Settings</h2>
        <button
          type="button"
          onClick={handleCopyForSeo}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          title="Copies this product's data as JSON. Paste it into a Claude Code chat and ask it to run the seo-suggest skill."
        >
          {copyState === 'copied'
            ? 'Copied — paste into Claude Code'
            : copyState === 'failed'
              ? 'Copy failed — check clipboard permission'
              : 'Copy product data for SEO (/seo-suggest)'}
        </button>
      </div>

      <div className="mb-6">
        <label htmlFor="seo_slug" className="block text-sm font-medium text-gray-700">
          URL Slug
        </label>
        <input
          type="text"
          id="seo_slug"
          dir="ltr"
          value={values.slug}
          onChange={(e) => onChange('slug', e.target.value)}
          className={fieldClass}
          placeholder="silver-leather-pumps"
        />
        <p className={`mt-1 text-xs ${slugTooLong ? 'text-amber-600' : 'text-gray-500'}`}>
          {slugTooLong ? 'This slug is longer than necessary — shorter slugs are easier to read and share. ' : ''}
          Stored for SEO metadata. The live product URL is currently {productUrl}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Hebrew SEO */}
        <div className="border border-gray-200 rounded-lg p-4" dir="rtl">
          <h3 className="text-md font-medium text-gray-900 mb-3">SEO בעברית (Hebrew SEO)</h3>

          <div className="mb-4">
            <label htmlFor="seo_title_he" className="block text-sm font-medium text-gray-700">
              כותרת SEO (Hebrew SEO title)
            </label>
            <input
              type="text"
              id="seo_title_he"
              dir="rtl"
              value={values.title_he}
              onChange={(e) => onChange('title_he', e.target.value)}
              className={fieldClass}
              placeholder="נעלי סירה כסופות מעור לנשים | שם החנות"
            />
            <SeoFieldCounter value={values.title_he} range={SEO_TITLE_RANGE} />
          </div>

          <div className="mb-4">
            <label htmlFor="seo_description_he" className="block text-sm font-medium text-gray-700">
              תיאור מטא (Hebrew meta description)
            </label>
            <textarea
              id="seo_description_he"
              dir="rtl"
              rows={3}
              value={values.description_he}
              onChange={(e) => onChange('description_he', e.target.value)}
              className={fieldClass}
              placeholder="תיאור קצר וממוקד שמעודד לחיצה מתוצאות החיפוש"
            />
            <SeoFieldCounter value={values.description_he} range={META_DESCRIPTION_RANGE} />
          </div>

          <div className="mb-4">
            <label htmlFor="focusKeyword_he" className="block text-sm font-medium text-gray-700">
              מילת מפתח ראשית (Focus keyword)
            </label>
            <input
              type="text"
              id="focusKeyword_he"
              dir="rtl"
              value={values.focusKeyword_he ?? ''}
              onChange={(e) => onChange('focusKeyword_he', e.target.value)}
              className={fieldClass}
              placeholder="נעלי סירה כסופות"
            />
          </div>

          <SeoKeywordInput
            label="מילות מפתח משניות (Secondary keywords)"
            values={values.secondaryKeywords_he}
            onChange={(next) => onChange('secondaryKeywords_he', next)}
            dir="rtl"
            placeholder="הקלידו מילת מפתח ולחצו Enter"
          />

          <div className="mt-4">
            <SeoSearchPreview
              title={values.title_he}
              url={productUrl}
              description={values.description_he}
              dir="rtl"
              emptyTitlePlaceholder="ללא כותרת"
            />
          </div>
        </div>

        {/* English SEO */}
        <div className="border border-gray-200 rounded-lg p-4" dir="ltr">
          <h3 className="text-md font-medium text-gray-900 mb-3">English SEO</h3>

          <div className="mb-4">
            <label htmlFor="seo_title_en" className="block text-sm font-medium text-gray-700">
              SEO Title (English)
            </label>
            <input
              type="text"
              id="seo_title_en"
              dir="ltr"
              value={values.title_en}
              onChange={(e) => onChange('title_en', e.target.value)}
              className={fieldClass}
              placeholder="Women's Silver Leather Pumps | Store Name"
            />
            <SeoFieldCounter value={values.title_en} range={SEO_TITLE_RANGE} />
          </div>

          <div className="mb-4">
            <label htmlFor="seo_description_en" className="block text-sm font-medium text-gray-700">
              Meta Description (English)
            </label>
            <textarea
              id="seo_description_en"
              dir="ltr"
              rows={3}
              value={values.description_en}
              onChange={(e) => onChange('description_en', e.target.value)}
              className={fieldClass}
              placeholder="A short, compelling description that encourages a click from search results"
            />
            <SeoFieldCounter value={values.description_en} range={META_DESCRIPTION_RANGE} />
          </div>

          <div className="mb-4">
            <label htmlFor="focusKeyword_en" className="block text-sm font-medium text-gray-700">
              Focus Keyword
            </label>
            <input
              type="text"
              id="focusKeyword_en"
              dir="ltr"
              value={values.focusKeyword_en ?? ''}
              onChange={(e) => onChange('focusKeyword_en', e.target.value)}
              className={fieldClass}
              placeholder="silver pumps for women"
            />
          </div>

          <SeoKeywordInput
            label="Secondary Keywords"
            values={values.secondaryKeywords_en}
            onChange={(next) => onChange('secondaryKeywords_en', next)}
            dir="ltr"
            placeholder="Type a keyword and press Enter"
          />

          <div className="mt-4">
            <SeoSearchPreview
              title={values.title_en}
              url={productUrl}
              description={values.description_en}
              dir="ltr"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
