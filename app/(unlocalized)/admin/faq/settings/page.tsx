'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/app/contexts/AuthContext'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import RichTextEditor from '@/app/(unlocalized)/admin/_components/RichTextEditorLazy'
import SeoFieldCounter from '@/app/(unlocalized)/admin/products/_components/SeoFieldCounter'
import { META_DESCRIPTION_RANGE, SEO_TITLE_RANGE } from '@/lib/seo-length'
import { cleanupCmsHtml } from '@/lib/cms-html-cleanup'
import { checkInternalPath } from '@/lib/schemas/faq-schema'
import { issuesToFieldMap, loadFaqSettings, saveFaqSettings } from '@/lib/admin/faq-client'
import {
  FAQ_AUDIENCES,
  FAQ_AUDIENCE_LABELS,
  FAQ_SETTINGS_FALLBACK,
  type FaqAudience,
  type FaqRobots,
} from '@/lib/faq-types'

type Localized = { he: string; en: string }

const empty = (): Localized => ({ he: '', en: '' })

interface CtaDraft {
  label: Localized
  href: string
}

export default function FaqSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'he' | 'en'>('he')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const inFlight = useRef(false)

  const [heading, setHeading] = useState<Localized>(FAQ_SETTINGS_FALLBACK.heading)
  const [intro, setIntro] = useState<Localized>(FAQ_SETTINGS_FALLBACK.intro)
  const [sectionTitles, setSectionTitles] = useState<Record<FaqAudience, Localized>>(
    FAQ_SETTINGS_FALLBACK.sectionTitles
  )
  const [seoTitle, setSeoTitle] = useState<Localized>(FAQ_SETTINGS_FALLBACK.seoTitle)
  const [seoDescription, setSeoDescription] = useState<Localized>(
    FAQ_SETTINGS_FALLBACK.seoDescription
  )
  const [ogTitle, setOgTitle] = useState<Localized>(empty())
  const [ogDescription, setOgDescription] = useState<Localized>(empty())
  const [ogImage, setOgImage] = useState('')
  const [robots, setRobots] = useState<FaqRobots>('index, follow')
  const [primaryCta, setPrimaryCta] = useState<CtaDraft>(FAQ_SETTINGS_FALLBACK.primaryCta)
  const [secondaryCta, setSecondaryCta] = useState<CtaDraft>(
    FAQ_SETTINGS_FALLBACK.secondaryCta ?? { label: empty(), href: '' }
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      const result = await loadFaqSettings(user)
      if (cancelled) return

      if (!result.ok) {
        setNotice({ type: 'error', message: result.error })
      } else if (result.data.settings) {
        // Existing values win; the fallback fills any field never set, so the
        // form is never blank and the public page never renders an empty h1.
        const s = result.data.settings
        setHeading(s.heading ?? FAQ_SETTINGS_FALLBACK.heading)
        setIntro(s.intro ?? FAQ_SETTINGS_FALLBACK.intro)
        setSectionTitles(s.sectionTitles ?? FAQ_SETTINGS_FALLBACK.sectionTitles)
        setSeoTitle(s.seoTitle ?? FAQ_SETTINGS_FALLBACK.seoTitle)
        setSeoDescription(s.seoDescription ?? FAQ_SETTINGS_FALLBACK.seoDescription)
        setOgTitle(s.ogTitle ?? empty())
        setOgDescription(s.ogDescription ?? empty())
        setOgImage(s.ogImage ?? '')
        setRobots(s.robots ?? 'index, follow')
        setPrimaryCta(s.primaryCta ?? FAQ_SETTINGS_FALLBACK.primaryCta)
        setSecondaryCta(
          s.secondaryCta ?? FAQ_SETTINGS_FALLBACK.secondaryCta ?? { label: empty(), href: '' }
        )
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const setLocalized = (
    setter: React.Dispatch<React.SetStateAction<Localized>>,
    locale: 'he' | 'en',
    value: string
  ) => setter((prev) => ({ ...prev, [locale]: value }))

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!heading.he.trim() && !heading.en.trim()) {
      next.heading = 'A page heading is required in at least one language'
    }

    // Mirrors the server rule exactly. This copy is for feedback; the schema on
    // the route is what actually enforces it.
    const primaryCheck = checkInternalPath(primaryCta.href)
    if (!primaryCheck.valid) next.primaryCtaHref = primaryCheck.reason ?? 'Invalid destination'

    if (secondaryCta.href.trim() || secondaryCta.label.he.trim() || secondaryCta.label.en.trim()) {
      const secondaryCheck = checkInternalPath(secondaryCta.href)
      if (!secondaryCheck.valid) {
        next.secondaryCtaHref = secondaryCheck.reason ?? 'Invalid destination'
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (inFlight.current || !user) return
    setNotice(null)
    if (!validate()) return

    inFlight.current = true
    setIsSaving(true)

    try {
      const hasSecondary =
        secondaryCta.href.trim() &&
        (secondaryCta.label.he.trim() || secondaryCta.label.en.trim())

      const result = await saveFaqSettings(user, {
        heading,
        intro: { he: cleanupCmsHtml(intro.he), en: cleanupCmsHtml(intro.en) },
        sectionTitles,
        seoTitle,
        seoDescription,
        ogTitle,
        ogDescription,
        ogImage,
        robots,
        primaryCta,
        ...(hasSecondary ? { secondaryCta } : {}),
      })

      if (!result.ok) {
        if (result.issues) setErrors((prev) => ({ ...prev, ...issuesToFieldMap(result.issues) }))
        setNotice({ type: 'error', message: result.error })
        return
      }

      setNotice({ type: 'success', message: 'Saved. The public FAQ page is updating now.' })
      router.refresh()
    } catch (error) {
      console.error('Error saving FAQ settings:', error)
      setNotice({ type: 'error', message: 'Something went wrong while saving.' })
    } finally {
      setIsSaving(false)
      inFlight.current = false
    }
  }

  const dir = activeTab === 'he' ? 'rtl' : 'ltr'

  if (loading) {
    return (
      <div className={adminTheme.pageBg}>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-gray-500">Loading settings…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={adminTheme.pageBg}>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <Link href="/admin/faq" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to FAQ
        </Link>

        <div>
          <h1 className={adminTheme.title}>FAQ page settings</h1>
          <p className={adminTheme.subtitle}>
            The heading, intro, section titles, SEO metadata and calls to action for /he/faq and
            /en/faq.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className={`rounded-md border p-3 text-sm ${
              notice.type === 'success'
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {notice.message}
          </p>
        )}

        <div className="flex gap-2 border-b border-gray-200">
          {(['he', 'en'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                activeTab === tab ? adminTheme.tabActive : adminTheme.tabInactive
              }`}
            >
              {tab === 'he' ? 'Hebrew' : 'English'}
            </button>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Page content</h2>

          <div>
            <label htmlFor="faq-heading" className="mb-1 block text-sm font-medium text-gray-700">
              H1 heading ({activeTab.toUpperCase()}) *
            </label>
            <input
              id="faq-heading"
              type="text"
              value={heading[activeTab]}
              onChange={(event) => setLocalized(setHeading, activeTab, event.target.value)}
              dir={dir}
              className={adminTheme.input}
            />
            <p className="mt-1 text-xs text-gray-500">The page&apos;s single H1. Plain text.</p>
            {errors.heading && <p className="mt-1 text-sm text-red-600">{errors.heading}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Introduction ({activeTab.toUpperCase()})
            </label>
            <RichTextEditor
              key={`intro-${activeTab}`}
              editorKey={`intro-${activeTab}`}
              value={intro[activeTab]}
              onChange={(html) => setLocalized(setIntro, activeTab, html)}
              dir={dir}
              features={{ youtube: false, image: false }}
              placeholder={activeTab === 'he' ? 'פסקת הפתיחה…' : 'Opening paragraph…'}
            />
            <p className="mt-1 text-xs text-gray-500">
              Shown directly under the H1. Explain what the page covers.
            </p>
          </div>

          {FAQ_AUDIENCES.map((audience) => (
            <div key={audience}>
              <label
                htmlFor={`faq-section-title-${audience}`}
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {FAQ_AUDIENCE_LABELS[audience].en} section title ({activeTab.toUpperCase()})
              </label>
              <input
                id={`faq-section-title-${audience}`}
                type="text"
                value={sectionTitles[audience][activeTab]}
                onChange={(event) =>
                  setSectionTitles((prev) => ({
                    ...prev,
                    [audience]: { ...prev[audience], [activeTab]: event.target.value },
                  }))
                }
                dir={dir}
                className={adminTheme.input}
              />
            </div>
          ))}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900">SEO</h2>

          <div>
            <label htmlFor="faq-seo-title" className="mb-1 block text-sm font-medium text-gray-700">
              Meta title ({activeTab.toUpperCase()})
            </label>
            <input
              id="faq-seo-title"
              type="text"
              value={seoTitle[activeTab]}
              onChange={(event) => setLocalized(setSeoTitle, activeTab, event.target.value)}
              dir={dir}
              className={adminTheme.input}
            />
            <SeoFieldCounter value={seoTitle[activeTab]} range={SEO_TITLE_RANGE} countsBrandSuffix />
          </div>

          <div>
            <label htmlFor="faq-seo-description" className="mb-1 block text-sm font-medium text-gray-700">
              Meta description ({activeTab.toUpperCase()})
            </label>
            <textarea
              id="faq-seo-description"
              value={seoDescription[activeTab]}
              onChange={(event) => setLocalized(setSeoDescription, activeTab, event.target.value)}
              dir={dir}
              rows={3}
              className={adminTheme.input}
            />
            <SeoFieldCounter value={seoDescription[activeTab]} range={META_DESCRIPTION_RANGE} />
          </div>

          <div>
            <label htmlFor="faq-og-title" className="mb-1 block text-sm font-medium text-gray-700">
              Open Graph title ({activeTab.toUpperCase()})
            </label>
            <input
              id="faq-og-title"
              type="text"
              value={ogTitle[activeTab]}
              onChange={(event) => setLocalized(setOgTitle, activeTab, event.target.value)}
              dir={dir}
              className={adminTheme.input}
              placeholder="Falls back to the meta title"
            />
          </div>

          <div>
            <label htmlFor="faq-og-description" className="mb-1 block text-sm font-medium text-gray-700">
              Open Graph description ({activeTab.toUpperCase()})
            </label>
            <textarea
              id="faq-og-description"
              value={ogDescription[activeTab]}
              onChange={(event) => setLocalized(setOgDescription, activeTab, event.target.value)}
              dir={dir}
              rows={2}
              className={adminTheme.input}
              placeholder="Falls back to the meta description"
            />
          </div>

          <div>
            <label htmlFor="faq-og-image" className="mb-1 block text-sm font-medium text-gray-700">
              Open Graph image URL
            </label>
            <input
              id="faq-og-image"
              type="url"
              value={ogImage}
              onChange={(event) => setOgImage(event.target.value)}
              dir="ltr"
              className={adminTheme.input}
              placeholder="Leave empty to use the default site image"
            />
          </div>

          <div>
            <label htmlFor="faq-robots" className="mb-1 block text-sm font-medium text-gray-700">
              Robots
            </label>
            <select
              id="faq-robots"
              value={robots}
              onChange={(event) => setRobots(event.target.value as FaqRobots)}
              className={`${adminTheme.select} max-w-xs`}
            >
              <option value="index, follow">Index, Follow (default)</option>
              <option value="noindex, follow">Noindex, Follow</option>
              <option value="noindex, nofollow">Noindex, Nofollow</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Applies to both languages. The page is served noindex automatically while no questions
              are published, whatever is set here.
            </p>
          </div>
        </section>

        <section className="space-y-6 border-t border-gray-200 pt-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Calls to action</h2>
            <p className="mt-1 text-sm text-gray-500">
              Rendered as ordinary links at the end of the women&apos;s and men&apos;s sections.
              Internal paths only, without the language prefix.
            </p>
          </div>

          {(
            [
              ['primary', "Women's section CTA", primaryCta, setPrimaryCta, 'primaryCtaHref'],
              ['secondary', "Men's section CTA", secondaryCta, setSecondaryCta, 'secondaryCtaHref'],
            ] as const
          ).map(([key, title, cta, setCta, errorKey]) => (
            <div key={key} className="rounded-md border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`faq-cta-${key}-label`}
                    className="mb-1 block text-xs font-medium text-gray-600"
                  >
                    Label ({activeTab.toUpperCase()})
                  </label>
                  <input
                    id={`faq-cta-${key}-label`}
                    type="text"
                    value={cta.label[activeTab]}
                    onChange={(event) =>
                      setCta((prev) => ({
                        ...prev,
                        label: { ...prev.label, [activeTab]: event.target.value },
                      }))
                    }
                    dir={dir}
                    className={adminTheme.input}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`faq-cta-${key}-href`}
                    className="mb-1 block text-xs font-medium text-gray-600"
                  >
                    Destination
                  </label>
                  <input
                    id={`faq-cta-${key}-href`}
                    type="text"
                    value={cta.href}
                    onChange={(event) => setCta((prev) => ({ ...prev, href: event.target.value }))}
                    dir="ltr"
                    className={adminTheme.input}
                    placeholder={key === 'primary' ? '/collection/women' : '/collection/men'}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Renders as <code>/{activeTab}{cta.href || '…'}</code>
                  </p>
                </div>
              </div>
              {errors[errorKey] && <p className="mt-2 text-sm text-red-600">{errors[errorKey]}</p>}
            </div>
          ))}
        </section>

        <div className="flex gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={adminTheme.buttonPrimary}
          >
            {isSaving ? 'Saving…' : 'Save settings'}
          </button>
          <Link
            href="/admin/faq"
            className="inline-flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
