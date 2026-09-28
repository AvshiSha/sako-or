'use client'

import { useId, useState } from 'react'

/**
 * Disclosure row, design system 438:3918 ("Dropdown / Product Details").
 *
 * A 55px summary rule with the label on the inline start and a +/− sign on the
 * inline end, over a hairline. The PDP stacks three of these; the cart uses one for
 * the coupon panel.
 */

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
        className="flex h-[55px] w-full items-center justify-between"
      >
        {/* Title first, sign second. `justify-between` then puts the title on the
            inline start and the sign on the inline end, which mirrors correctly:
            title right / sign left in Hebrew, and the reverse in English. Reading
            the frame's absolute positions instead would have pinned them LTR. */}
        <span className="font-ploni text-[16px] font-bold text-text-primary">{title}</span>
        <span aria-hidden="true" className="font-ploni text-[16px] font-bold leading-none text-text-primary">
          {/* U+2212 minus, matching the quantity stepper - a hyphen sits short and
              light against the + at the same size. */}
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {/* grid-rows 0fr -> 1fr animates to the content's natural height. The previous
          implementation animated max-h to a fixed 96 (384px) and silently clipped
          anything taller, which the PDP's spec tables already exceeded. */}
      {/* inert while collapsed: the panel stays mounted so it can animate, and
          without this its links and inputs - the cart's coupon field among them -
          remain tabbable behind a zero-height row. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={summaryId}
        inert={!isOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-[20px] font-ploni text-[13px] leading-[20.15px] text-text-primary">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
