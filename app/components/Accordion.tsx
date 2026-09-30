'use client'

import { useId, useState } from 'react'

/**
 * Disclosure row, design system 438:3918 ("Dropdown / Product Details").
 *
 * A 55px summary rule with the label on the inline start and a +/− sign on the
 * inline end, over a hairline. The PDP stacks three of these; the cart uses one for
 * the coupon panel.
 */

/** One duration/easing for every disclosure on the site. */
export const DISCLOSURE_TRANSITION = 'duration-300 ease-out'

/**
 * The animated half of a disclosure, shared so the footer and the PDP open at the
 * same rate rather than each rolling its own.
 *
 * grid-rows 0fr -> 1fr animates to the content's natural height; animating max-h
 * instead needs a magic ceiling, and the previous PDP implementation clipped at
 * 384px. Interrupting mid-animation is safe - the browser transitions from the
 * current computed value, so rapid open/close eases from wherever it had got to
 * rather than snapping.
 */
export function AccordionPanel({
  id,
  labelledBy,
  open,
  /** Footer columns are collapsible on mobile only; from lg the frame shows them all open. */
  openFromLg = false,
  isInert,
  contentClassName = '',
  children,
}: {
  id?: string
  labelledBy?: string
  open: boolean
  openFromLg?: boolean
  isInert: boolean
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      // Collapsed panels stay mounted so they can animate, which leaves their
      // links and inputs tabbable behind a zero-height row without this.
      inert={isInert}
      className={`grid transition-[grid-template-rows] ${DISCLOSURE_TRANSITION} ${
        open ? 'grid-rows-[1fr]' : openFromLg ? 'grid-rows-[0fr] lg:grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      <div className="overflow-hidden">
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  )
}

/**
 * The +/− affordance. Both glyphs are stacked and crossfaded over the same
 * duration as the panel, so the mark finishes changing exactly when the content
 * finishes moving instead of flipping instantly against a 300ms slide.
 */
export function DisclosureSign({
  open,
  className = '',
  plus = '+',
  minus = '−',
}: {
  open: boolean
  className?: string
  plus?: string
  minus?: string
}) {
  return (
    <span aria-hidden="true" className={`grid place-items-center leading-none ${className}`}>
      <span
        className={`col-start-1 row-start-1 transition-opacity ${DISCLOSURE_TRANSITION} ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {plus}
      </span>
      <span
        className={`col-start-1 row-start-1 transition-opacity ${DISCLOSURE_TRANSITION} ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {minus}
      </span>
    </span>
  )
}

interface AccordionProps {
  title: string
  children: React.ReactNode
  /** 438:3918 documents an Expanded state; which rows start open is a per-page call. */
  defaultOpen?: boolean
}

export default function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const panelId = useId()
  const summaryId = useId()

  return (
    // The frame carries `pb-px` alongside the bottom border - that is Figma
    // accounting for the stroke in its own box model, not a real gap. With
    // border-box it would add a stray pixel between stacked rows, so it is dropped.
    <div className="border-b border-border-default">
      <button
        type="button"
        id={summaryId}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        // 62 on mobile (438:4252), 100 on desktop (438:2706). The standalone
        // component frame 438:3918 documents 55, but both places it actually ships
        // are taller, so the in-situ sizes win.
        className="flex h-[62px] w-full items-center justify-between lg:h-[100px]"
      >
        {/* Title first, sign second. `justify-between` then puts the title on the
            inline start and the sign on the inline end, which mirrors correctly:
            title right / sign left in Hebrew, and the reverse in English. Reading
            the frame's absolute positions instead would have pinned them LTR. */}
        <span className="font-ploni text-[16px] font-bold text-text-primary">{title}</span>
        {/* U+2212 minus, matching the quantity stepper - a hyphen sits short and
            light against the + at the same size. */}
        <DisclosureSign open={isOpen} className="font-ploni text-[16px] font-bold text-text-primary" />
      </button>

      <AccordionPanel
        id={panelId}
        labelledBy={summaryId}
        open={isOpen}
        isInert={!isOpen}
        contentClassName="pb-[20px] font-ploni text-[13px] leading-[20.15px] text-text-primary"
      >
        {children}
      </AccordionPanel>
    </div>
  )
}
