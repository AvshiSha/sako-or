'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  StaticPage,
  StaticPageRobots,
  staticPageService,
  type StaticPageStatus,
} from '@/lib/firebase'
import type { StaticPageDefinition } from '@/lib/static-page-registry'
import { ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline'
import RichTextEditor from '@/app/(unlocalized)/admin/_components/RichTextEditorLazy'
import { revalidateCmsPaths } from '@/lib/cms-utils'
import { cleanupCmsHtml, cmsHtmlToPlainText, isCmsHtmlEmpty, normalizeInlineFieldHtml } from '@/lib/cms-html-cleanup'
import StaticPagePreviewModal from './StaticPagePreviewModal'

interface StaticPageFormData {
  title: { he: string; en: string }
  content: { he: string; en: string }
  robots: StaticPageRobots
  seoTitle: { he: string; en: string }
  seoDescription: { he: string; en: string }
  ogTitle: { he: string; en: string }
  ogDescription: { he: string; en: string }
  ogImage: string
}

interface StaticPageFormProps {
  definition: StaticPageDefinition
  initialData: StaticPage | null
}

const emptyLocalized = () => ({ en: '', he: '' })

export default function StaticPageForm({ definition, initialData }: StaticPageFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'en' | 'he'>('en')
  const [previewOpen, setPreviewOpen] = useState(false)

  const [formData, setFormData] = useState<StaticPageFormData>({
    title: initialData?.title
      ? {
          en: normalizeInlineFieldHtml(initialData.title.en || ''),
          he: normalizeInlineFieldHtml(initialData.title.he || ''),
        }
      : emptyLocalized(),
    content: initialData?.content
      ? {
          en: cleanupCmsHtml(initialData.content.en || ''),
          he: cleanupCmsHtml(initialData.content.he || ''),
        }
      : emptyLocalized(),
    robots: initialData?.robots || 'index, follow',
    seoTitle: initialData?.seoTitle || emptyLocalized(),
    seoDescription: initialData?.seoDescription || emptyLocalized(),
    ogTitle: initialData?.ogTitle || emptyLocalized(),
    ogDescription: initialData?.ogDescription || emptyLocalized(),
    ogImage: initialData?.ogImage || '',
  })

  const updateLocalized = (
    field: keyof Pick<StaticPageFormData, 'title' | 'content' | 'seoTitle' | 'seoDescription' | 'ogTitle' | 'ogDescription'>,
    locale: 'en' | 'he',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: { ...prev[field], [locale]: value },
    }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (isCmsHtmlEmpty(formData.title.en) && isCmsHtmlEmpty(formData.title.he)) {
      newErrors.title = 'At least one language must have a title'
    }
    if (isCmsHtmlEmpty(formData.content.en) && isCmsHtmlEmpty(formData.content.he)) {
      newErrors.content = 'At least one language must have content'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (status: StaticPageStatus) => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const payload = {
        title: {
          en: cleanupCmsHtml(formData.title.en),
          he: cleanupCmsHtml(formData.title.he),
        },
        content: {
          en: cleanupCmsHtml(formData.content.en),
          he: cleanupCmsHtml(formData.content.he),
        },
        status,
        robots: formData.robots,
        seoTitle: formData.seoTitle,
        seoDescription: formData.seoDescription,
        ogTitle: formData.ogTitle,
        ogDescription: formData.ogDescription,
        ogImage: formData.ogImage || undefined,
      }

      await staticPageService.upsertStaticPage(definition.key, payload)
      await revalidateCmsPaths([`/en${definition.publicPath}`, `/he${definition.publicPath}`])

      router.push('/admin/content/pages')
    } catch (error) {
      console.error('Error saving static page:', error)
      alert('Failed to save page')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit('draft')
      }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <Link
          href="/admin/content/pages"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Content Pages
        </Link>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <EyeIcon className="mr-2 h-4 w-4" />
          Preview
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{definition.adminLabel}</h1>
        <p className="mt-1 text-sm text-gray-500">{`/{lng}${definition.publicPath}`}</p>
      </div>

      {/* Language tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['en', 'he'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'en' ? 'English' : 'Hebrew'}
          </button>
        ))}
      </div>

      {/* Localized fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <RichTextEditor
          key={`title-${activeTab}`}
          editorKey={`title-${activeTab}`}
          variant="inline"
          value={formData.title[activeTab]}
          onChange={(html) => updateLocalized('title', activeTab, html)}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          placeholder={activeTab === 'he' ? 'כותרת העמוד…' : 'Page title…'}
        />
        <p className="mt-1 text-xs text-gray-500">
          Rendered as the page&apos;s single H1. Select text and use the link button to add a hyperlink.
        </p>
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
        <RichTextEditor
          key={activeTab}
          editorKey={activeTab}
          value={formData.content[activeTab]}
          onChange={(html) => updateLocalized('content', activeTab, html)}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          placeholder={activeTab === 'he' ? 'כתבו את תוכן העמוד…' : 'Write the page content…'}
        />
        <p className="mt-1 text-xs text-gray-500">
          Body headings start at H2 to keep the page&apos;s heading hierarchy correct.
        </p>
        {errors.content && <p className="mt-1 text-sm text-red-600">{errors.content}</p>}
      </div>

      {/* SEO */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">SEO</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Title ({activeTab.toUpperCase()})
            </label>
            <input
              type="text"
              value={formData.seoTitle[activeTab]}
              onChange={(e) => updateLocalized('seoTitle', activeTab, e.target.value)}
              dir={activeTab === 'he' ? 'rtl' : 'ltr'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              placeholder={cmsHtmlToPlainText(formData.title[activeTab]) || undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description ({activeTab.toUpperCase()})
            </label>
            <textarea
              value={formData.seoDescription[activeTab]}
              onChange={(e) => updateLocalized('seoDescription', activeTab, e.target.value)}
              dir={activeTab === 'he' ? 'rtl' : 'ltr'}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              placeholder="Falls back to the page content when left empty"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Open Graph Title ({activeTab.toUpperCase()})
            </label>
            <input
              type="text"
              value={formData.ogTitle[activeTab]}
              onChange={(e) => updateLocalized('ogTitle', activeTab, e.target.value)}
              dir={activeTab === 'he' ? 'rtl' : 'ltr'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Open Graph Description ({activeTab.toUpperCase()})
            </label>
            <textarea
              value={formData.ogDescription[activeTab]}
              onChange={(e) => updateLocalized('ogDescription', activeTab, e.target.value)}
              dir={activeTab === 'he' ? 'rtl' : 'ltr'}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Open Graph Image URL (optional)
            </label>
            <input
              type="url"
              value={formData.ogImage}
              onChange={(e) => setFormData((prev) => ({ ...prev, ogImage: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
              placeholder="Leave empty to use the default site image"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Robots</label>
            <select
              value={formData.robots}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, robots: e.target.value as StaticPageRobots }))
              }
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="index, follow">Index, Follow (default)</option>
              <option value="noindex, follow">Noindex, Follow</option>
              <option value="noindex, nofollow">Noindex, Nofollow</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Applies to both languages. Change to Noindex to hide this page from search engines.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={isSubmitting}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('published')}
          disabled={isSubmitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isSubmitting ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      {previewOpen && (
        <StaticPagePreviewModal
          title={formData.title[activeTab]}
          content={formData.content[activeTab]}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </form>
  )
}
