'use client'

import { useState, useEffect } from 'react'
import { BlogArticle, blogService } from '@/lib/firebase'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/app/admin/_components/RichTextEditorLazy'
import { uploadCmsImage } from '@/lib/upload-cms-image'
import { slugify, revalidateCmsPaths } from '@/lib/cms-utils'
import { cleanupCmsHtml } from '@/lib/cms-html-cleanup'

interface BlogFormData {
  slug: string
  title: { he: string; en: string }
  excerpt: { he: string; en: string }
  content: { he: string; en: string }
  featuredImage: string
  featuredImageAlt: { he: string; en: string }
  publishedAt: string
  seoTitle: { he: string; en: string }
  seoDescription: { he: string; en: string }
  ogTitle: { he: string; en: string }
  ogDescription: { he: string; en: string }
  ogImage: string
}

interface BlogArticleFormProps {
  initialData?: BlogArticle
  isEdit?: boolean
}

const emptyLocalized = () => ({ en: '', he: '' })

export default function BlogArticleForm({ initialData, isEdit = false }: BlogArticleFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingFeatured, setIsUploadingFeatured] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'en' | 'he'>('en')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initialData?.slug))

  const [formData, setFormData] = useState<BlogFormData>({
    slug: initialData?.slug || '',
    title: initialData?.title || emptyLocalized(),
    excerpt: initialData?.excerpt || emptyLocalized(),
    content: initialData?.content
      ? {
          en: cleanupCmsHtml(initialData.content.en || ''),
          he: cleanupCmsHtml(initialData.content.he || ''),
        }
      : emptyLocalized(),
    featuredImage: initialData?.featuredImage || '',
    featuredImageAlt: initialData?.featuredImageAlt || emptyLocalized(),
    publishedAt: initialData?.publishedAt
      ? new Date(initialData.publishedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    seoTitle: initialData?.seoTitle || emptyLocalized(),
    seoDescription: initialData?.seoDescription || emptyLocalized(),
    ogTitle: initialData?.ogTitle || emptyLocalized(),
    ogDescription: initialData?.ogDescription || emptyLocalized(),
    ogImage: initialData?.ogImage || '',
  })

  useEffect(() => {
    if (!slugManuallyEdited && formData.title.en) {
      setFormData((prev) => ({ ...prev, slug: slugify(formData.title.en) }))
    }
  }, [formData.title.en, slugManuallyEdited])

  const updateLocalized = (
    field: keyof Pick<BlogFormData, 'title' | 'excerpt' | 'content' | 'featuredImageAlt' | 'seoTitle' | 'seoDescription' | 'ogTitle' | 'ogDescription'>,
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

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required'
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug must be lowercase alphanumeric with hyphens only'
    }

    if (!formData.title.en.trim() && !formData.title.he.trim()) {
      newErrors.title = 'At least one language must have a title'
    }

    if (!formData.excerpt.en.trim() && !formData.excerpt.he.trim()) {
      newErrors.excerpt = 'At least one language must have an excerpt'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFeatured(true)
    try {
      const url = await uploadCmsImage(file, 'blog')
      setFormData((prev) => ({ ...prev, featuredImage: url }))
    } catch {
      alert('Failed to upload featured image')
    } finally {
      setIsUploadingFeatured(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const isUnique = await blogService.checkSlugUnique(
        formData.slug,
        isEdit ? initialData?.id : undefined
      )
      if (!isUnique) {
        setErrors({ slug: 'This slug is already in use' })
        setIsSubmitting(false)
        return
      }

      const publishedAt =
        status === 'published'
          ? formData.publishedAt
            ? new Date(formData.publishedAt).toISOString()
            : new Date().toISOString()
          : initialData?.publishedAt || new Date().toISOString()

      const payload = {
        slug: formData.slug,
        title: formData.title,
        excerpt: formData.excerpt,
        content: {
          en: cleanupCmsHtml(formData.content.en),
          he: cleanupCmsHtml(formData.content.he),
        },
        featuredImage: formData.featuredImage,
        featuredImageAlt: formData.featuredImageAlt,
        status,
        publishedAt,
        seoTitle: formData.seoTitle,
        seoDescription: formData.seoDescription,
        ogTitle: formData.ogTitle,
        ogDescription: formData.ogDescription,
        ogImage: formData.ogImage || undefined,
      }

      if (isEdit && initialData?.id) {
        await blogService.updateArticle(initialData.id, payload)
      } else {
        await blogService.createArticle(payload)
      }

      const paths = [
        '/en/news',
        '/he/news',
        `/en/news/${formData.slug}`,
        `/he/news/${formData.slug}`,
      ]
      await revalidateCmsPaths(paths)

      router.push('/admin/blog')
    } catch (error) {
      console.error('Error saving article:', error)
      alert('Failed to save article')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit || !initialData?.id) return
    if (!confirm('Delete this article permanently?')) return

    setIsSubmitting(true)
    try {
      await blogService.deleteArticle(initialData.id)
      await revalidateCmsPaths(['/en/news', '/he/news'])
      router.push('/admin/blog')
    } catch {
      alert('Failed to delete article')
    } finally {
      setIsSubmitting(false)
    }
  }

  const uploadBlogImage = (file: File) => uploadCmsImage(file, 'blog')

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
          href="/admin/blog"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Blog
        </Link>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Delete Article
          </button>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Article' : 'New Article'}
        </h1>
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

      {/* Slug & date (language-independent) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => {
              setSlugManuallyEdited(true)
              setFormData((prev) => ({ ...prev, slug: e.target.value }))
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            placeholder="how-to-style-sneakers"
          />
          {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
          <p className="mt-1 text-xs text-gray-500">/news/{formData.slug || 'your-slug'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publication Date</label>
          <input
            type="datetime-local"
            value={formData.publishedAt}
            onChange={(e) => setFormData((prev) => ({ ...prev, publishedAt: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
          />
        </div>
      </div>

      {/* Localized fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={formData.title[activeTab]}
          onChange={(e) => updateLocalized('title', activeTab, e.target.value)}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt / Summary *</label>
        <textarea
          value={formData.excerpt[activeTab]}
          onChange={(e) => updateLocalized('excerpt', activeTab, e.target.value)}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
        />
        {errors.excerpt && <p className="mt-1 text-sm text-red-600">{errors.excerpt}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
        <RichTextEditor
          key={activeTab}
          editorKey={activeTab}
          value={formData.content[activeTab]}
          onChange={(html) => updateLocalized('content', activeTab, html)}
          onUploadImage={uploadBlogImage}
          dir={activeTab === 'he' ? 'rtl' : 'ltr'}
          placeholder={
            isEdit
              ? undefined
              : activeTab === 'he'
                ? 'כתבו את תוכן המאמר…'
                : 'Write your article content…'
          }
        />
      </div>

      {/* Featured image */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Featured Image</h2>
        <div className="space-y-4">
          {formData.featuredImage ? (
            <div className="space-y-3">
              <img
                src={formData.featuredImage}
                alt="Featured"
                className="h-40 w-auto max-w-full rounded-md object-cover border border-gray-200"
              />
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, featuredImage: '' }))}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove image
              </button>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFeaturedImageUpload}
                className="hidden"
                id="blog-featured-image"
                disabled={isUploadingFeatured}
              />
              <label
                htmlFor="blog-featured-image"
                className={`inline-flex cursor-pointer items-center rounded-md px-4 py-2 text-sm font-medium text-white ${
                  isUploadingFeatured
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-black hover:bg-gray-800'
                }`}
              >
                {isUploadingFeatured ? 'Uploading…' : 'Choose image'}
              </label>
              <p className="mt-2 text-sm text-gray-500">
                JPG, PNG, or WebP. Shown on the news listing and article page.
              </p>
            </div>
          )}
          {formData.featuredImage && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFeaturedImageUpload}
                className="hidden"
                id="blog-featured-image-replace"
                disabled={isUploadingFeatured}
              />
              <label
                htmlFor="blog-featured-image-replace"
                className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {isUploadingFeatured ? 'Uploading…' : 'Replace image'}
              </label>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Featured Image Alt Text ({activeTab.toUpperCase()})
            </label>
            <input
              type="text"
              value={formData.featuredImageAlt[activeTab]}
              onChange={(e) => updateLocalized('featuredImageAlt', activeTab, e.target.value)}
              dir={activeTab === 'he' ? 'rtl' : 'ltr'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            />
          </div>
        </div>
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
              placeholder="Leave empty to use featured image"
            />
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
    </form>
  )
}
