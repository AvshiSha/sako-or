'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, EyeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/app/contexts/AuthContext'
import RichTextEditor from '@/app/(unlocalized)/admin/_components/RichTextEditorLazy'
import { adminTheme } from '@/app/(unlocalized)/admin/_components/adminTheme'
import { cleanupCmsHtml, isCmsHtmlEmpty } from '@/lib/cms-html-cleanup'
import {
  FAQ_AUDIENCES,
  FAQ_AUDIENCE_LABELS,
  FAQ_TOPICS,
  FAQ_TOPIC_LABELS,
  type FaqAudience,
  type FaqItem,
  type FaqStatus,
  type FaqTopic,
} from '@/lib/faq-types'
import { buildFaqSlug, isValidFaqSlug } from '@/lib/faq-slug'
import { checkInternalPath } from '@/lib/schemas/faq-schema'
import { createFaq, issuesToFieldMap, updateFaq } from '@/lib/admin/faq-client'
import FaqPreviewModal from './FaqPreviewModal'

/**
 * FAQ answers may not contain an h1 or h2: the page owns the h1, and each
 * accordion question is rendered as an h2. Restricting the toolbar keeps an
 * admin from creating the problem in the first place; sanitizeFaqAnswerHtml
 * demotes anything that arrives by paste anyway.
 *
 * Module-level constants, not inline literals: they are compared by identity in
 * the editor's config key.
 */
const FAQ_HEADING_LEVELS: (2 | 3)[] = [3]
const FAQ_EDITOR_FEATURES = { youtube: false, image: false, callout: true }

const emptyLocalized = () => ({ he: '', en: '' })

interface RelatedLinkDraft {
  label: { he: string; en: string }
  href: string
}

interface FaqFormProps {
  /** Absent when creating. */
  initial?: FaqItem | null
}

export default function FaqForm({ initial }: FaqFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const isEditing = Boolean(initial)

  const [activeTab, setActiveTab] = useState<'he' | 'en'>('he')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)

  // Guards against a double-submit from a double-clicked button producing two
  // questions. The disabled attribute alone loses the race on a fast double click.
  const inFlight = useRef(false)

  const [question, setQuestion] = useState(initial?.question ?? emptyLocalized())
  const [answerHtml, setAnswerHtml] = useState(
    initial?.answerHtml
      ? {
          he: cleanupCmsHtml(initial.answerHtml.he || ''),
          en: cleanupCmsHtml(initial.answerHtml.en || ''),
        }
      : emptyLocalized()
  )
  const [shortAnswer, setShortAnswer] = useState(initial?.shortAnswer ?? emptyLocalized())
  const [audience, setAudience] = useState<FaqAudience>(initial?.audience ?? 'women')
  const [topic, setTopic] = useState<FaqTopic>(initial?.topic ?? 'general')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug))
  const [relatedLinks, setRelatedLinks] = useState<RelatedLinkDraft[]>(
    initial?.relatedLinks?.map((link) => ({ label: { ...link.label }, href: link.href })) ?? []
  )

  const wasPublished = initial?.status === 'published'

  // Auto-derived from the English question until the admin edits it by hand.
  const effectiveSlug = useMemo(() => {
    if (slugTouched) return slug
    return buildFaqSlug(question)
  }, [slug, slugTouched, question])

  const setLocalized = (
    setter: React.Dispatch<React.SetStateAction<{ he: string; en: string }>>,
    locale: 'he' | 'en',
    value: string
  ) => setter((prev) => ({ ...prev, [locale]: value }))

  const validate = (): boolean => {
    const next: Record<string, string> = {}

    if (!question.he.trim() && !question.en.trim()) {
      next.question = 'A question is required in at least one language'
    }
    if (isCmsHtmlEmpty(answerHtml.he) && isCmsHtmlEmpty(answerHtml.en)) {
      next.answerHtml = 'An answer is required in at least one language'
    }
    if (!effectiveSlug || !isValidFaqSlug(effectiveSlug)) {
      next.slug = 'Slug must be lowercase letters, digits and single hyphens'
    }

    relatedLinks.forEach((link, index) => {
      if (!link.label.he.trim() && !link.label.en.trim()) {
        next[`relatedLinks.${index}.label`] = 'A link needs a label'
      }
      const check = checkInternalPath(link.href)
      if (!check.valid) {
        next[`relatedLinks.${index}.href`] = check.reason ?? 'Invalid internal path'
      }
    })

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const buildPayload = () => ({
    slug: effectiveSlug,
    audience,
    topic,
    question: { he: question.he.trim(), en: question.en.trim() },
    answerHtml: {
      he: cleanupCmsHtml(answerHtml.he),
      en: cleanupCmsHtml(answerHtml.en),
    },
    shortAnswer: { he: shortAnswer.he.trim(), en: shortAnswer.en.trim() },
    relatedLinks: relatedLinks
      .filter((link) => link.href.trim())
      .map((link) => ({ label: link.label, href: link.href.trim() })),
  })

  const handleSubmit = async (status: FaqStatus) => {
    if (inFlight.current) return
    setFormError(null)
    setWarnings([])
    if (!validate()) return

    if (!user) {
      setFormError('You are not signed in.')
      return
    }

    inFlight.current = true
    setIsSubmitting(true)

    try {
      const payload = buildPayload()

      const result = isEditing
        ? await updateFaq(user, initial!.id, { ...payload, status })
        : await createFaq(user, { ...payload, status: status === 'hidden' ? 'draft' : status })

      if (!result.ok) {
        if (result.code === 'SLUG_TAKEN') {
          setErrors((prev) => ({ ...prev, slug: 'That slug is already in use' }))
        }
        if (result.issues) {
          setErrors((prev) => ({ ...prev, ...issuesToFieldMap(result.issues) }))
        }
        setFormError(result.error)
        return
      }

      const returnedWarnings = 'warnings' in result.data ? result.data.warnings : []
      if (returnedWarnings.length > 0) {
        // Surfaced rather than swallowed: the admin should know the sanitizer
        // changed their markup. Not blocking — the save already succeeded.
        setWarnings(returnedWarnings)
        setIsSubmitting(false)
        inFlight.current = false
        return
      }

      router.push(`/admin/faq?saved=${encodeURIComponent(effectiveSlug)}`)
      router.refresh()
    } catch (error) {
      console.error('Error saving FAQ:', error)
      setFormError('Something went wrong while saving. Please try again.')
    } finally {
      setIsSubmitting(false)
      inFlight.current = false
    }
  }

  const dir = activeTab === 'he' ? 'rtl' : 'ltr'

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit(initial?.status ?? 'draft')
      }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <Link href="/admin/faq" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to FAQ
        </Link>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={adminTheme.buttonSecondary}
        >
          <EyeIcon className="mr-2 h-4 w-4" />
          Preview
        </button>
      </div>

      <div>
        <h1 className={adminTheme.title}>{isEditing ? 'Edit question' : 'New question'}</h1>
        {isEditing && (
          <p className={adminTheme.subtitle}>
            Last updated{' '}
            {initial?.updatedAt ? new Date(initial.updatedAt).toLocaleString() : '—'}
            {initial?.updatedBy ? ` by ${initial.updatedBy}` : ''}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      {warnings.length > 0 && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Saved, with changes:</p>
          <ul className="mt-1 list-disc space-y-1 ps-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push('/admin/faq')}
            className="mt-3 text-sm font-medium underline"
          >
            Back to the list
          </button>
        </div>
      )}

      {/* Language tabs */}
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

      <div>
        <label htmlFor="faq-question" className="mb-1 block text-sm font-medium text-gray-700">
          Question ({activeTab.toUpperCase()}) *
        </label>
        {/* Plain text, not a rich-text field: this string goes inside a <button>
            and is used verbatim as the schema.org Question name. */}
        <input
          id="faq-question"
          type="text"
          value={question[activeTab]}
          onChange={(event) => setLocalized(setQuestion, activeTab, event.target.value)}
          dir={dir}
          maxLength={300}
          className={adminTheme.input}
          placeholder={activeTab === 'he' ? 'איך בוחרים מידה?' : 'How do I choose a size?'}
        />
        <p className="mt-1 text-xs text-gray-500">
          Rendered as an H2 on the public page. Plain text — no formatting.
        </p>
        {errors.question && <p className="mt-1 text-sm text-red-600">{errors.question}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="faq-audience" className="mb-1 block text-sm font-medium text-gray-700">
            Section *
          </label>
          <select
            id="faq-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value as FaqAudience)}
            className={adminTheme.select}
          >
            {FAQ_AUDIENCES.map((value) => (
              <option key={value} value={value}>
                {FAQ_AUDIENCE_LABELS[value].en}
              </option>
            ))}
          </select>
          {isEditing && initial && audience !== initial.audience && (
            <p className="mt-1 text-xs text-amber-700">
              Moving this question to another section places it last in that section.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="faq-topic" className="mb-1 block text-sm font-medium text-gray-700">
            Topic
          </label>
          <select
            id="faq-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value as FaqTopic)}
            className={adminTheme.select}
          >
            {FAQ_TOPICS.map((value) => (
              <option key={value} value={value}>
                {FAQ_TOPIC_LABELS[value].en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="faq-slug" className="mb-1 block text-sm font-medium text-gray-700">
          Slug *
        </label>
        <input
          id="faq-slug"
          type="text"
          value={effectiveSlug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(event.target.value)
          }}
          dir="ltr"
          className={adminTheme.input}
        />
        <p className="mt-1 text-xs text-gray-500">
          Becomes the anchor link <code>#faq-question-{effectiveSlug || '…'}</code>.
        </p>
        {wasPublished && (
          <p className="mt-1 text-xs text-amber-700">
            This question is published. Changing the slug breaks every existing link to it.
          </p>
        )}
        {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
      </div>

      <div>
        <label htmlFor="faq-short-answer" className="mb-1 block text-sm font-medium text-gray-700">
          Short answer ({activeTab.toUpperCase()})
        </label>
        <textarea
          id="faq-short-answer"
          value={shortAnswer[activeTab]}
          onChange={(event) => setLocalized(setShortAnswer, activeTab, event.target.value)}
          dir={dir}
          rows={2}
          maxLength={400}
          className={adminTheme.input}
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional. Shown as a highlighted summary above the answer, and used in structured data
          when the full answer is very long.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Answer ({activeTab.toUpperCase()}) *
        </label>
        <RichTextEditor
          key={activeTab}
          editorKey={activeTab}
          value={answerHtml[activeTab]}
          onChange={(html) => setLocalized(setAnswerHtml, activeTab, html)}
          dir={dir}
          headingLevels={FAQ_HEADING_LEVELS}
          features={FAQ_EDITOR_FEATURES}
          placeholder={activeTab === 'he' ? 'כתבו את התשובה…' : 'Write the answer…'}
        />
        <p className="mt-1 text-xs text-gray-500">
          Subheadings start at H3 — the page provides the H1 and this question is the H2. Use
          &ldquo;Note&rdquo; for a highlighted summary box.
        </p>
        {errors.answerHtml && <p className="mt-1 text-sm text-red-600">{errors.answerHtml}</p>}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Related links</h2>
          <button
            type="button"
            onClick={() =>
              setRelatedLinks((prev) => [...prev, { label: emptyLocalized(), href: '' }])
            }
            className={adminTheme.buttonSecondary}
            disabled={relatedLinks.length >= 6}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Add link
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Crawlable links shown at the end of the answer. Internal paths only, without the language
          prefix — for example <code>/collection/women</code>.
        </p>

        <div className="mt-4 space-y-4">
          {relatedLinks.map((link, index) => (
            <div key={index} className="rounded-md border border-gray-200 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Label ({activeTab.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={link.label[activeTab]}
                    dir={dir}
                    onChange={(event) =>
                      setRelatedLinks((prev) =>
                        prev.map((current, i) =>
                          i === index
                            ? { ...current, label: { ...current.label, [activeTab]: event.target.value } }
                            : current
                        )
                      )
                    }
                    className={adminTheme.input}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Destination</label>
                  <input
                    type="text"
                    value={link.href}
                    dir="ltr"
                    onChange={(event) =>
                      setRelatedLinks((prev) =>
                        prev.map((current, i) =>
                          i === index ? { ...current, href: event.target.value } : current
                        )
                      )
                    }
                    className={adminTheme.input}
                    placeholder="/collection/women"
                  />
                </div>
              </div>
              {(errors[`relatedLinks.${index}.label`] || errors[`relatedLinks.${index}.href`]) && (
                <p className="mt-1 text-sm text-red-600">
                  {errors[`relatedLinks.${index}.label`] || errors[`relatedLinks.${index}.href`]}
                </p>
              )}
              <button
                type="button"
                onClick={() => setRelatedLinks((prev) => prev.filter((_, i) => i !== index))}
                className="mt-2 inline-flex items-center text-sm text-red-600 hover:text-red-700"
              >
                <TrashIcon className="mr-1 h-4 w-4" />
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={isSubmitting}
          className={adminTheme.buttonSecondary}
        >
          {isSubmitting ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('published')}
          disabled={isSubmitting}
          className={adminTheme.buttonPrimary}
        >
          {isSubmitting ? 'Publishing…' : isEditing && wasPublished ? 'Save & keep published' : 'Save & publish'}
        </button>
        {isEditing && wasPublished && (
          <button
            type="button"
            onClick={() => handleSubmit('hidden')}
            disabled={isSubmitting}
            className={adminTheme.buttonSecondary}
          >
            Save & hide
          </button>
        )}
        <Link href="/admin/faq" className="inline-flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </Link>
      </div>

      {previewOpen && (
        <FaqPreviewModal
          question={question[activeTab]}
          answerHtml={answerHtml[activeTab]}
          locale={activeTab}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </form>
  )
}
