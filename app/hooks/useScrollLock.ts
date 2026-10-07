'use client'

import { useEffect } from 'react'

/**
 * Freezes the page behind a modal surface.
 *
 * Measured on the live storefront rather than assumed:
 *
 *  - **`<html>` is `document.scrollingElement`, so it is locked directly.** A
 *    `<body>` lock happens to work today only because nothing sets an overflow
 *    on `<html>`, which leaves body's own overflow propagating up to the
 *    viewport. That propagation stops the moment anyone adds something as
 *    ordinary as `html { overflow-x: hidden }`, and then every body-based lock
 *    in the app silently becomes a no-op. Locking the scroller itself does not
 *    depend on the rule.
 *  - **`overflow: hidden` stops wheel and touch, not `scrollTo`.** That is the
 *    definition, not a quirk — `overflow: clip` is the one that stops both — so
 *    don't "verify" this with a programmatic scroll, which goes through on a
 *    perfectly good lock. `html` also keeps its scrollTop while hidden, which
 *    is what returns the page to the same position on close.
 *  - **The scrollbar's width has to be given back as padding**, or the layout
 *    jumps sideways the moment the surface opens (15px on desktop Chrome here).
 *    `paddingInlineEnd` is the correct side in both locales without a branch: a
 *    vertical scrollbar sits on the right in LTR and on the left in RTL, and
 *    inline-end resolves to exactly those.
 *
 * Locks nest. A count, rather than each caller saving and restoring for itself,
 * is what makes the hook safe to use from more than one surface at a time: the
 * second caller would otherwise save the already-locked `overflow: hidden` as
 * the value to restore, and leave the page frozen after both had closed.
 */

let lockCount = 0
let restoreOverflow = ''
let restorePaddingInlineEnd = ''

function acquire(): void {
  const html = document.documentElement

  if (lockCount === 0) {
    restoreOverflow = html.style.overflow
    restorePaddingInlineEnd = html.style.paddingInlineEnd

    // Measured before `overflow: hidden` takes the scrollbar away.
    const scrollbar = window.innerWidth - html.clientWidth

    html.style.overflow = 'hidden'
    if (scrollbar > 0) html.style.paddingInlineEnd = `${scrollbar}px`
  }

  lockCount += 1
}

function release(): void {
  if (lockCount === 0) return

  lockCount -= 1
  if (lockCount > 0) return

  const html = document.documentElement
  html.style.overflow = restoreOverflow
  html.style.paddingInlineEnd = restorePaddingInlineEnd
}

/** Locks page scroll for as long as `locked` is true and the caller is mounted. */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    acquire()
    return release
  }, [locked])
}
