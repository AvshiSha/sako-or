'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { slugFromHash } from '@/lib/faq-slug'
import {
  trackFaqCtaClick,
  trackFaqQuestionOpen,
  trackFaqView,
} from '@/lib/faq-analytics-client'
import type { FaqAudience, FaqTopic } from '@/lib/faq-types'
import type { FaqCtaId, FaqOpenMethod } from '@/lib/faq-analytics'

interface FaqAccordionClientProps {
  children: ReactNode
  locale: 'he' | 'en'
  questionCount: number
  audiences: readonly FaqAudience[]
}

/**
 * Makes the server-rendered accordion interactive.
 *
 * The important thing this component does NOT do is render the questions. They
 * arrive as `children` — an opaque RSC payload it passes straight through — so
 * React never reconciles those nodes on the client. That has three consequences
 * worth stating, because they are the whole reason for the shape:
 *
 *  1. No hydration mismatch is possible. There is nothing to mismatch: the
 *     server markup is the only markup, and this file toggles attributes on it
 *     imperatively.
 *  2. The sanitized answer HTML never enters the client bundle or the flight
 *     payload as a string prop.
 *  3. There is no React state for which items are open — the DOM is the state.
 *     Anything that needs to re-render on open/close would have to live in this
 *     wrapper's own state, not in the items.
 *
 * Events are delegated from the root rather than bound per question, so the
 * cost is constant regardless of how many questions an admin publishes.
 */
export default function FaqAccordionClient({
  children,
  locale,
  questionCount,
  audiences,
}: FaqAccordionClientProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewTracked = useRef(false)
  const openedSlugs = useRef<Set<string>>(new Set())

  const triggers = useCallback((): HTMLButtonElement[] => {
    const root = rootRef.current
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLButtonElement>('button.faq-trigger'))
  }, [])

  const setOpen = useCallback(
    (trigger: HTMLButtonElement, open: boolean, method: FaqOpenMethod) => {
      const panelId = trigger.getAttribute('aria-controls')
      const panel = panelId ? document.getElementById(panelId) : null
      const item = trigger.closest<HTMLElement>('.faq-item')

      trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
      if (panel) panel.hidden = !open
      if (item) item.dataset.open = open ? 'true' : 'false'

      if (!open) return

      // Only opens are reported, and only the first time per page view.
      // Otherwise someone toggling one question five times inflates its count
      // fivefold and the question looks more popular than it is.
      const slug = item?.dataset.faqSlug
      if (!slug || openedSlugs.current.has(slug)) return
      openedSlugs.current.add(slug)

      trackFaqQuestionOpen({
        slug,
        question: trigger.querySelector('.faq-trigger-text')?.textContent?.trim() ?? '',
        audience: (item?.dataset.faqAudience as FaqAudience | undefined) ?? null,
        topic: (item?.dataset.faqTopic as FaqTopic | undefined) ?? null,
        locale,
        method,
      })
    },
    [locale]
  )

  const openBySlug = useCallback(
    (slug: string, method: FaqOpenMethod) => {
      const root = rootRef.current
      if (!root) return null
      const trigger = root.querySelector<HTMLButtonElement>(
        `.faq-item[data-faq-slug="${CSS.escape(slug)}"] button.faq-trigger`
      )
      if (!trigger) return null
      if (trigger.getAttribute('aria-expanded') !== 'true') setOpen(trigger, true, method)
      return trigger
    },
    [setOpen]
  )

  // Click: toggle, and route CTA clicks to analytics without intercepting the
  // navigation itself — the anchors stay ordinary anchors.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const trigger = target.closest<HTMLButtonElement>('button.faq-trigger')
      if (trigger && root.contains(trigger)) {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true'
        setOpen(trigger, !isOpen, 'click')
        return
      }

      const cta = target.closest<HTMLAnchorElement>('a[data-faq-cta]')
      if (cta && root.contains(cta)) {
        trackFaqCtaClick({
          ctaId: (cta.dataset.faqCta as FaqCtaId) ?? 'primary',
          destinationUrl: cta.getAttribute('href') ?? '',
          locale,
          slug: cta.closest<HTMLElement>('.faq-item')?.dataset.faqSlug,
        })
      }
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [locale, setOpen])

  // Keyboard: Enter and Space come free from <button>; this adds the roving
  // navigation a disclosure group is expected to support.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const trigger = target?.closest<HTMLButtonElement>('button.faq-trigger')
      if (!trigger || !root.contains(trigger)) return

      const all = triggers()
      const index = all.indexOf(trigger)
      if (index === -1) return

      let nextIndex: number | null = null
      switch (event.key) {
        case 'ArrowDown':
          nextIndex = (index + 1) % all.length
          break
        case 'ArrowUp':
          nextIndex = (index - 1 + all.length) % all.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = all.length - 1
          break
        default:
          return
      }

      event.preventDefault()
      all[nextIndex].focus()
    }

    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [triggers])

  // Deep links. useLayoutEffect, not useEffect: opening and scrolling before
  // paint reads as an ordinary anchor jump. Doing it after paint would show the
  // collapsed page first and then visibly jump — a layout shift the user sees.
  useLayoutEffect(() => {
    const slug = slugFromHash(window.location.hash)
    if (!slug) return

    const trigger = openBySlug(slug, 'anchor')
    if (!trigger) return

    trigger.scrollIntoView({ block: 'start' })
    // preventScroll: scrollIntoView above already placed it; letting focus()
    // scroll again would fight it.
    trigger.focus({ preventScroll: true })
  }, [openBySlug])

  // A hash change on an already-loaded page (clicking an on-page deep link).
  useEffect(() => {
    const onHashChange = () => {
      const slug = slugFromHash(window.location.hash)
      if (!slug) return
      const trigger = openBySlug(slug, 'anchor')
      trigger?.focus({ preventScroll: true })
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [openBySlug])

  // Exactly one faq_view per page view. The ref guard also survives React
  // StrictMode's deliberate double-invocation in development, which would
  // otherwise make every dev session report two views.
  useEffect(() => {
    if (viewTracked.current) return
    viewTracked.current = true
    trackFaqView({ locale, questionCount, audiences })
  }, [locale, questionCount, audiences])

  return (
    <div ref={rootRef} className="faq-accordion">
      {children}
    </div>
  )
}
