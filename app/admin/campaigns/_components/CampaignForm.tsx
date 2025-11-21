'use client'

import { useState, useEffect } from 'react'
import { Campaign, CampaignProductFilter } from '@/lib/firebase'
import { ArrowLeftIcon, EyeIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CampaignFormData {
  slug: string
  title: { he: string; en: string }
  subtitle: { he: string; en: string }
  description: { he: string; en: string }
  seoTitle: { he: string; en: string }
  seoDescription: { he: string; en: string }
  bannerDesktopUrl: string
  bannerMobileUrl: string
  bannerDesktopVideoUrl: string
  bannerMobileVideoUrl: string
  active: boolean
  priority: number
  startAt: string
  endAt: string
  productFilter: CampaignProductFilter
  productIds: string[]
}

interface CampaignFormProps {
  initialData?: Campaign
  isEdit?: boolean
}

export default function CampaignForm({ initialData, isEdit = false }: CampaignFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'en' | 'he'>('en')
  const [productFilterMode, setProductFilterMode] = useState<'tag' | 'sale' | 'manual'>('tag')

  const [formData, setFormData] = useState<CampaignFormData>({
    slug: initialData?.slug || '',
    title: initialData?.title || { he: '', en: '' },
    subtitle: initialData?.subtitle || { he: '', en: '' },
    description: initialData?.description || { he: '', en: '' },
    seoTitle: initialData?.seoTitle || { he: '', en: '' },
    seoDescription: initialData?.seoDescription || { he: '', en: '' },
    bannerDesktopUrl: initialData?.bannerDesktopUrl || '',
    bannerMobileUrl: initialData?.bannerMobileUrl || '',
    bannerDesktopVideoUrl: initialData?.bannerDesktopVideoUrl || '',
    bannerMobileVideoUrl: initialData?.bannerMobileVideoUrl || '',
    active: initialData?.active ?? false,
    priority: initialData?.priority ?? 100,
    startAt: initialData?.startAt ? new Date(initialData.startAt).toISOString().slice(0, 16) : '',
    endAt: initialData?.endAt ? new Date(initialData.endAt).toISOString().slice(0, 16) : '',
    productFilter: initialData?.productFilter || {
      mode: 'tag',
      tag: '',
      limit: 120,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    },
    productIds: initialData?.productIds || []
  })

  useEffect(() => {
    if (initialData?.productFilter) {
      setProductFilterMode(initialData.productFilter.mode)
    }
  }, [initialData])

  const validateSlug = (slug: string): boolean => {
    return /^[a-z0-9-]+$/.test(slug) && slug.length > 0
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required'
    } else if (!validateSlug(formData.slug)) {
      newErrors.slug = 'Slug must be lowercase, alphanumeric with hyphens only (no spaces)'
    }

    if (!formData.title.en.trim() && !formData.title.he.trim()) {
      newErrors.title = 'At least one language must have a title'
    }

    if (formData.startAt && formData.endAt) {
      const start = new Date(formData.startAt)
      const end = new Date(formData.endAt)
      if (start > end) {
        newErrors.dates = 'Start date must be before end date'
      }
    }

    if (formData.active && formData.endAt) {
      const end = new Date(formData.endAt)
      if (end < new Date()) {
        newErrors.active = 'Warning: Campaign is active but end date is in the past'
      }
    }

    if (productFilterMode === 'tag' && !formData.productFilter.tag?.trim()) {
      newErrors.productFilter = 'Tag is required for tag-based selection'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent, saveAndClose: boolean = false) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Build campaign data, only including fields with actual values
      const campaignData: any = {
        slug: formData.slug,
        title: formData.title,
        active: formData.active,
        priority: formData.priority,
        productFilter: {
          ...formData.productFilter,
          mode: productFilterMode
        }
      }
      
      // Only include optional fields if they have values
      if (formData.subtitle.en || formData.subtitle.he) {
        campaignData.subtitle = formData.subtitle
      }
      if (formData.description.en || formData.description.he) {
        campaignData.description = formData.description
      }
      if (formData.seoTitle.en || formData.seoTitle.he) {
        campaignData.seoTitle = formData.seoTitle
      }
      if (formData.seoDescription.en || formData.seoDescription.he) {
        campaignData.seoDescription = formData.seoDescription
      }
      if (formData.bannerDesktopUrl?.trim()) {
        campaignData.bannerDesktopUrl = formData.bannerDesktopUrl.trim()
      }
      if (formData.bannerMobileUrl?.trim()) {
        campaignData.bannerMobileUrl = formData.bannerMobileUrl.trim()
      }
      if (formData.bannerDesktopVideoUrl?.trim()) {
        campaignData.bannerDesktopVideoUrl = formData.bannerDesktopVideoUrl.trim()
        console.log('Saving desktop video URL:', formData.bannerDesktopVideoUrl.trim())
      }
      if (formData.bannerMobileVideoUrl?.trim()) {
        campaignData.bannerMobileVideoUrl = formData.bannerMobileVideoUrl.trim()
        console.log('Saving mobile video URL:', formData.bannerMobileVideoUrl.trim())
      }
      
      console.log('Campaign data being saved:', campaignData)
      if (formData.startAt) {
        campaignData.startAt = new Date(formData.startAt).toISOString()
      }
      if (formData.endAt) {
        campaignData.endAt = new Date(formData.endAt).toISOString()
      }
      if (productFilterMode === 'manual' && formData.productIds && formData.productIds.length > 0) {
        campaignData.productIds = formData.productIds
      }

      const { campaignService } = await import('@/lib/firebase')
      if (isEdit) {
        await campaignService.updateCampaign(formData.slug, campaignData)
      } else {
        await campaignService.createCampaign(campaignData)
      }

      setShowSuccess(true)
      setTimeout(() => {
        if (saveAndClose) {
          router.push('/admin/campaigns')
        } else if (!isEdit) {
          router.push(`/admin/campaigns/${formData.slug}`)
        }
      }, 1000)
    } catch (error: any) {
      console.error('Error saving campaign:', error)
      alert(`Failed to save campaign: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateLocalizedField = (field: keyof CampaignFormData, lang: 'en' | 'he', value: string) => {
    if (field === 'title' || field === 'subtitle' || field === 'description' || field === 'seoTitle' || field === 'seoDescription') {
      setFormData(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          [lang]: value
        }
      }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {showSuccess && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-md shadow-lg z-50">
          Campaign saved successfully!
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/campaigns"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Edit Campaign' : 'New Campaign'}
          </h1>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    setFormData(prev => ({ ...prev, slug: value }))
                  }}
                  disabled={isEdit}
                  className={`w-full px-3 py-2 text-gray-700 border rounded-md ${errors.slug ? 'border-red-500' : 'border-gray-300'} ${isEdit ? 'bg-gray-100' : ''}`}
                  placeholder="black-friday-2025"
                />
                {errors.slug && <p className="mt-1 text-sm text-red-500">{errors.slug}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Lowercase, alphanumeric with hyphens only. Used in URL: /collection/campaign?slug=...
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Active
                  </label>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  {errors.active && <p className="mt-1 text-sm text-red-500">{errors.active}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500">Higher = more important when multiple active</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  />
                  {errors.dates && <p className="mt-1 text-sm text-red-500">{errors.dates}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Localized Content */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Localized Content</h2>
            
            {/* Language Tabs */}
            <div className="flex border-b mb-4">
              <button
                type="button"
                onClick={() => setActiveTab('en')}
                className={`px-4 py-2 font-medium ${activeTab === 'en' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('he')}
                className={`px-4 py-2 font-medium ${activeTab === 'he' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500'}`}
              >
                עברית
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title[activeTab]}
                  onChange={(e) => updateLocalizedField('title', activeTab, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  placeholder={activeTab === 'he' ? 'בלאק פריידיי' : 'Black Friday'}
                />
                {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle[activeTab]}
                  onChange={(e) => updateLocalizedField('subtitle', activeTab, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  placeholder={activeTab === 'he' ? 'עד 50% הנחה' : 'Up to 50% off'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description[activeTab]}
                  onChange={(e) => updateLocalizedField('description', activeTab, e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  placeholder={activeTab === 'he' ? 'תיאור המבצע...' : 'Campaign description...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Title
                </label>
                <input
                  type="text"
                  value={formData.seoTitle[activeTab]}
                  onChange={(e) => updateLocalizedField('seoTitle', activeTab, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  placeholder={activeTab === 'he' ? 'בלאק פריידיי | SAKO OR' : 'Black Friday | SAKO OR'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SEO Description
                </label>
                <textarea
                  value={formData.seoDescription[activeTab]}
                  onChange={(e) => updateLocalizedField('seoDescription', activeTab, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                  placeholder={activeTab === 'he' ? 'תיאור SEO...' : 'SEO description...'}
                />
              </div>
            </div>
          </div>

          {/* Banners */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Banners & Videos</h2>
            
            <div className="space-y-6">
              {/* Desktop */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">Desktop</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desktop Banner Image URL
                    </label>
                    <input
                      type="url"
                      value={formData.bannerDesktopUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, bannerDesktopUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      placeholder="https://... (image)"
                    />
                    {formData.bannerDesktopUrl && !formData.bannerDesktopVideoUrl && (
                      <div className="mt-2">
                        {formData.bannerDesktopUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            src={formData.bannerDesktopUrl}
                            className="w-full h-32 object-cover rounded"
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img src={formData.bannerDesktopUrl} alt="Desktop preview" className="w-full h-32 object-cover rounded" />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Desktop Banner Video URL (.mp4)
                    </label>
                    <input
                      type="url"
                      value={formData.bannerDesktopVideoUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, bannerDesktopVideoUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      placeholder="https://... (video.mp4)"
                    />
                    {formData.bannerDesktopVideoUrl && (
                      <div className="mt-2">
                        <video
                          src={formData.bannerDesktopVideoUrl}
                          className="w-full h-32 object-cover rounded"
                          muted
                          loop
                          playsInline
                        />
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Video takes priority over image if both are provided
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">Mobile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Banner Image URL
                    </label>
                    <input
                      type="url"
                      value={formData.bannerMobileUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, bannerMobileUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      placeholder="https://... (image)"
                    />
                    {formData.bannerMobileUrl && !formData.bannerMobileVideoUrl && (
                      <div className="mt-2">
                        {formData.bannerMobileUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            src={formData.bannerMobileUrl}
                            className="w-full h-32 object-cover rounded"
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img src={formData.bannerMobileUrl} alt="Mobile preview" className="w-full h-32 object-cover rounded" />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Banner Video URL (.mp4)
                    </label>
                    <input
                      type="url"
                      value={formData.bannerMobileVideoUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, bannerMobileVideoUrl: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      placeholder="https://... (video.mp4)"
                    />
                    {formData.bannerMobileVideoUrl && (
                      <div className="mt-2">
                        <video
                          src={formData.bannerMobileVideoUrl}
                          className="w-full h-32 object-cover rounded"
                          muted
                          loop
                          playsInline
                        />
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Video takes priority over image if both are provided
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Filter */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Product Selection</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selection Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center text-gray-700">
                    <input
                      type="radio"
                      value="tag"
                      checked={productFilterMode === 'tag'}
                      onChange={(e) => {
                        setProductFilterMode('tag')
                        setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, mode: 'tag' }
                        }))
                      }}
                      className="mr-2"
                    />
                    Tag-based selection
                  </label>
                  <label className="flex items-center text-gray-700">
                    <input
                      type="radio"
                      value="sale"
                      checked={productFilterMode === 'sale'}
                      onChange={(e) => {
                        setProductFilterMode('sale')
                        setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, mode: 'sale' }
                        }))
                      }}
                      className="mr-2"
                    />
                    All sale products
                  </label>
                  <label className="flex items-center text-gray-700">
                    <input
                      type="radio"
                      value="manual"
                      checked={productFilterMode === 'manual'}
                      onChange={(e) => {
                        setProductFilterMode('manual')
                        setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, mode: 'manual' }
                        }))
                      }}
                      className="mr-2"
                    />
                    Manual selection (future)
                  </label>
                </div>
              </div>

              {productFilterMode === 'tag' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tag <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.productFilter.tag || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        productFilter: { ...prev.productFilter, tag: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      placeholder="black-friday-2025"
                    />
                    {errors.productFilter && <p className="mt-1 text-sm text-red-500">{errors.productFilter}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      Products must include this tag in their tags[] field
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Limit
                      </label>
                      <input
                        type="number"
                        value={formData.productFilter.limit || 120}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, limit: parseInt(e.target.value) || 120 }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sort By
                      </label>
                      <select
                        value={formData.productFilter.orderBy || 'createdAt'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, orderBy: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      >
                        <option value="createdAt">Created Date</option>
                        <option value="salePrice">Sale Price</option>
                        <option value="popularity">Popularity</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Direction
                      </label>
                      <select
                        value={formData.productFilter.orderDirection || 'desc'}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          productFilter: { ...prev.productFilter, orderDirection: e.target.value as any }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700"
                      >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {productFilterMode === 'sale' && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-blue-800">
                    This will show all products where salePrice &gt; 0
                  </p>
                </div>
              )}

              {productFilterMode === 'manual' && (
                <div className="bg-yellow-50 p-4 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Manual product selection is not yet implemented. Coming soon!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center bg-white shadow rounded-lg p-6">
            <Link
              href="/admin/campaigns"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>

            <div className="flex gap-3">
              {isEdit && formData.slug && (
                <Link
                  href={`/en/collection/campaign?slug=${formData.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Preview
                </Link>
              )}

              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save & Close'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

